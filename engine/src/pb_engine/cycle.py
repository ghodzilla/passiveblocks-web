"""One simulated cycle. Reads a tape, writes a local database, sends nothing.

Every signal is a skip. This build does not write a gate row, a trade
plan, or a close. A shadow fill is ungated, including a candidate the
ranker has not proved. Baselines are walked and are never added to the
open book.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from pb_engine import __version__, config
from pb_engine.market_data.freshness import assess
from pb_engine.market_data.freshness import book_time as book_clock
from pb_engine.market_data.replay import Tape, load_tape
from pb_engine.market_data.types import Book, PerpMeta
from pb_engine.models import Equity, Heartbeat, RiskEvent, ShadowTrade, Signal, Strategy
from pb_engine.ranker import rank_history
from pb_engine.risk import (
    OpenPosition,
    Reason,
    RiskState,
    guard_candidate,
    initial_state,
    size_position,
)
from pb_engine.session import cluster_name, session_block, session_state
from pb_engine.shadow import funding_payment, round_trip_cost, slip_cap, taker_fee, walk_book
from pb_engine.store import Store
from pb_engine.strategies import propose
from pb_engine.strategies.baselines import PARAMS as BASELINE_PARAMS
from pb_engine.strategies.crypto import PARAMS as CRYPTO_PARAMS
from pb_engine.strategies.types import Candidate

_NO_FILL = "no_fill"
_BASELINE = "baseline"
_NO_GATE = "no_gate"


@dataclass(frozen=True, slots=True)
class CycleResult:
    now: datetime
    signals: int
    shadow_fills: int
    taken: int
    closed: int


def run_once_replay(
    path: str | Path,
    db: str | Path | None = None,
    *,
    seed: int = 1,
    now: datetime | None = None,
) -> CycleResult:
    tape = load_tape(path)
    with Store(db) as store:
        return run_once(store, tape, seed=seed, now=now)


def run_once(
    store: Store,
    tape: Tape,
    *,
    seed: int = 1,
    now: datetime | None = None,
) -> CycleResult:
    clock = tape.captured_at if now is None else now
    if clock.tzinfo is None or clock.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    equity = float(config.SIM_STARTING_EQUITY_USDC)
    state = initial_state(equity, clock)
    ideas = propose(tape, seed=seed)
    ordered = sorted(
        (item for item in ideas if not item.baseline),
        key=lambda item: (-item.pred_edge_r * item.weight, item.strategy, item.market),
    )
    ordered.extend(item for item in ideas if item.baseline)
    open_positions: list[OpenPosition] = []
    accepted = 0
    signals = 0
    fills = 0
    saw_stale = False
    strategy_ids: dict[str, int] = {}
    for candidate in ordered:
        book = _book(tape, candidate.market)
        fresh = _fresh(book, clock)
        saw_stale = saw_stale or not fresh
        meta = _meta(tape, candidate.market)
        fee_rate = taker_fee(
            candidate.market,
            growth_mode=False if meta is None else meta.growth_mode,
            fee_scale=None if meta is None else meta.deployer_fee_scale,
        )
        rate = _funding_rate(tape, candidate.market)
        reason, notional, keep = _screen(
            candidate,
            clock=clock,
            fresh=fresh,
            fee_rate=fee_rate,
            funding_rate=rate,
            equity=equity,
            state=state,
            open_positions=tuple(open_positions),
            accepted=accepted,
        )
        walked = _try_walk(book, candidate, notional, fee_rate)
        if walked is None and reason is None:
            reason = _NO_FILL
        elif walked is not None and reason is None:
            reason = _BASELINE
        signal = store.add(
            _signal(
                candidate,
                clock=clock,
                reason=reason or _NO_FILL,
                fee_rate=fee_rate,
                slip_fraction=0.0 if walked is None else walked.slip_fraction,
                funding_rate=rate,
                strategy_id=_ensure_strategy(store, candidate, strategy_ids),
            )
        )
        signals += 1
        if walked is None or signal.id is None:
            continue
        oracle = _oracle(tape, candidate.market, walked.average_px)
        store.add(
            ShadowTrade(
                signal_id=signal.id,
                source="shadow",
                book="ungated",
                entry_px=walked.average_px,
                fees=walked.fee,
                slippage=walked.slippage_usd,
                funding=funding_payment(
                    notional=oracle * walked.filled,
                    hourly_rate=rate,
                    hours=candidate.hold_hours,
                    side=candidate.side,
                ),
            )
        )
        fills += 1
        if not keep:
            continue
        distance = abs(candidate.entry - candidate.stop) / candidate.entry
        cluster = cluster_name(candidate.market)
        if cluster is None:
            continue
        open_positions.append(
            OpenPosition(candidate.market, walked.notional, candidate.side, distance, cluster)
        )
        accepted += 1
    blocked = saw_stale and fills == 0
    store.add(
        Heartbeat(
            ts=clock,
            version=__version__,
            network=config.HL_NETWORK,
            ws_ages={"btc_book_s": _book_age(tape, clock)},
        )
    )
    store.add(Equity(ts=clock, shadow_equity=equity))
    store.add(
        RiskEvent(
            ts=clock,
            kind="stale_data" if blocked else "cycle",
            severity="WARN" if blocked else "INFO",
            detail="one simulated cycle; no orders",
            payload={"signals": signals, "shadow_fills": fills, "taken": 0},
        )
    )
    return CycleResult(now=clock, signals=signals, shadow_fills=fills, taken=0, closed=0)


def _screen(
    candidate: Candidate,
    *,
    clock: datetime,
    fresh: bool,
    fee_rate: float,
    funding_rate: float,
    equity: float,
    state: RiskState,
    open_positions: tuple[OpenPosition, ...],
    accepted: int,
) -> tuple[str | None, float | None, bool]:
    """Return skip label, coin-notional to walk, and whether it joins the book.

    A label of ``None`` means the walk itself is the remaining step
    (baselines). A notional of ``None`` means do not walk.
    """

    blocked = session_block(candidate.market, clock, hold_hours=candidate.hold_hours)
    if blocked is not None:
        return blocked, None, False
    if not fresh:
        return Reason.STALE, None, False
    if candidate.entry <= 0:
        return Reason.BAD_STOP, None, False
    distance = abs(candidate.entry - candidate.stop) / candidate.entry
    blocked = guard_candidate(
        side=candidate.side,
        now=clock,
        stop_distance_pct=distance,
        round_trip_cost=round_trip_cost(fee_rate),
        pred_edge_r=candidate.pred_edge_r,
        hold_hours=candidate.hold_hours,
        funding_rate=funding_rate,
        entries_today=accepted,
        consecutive_losses=0,
        last_loss_at=None,
        pace=not candidate.baseline,
    )
    if blocked is not None:
        return blocked, None, False
    if candidate.baseline:
        return None, float(config.MIN_ORDER_USD), False
    ranked = rank_history(mean_r=0.0, n=0, std_r=0.0, weight=_unit(candidate.weight))
    cluster = cluster_name(candidate.market)
    if cluster is None:
        return Reason.BAD_CLUSTER, None, False
    sized = size_position(
        equity=equity,
        stop_distance_pct=distance,
        market=candidate.market,
        side=candidate.side,
        cluster=cluster,
        open_positions=open_positions,
        weight=candidate.weight,
        risk_state=state,
    )
    label = ranked.skip_reason or _NO_GATE
    if not sized.accepted:
        return sized.reason or Reason.BAD_BOOK, float(config.MIN_ORDER_USD), False
    return label, sized.notional_usd, True


def _try_walk(book: Book | None, candidate: Candidate, notional: float | None, fee_rate: float):
    if book is None or notional is None or notional <= 0:
        return None
    best = _touch(book, candidate.side)
    if best is None or best <= 0:
        return None
    return walk_book(
        book,
        side=candidate.side,
        size=notional / best,
        slip_cap=slip_cap(candidate.market),
        fee_rate=fee_rate,
    )


def _signal(
    candidate: Candidate,
    *,
    clock: datetime,
    reason: str,
    fee_rate: float,
    slip_fraction: float,
    funding_rate: float,
    strategy_id: int,
) -> Signal:
    ranked = rank_history(mean_r=0.0, n=0, std_r=0.0, weight=_unit(candidate.weight))
    if candidate.side == "long":
        paid = funding_rate if funding_rate > 0 else 0.0
    else:
        paid = -funding_rate if funding_rate < 0 else 0.0
    return Signal(
        ts=clock,
        strategy_id=strategy_id,
        market=candidate.market,
        side=candidate.side,
        entry_px=candidate.entry,
        stop_px=candidate.stop,
        target_px=candidate.target,
        pred_edge_r=candidate.pred_edge_r,
        pred_win_prob=0.5,
        pred_fee_bps=fee_rate * config.TAKER_LEGS * 10_000,
        pred_slippage_bps=slip_fraction * 10_000,
        pred_funding_bps=paid * candidate.hold_hours * 10_000,
        edge_lcb_r=ranked.lcb,
        weight=_unit(candidate.weight),
        decision="skip",
        features=_features(candidate),
        skip_reason=reason,
        session_state=session_state(candidate.market, clock),
        git_sha="replay",
    )


def _ensure_strategy(store: Store, candidate: Candidate, ids: dict[str, int]) -> int:
    found = ids.get(candidate.strategy)
    if found is not None:
        return found
    params = dict(
        CRYPTO_PARAMS.get(candidate.strategy) or BASELINE_PARAMS.get(candidate.strategy) or {}
    )
    payload = json.dumps(params, sort_keys=True, separators=(",", ":"), allow_nan=False)
    row = store.add(
        Strategy(
            name=candidate.strategy,
            version="1",
            asset_class="crypto",
            params=params,
            params_hash=hashlib.sha256(payload.encode()).hexdigest(),
            status="shadow",
            weight=1.0,
        )
    )
    if row.id is None:
        raise RuntimeError("strategy row has no id")
    ids[candidate.strategy] = row.id
    return row.id


def _features(candidate: Candidate) -> dict[str, object]:
    clean: dict[str, object] = {
        "raw_edge_r": candidate.pred_edge_r,
        "baseline": candidate.baseline,
    }
    for key, value in candidate.features.items():
        if isinstance(value, bool) or isinstance(value, str):
            clean[key] = value
        elif isinstance(value, (int, float)) and math.isfinite(value):
            clean[key] = value
    return clean


def _unit(weight: float) -> float:
    if weight < 0:
        return 0.0
    if weight > 1:
        return 1.0
    return weight


def _book(tape: Tape, market: str) -> Book | None:
    for book in tape.books:
        if book.coin == market:
            return book
    return None


def _meta(tape: Tape, market: str) -> PerpMeta | None:
    for row in tape.meta:
        if row.name == market:
            return row
    return None


def _funding_rate(tape: Tape, market: str) -> float:
    for ctx in tape.ctxs:
        if ctx.name == market and ctx.funding is not None:
            return ctx.funding
    rates = [row.rate for row in tape.funding if row.coin == market]
    if rates:
        return rates[-1]
    return 0.0


def _oracle(tape: Tape, market: str, fallback: float) -> float:
    for ctx in tape.ctxs:
        if ctx.name == market and ctx.oracle_px is not None and ctx.oracle_px > 0:
            return ctx.oracle_px
    return fallback


def _touch(book: Book, side: str) -> float | None:
    levels = book.asks if side == "long" else book.bids
    if not levels:
        return None
    if side == "long":
        return min(level.px for level in levels)
    return max(level.px for level in levels)


def _fresh(book: Book | None, now: datetime) -> bool:
    if book is None:
        return False
    report = assess(book_time=book_clock(book), stream_time=None, now=now, require_stream=False)
    return not report.blocks_new_entries


def _book_age(tape: Tape, now: datetime) -> float | None:
    book = _book(tape, "BTC")
    if book is None:
        return None
    return round((now - book_clock(book)).total_seconds(), 3)
