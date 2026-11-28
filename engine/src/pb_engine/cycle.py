"""One simulated cycle. Reads a tape, writes a local database, sends nothing.

The gate is separate from the strategies. A missing accept is not taken.
Rejected and verify_more ideas still get an ungated shadow walk. A taken
trade is a research fill on the gated book, labelled not live, because
no strategy has 30 closed trades yet. Historical bars have no book, so
they fill at the candle and stay off the taken book. The recorded book
is used only at the capture time.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from pb_engine import __version__, config
from pb_engine.closer import FillView, PlanView, judge
from pb_engine.exits import bar_exit, funding_normalised, ratchet_stop, scheduled_exit
from pb_engine.gate import GateFacts, GateVerdict, allow_take, decide, expire, spread_hard_cap
from pb_engine.market_data.freshness import assess
from pb_engine.market_data.freshness import book_time as book_clock
from pb_engine.market_data.replay import Tape, load_tape
from pb_engine.market_data.types import CORE_COINS, Book, BookLevel, PerpMeta
from pb_engine.models import (
    AlertOutbox,
    CloseEvent,
    Equity,
    Fill,
    GateDecision,
    Heartbeat,
    RiskEvent,
    ShadowTrade,
    Signal,
    Strategy,
    TradePlan,
)
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
from pb_engine.shadow import Walk, funding_payment, round_trip_cost, slip_cap, taker_fee, walk_book
from pb_engine.store import Store
from pb_engine.strategies import propose
from pb_engine.strategies.bars import Bar, bars_for
from pb_engine.strategies.baselines import PARAMS as BASELINE_PARAMS
from pb_engine.strategies.crypto import PARAMS as CRYPTO_PARAMS
from pb_engine.strategies.types import Candidate

_NO_FILL = "no_fill"
_GATE_REJECT = "gate_reject"
_BASELINE = "baseline"


@dataclass(frozen=True, slots=True)
class CycleResult:
    now: datetime
    signals: int
    shadow_fills: int
    taken: int
    closed: int
    equity: float
    ungated_mean_r: float | None
    gated_mean_r: float | None


@dataclass
class _Sim:
    candidate: Candidate
    book: str
    entry_px: float
    entry_time: datetime
    size: float
    stop: float
    initial_stop: float
    target: float
    entry_fee: float
    slip_usd: float
    funding_rate: float
    fee_rate: float
    plan_entry_px: float
    exit_px: float | None = None
    exit_time: datetime | None = None
    exit_reason: str | None = None
    intended_exit_px: float | None = None
    mae: float = 0.0
    mfe: float = 0.0
    pnl: float = 0.0
    realised_r: float = 0.0
    exit_fee: float = 0.0
    funding_usd: float = 0.0
    taken: bool = False


@dataclass
class _Setup:
    candidate: Candidate
    when: datetime
    verdict: GateVerdict
    decision: str
    skip_reason: str | None
    gate_features: dict[str, object]
    sims: list[_Sim] = field(default_factory=list)
    unresolved: int = 0


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
    replay_history: bool = True,
    git_sha: str = "replay",
    require_stream: bool = False,
    stream_time: datetime | None = None,
    prior_equity: float | None = None,
) -> CycleResult:
    clock = tape.captured_at if now is None else now
    if clock.tzinfo is None or clock.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    book = _book(tape, "BTC")
    if require_stream:
        report = assess(
            book_time=None if book is None else book_clock(book),
            stream_time=stream_time,
            now=clock,
            require_stream=True,
        )
        fresh = not report.blocks_new_entries
    else:
        fresh = _fresh(book, clock)
    skip: set[tuple[str, str]] = set()
    seeded: list[OpenPosition] = []
    if not replay_history:
        hour = clock.replace(minute=0, second=0, microsecond=0)
        skip = _recent_signal_keys(store, hour)
        seeded = _open_risk_positions(store)
    if not fresh:
        setups = _blocked_pass(tape, clock, seed, skip=skip)
    elif replay_history:
        setups = _replay(tape, clock, seed)
        equity = float(config.SIM_STARTING_EQUITY_USDC) + _closed_pnl(setups)
        setups.extend(_capture(tape, clock, seed, setups=setups, equity=equity))
    else:
        equity = (
            float(config.SIM_STARTING_EQUITY_USDC) if prior_equity is None else prior_equity
        )
        setups = _capture(
            tape,
            clock,
            seed,
            setups=[],
            equity=equity,
            skip=skip,
            seeded=seeded,
        )
    return _persist(
        store,
        tape,
        clock,
        setups,
        fresh=fresh,
        git_sha=git_sha,
        prior_equity=None if replay_history else prior_equity,
    )


def log_signal_escape(store: Store, now: datetime, market: str) -> None:
    """A setup with no gate verdict is not taken. The row is the record."""

    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    store.add(
        RiskEvent(
            ts=now,
            kind="signal_escape",
            severity="WARN",
            detail=f"no gate verdict for {market}; not taken",
            payload={"market": market, "taken": False},
        )
    )


def gate_allows_take(
    verdict: str | None,
    store: Store,
    now: datetime,
    market: str,
) -> bool:
    """Accept is the only verdict that may open the taken book."""

    if allow_take(verdict):
        return True
    if verdict is None:
        log_signal_escape(store, now, market)
    return False


def _replay(tape: Tape, clock: datetime, seed: int) -> list[_Setup]:
    bars = {coin: bars_for(tape.candles, coin, "1h") for coin in CORE_COINS}
    times = sorted({bar.open_time for rows in bars.values() for bar in rows})
    setups: list[_Setup] = []
    seen_block: set[tuple[str, str]] = set()
    for when in times:
        if when > clock:
            continue
        ideas = propose(tape, seed=seed, as_of=when, include_baselines=False)
        _advance(setups, bars, when, ideas, tape)
        for candidate in ideas:
            if _open_for(setups, candidate.strategy, candidate.market, "ungated"):
                continue
            _consider(
                setups,
                tape,
                candidate,
                when,
                use_book=False,
                entries_allowed=True,
                positions=_open_positions(setups),
                taken_count=0,
                equity=float(config.SIM_STARTING_EQUITY_USDC),
                seen_block=seen_block,
                existing=setups,
                take=False,
            )
        _sweep_time(setups, bars, when)
    _sweep_time(setups, bars, clock)
    return setups


def _capture(
    tape: Tape,
    clock: datetime,
    seed: int,
    *,
    setups: list[_Setup],
    equity: float,
    skip: set[tuple[str, str]] | None = None,
    seeded: list[OpenPosition] | None = None,
) -> list[_Setup]:
    found: list[_Setup] = []
    ideas = propose(tape, seed=seed, include_baselines=True)
    ordered = sorted(
        (item for item in ideas if not item.baseline),
        key=lambda item: (-item.pred_edge_r * item.weight, item.strategy, item.market),
    )
    ordered.extend(item for item in ideas if item.baseline)
    taken_book: list[OpenPosition] = list(seeded or [])
    taken = len(taken_book)
    blocked = skip or set()
    for candidate in ordered:
        if (candidate.strategy, candidate.market) in blocked:
            continue
        _consider(
            found,
            tape,
            candidate,
            clock,
            use_book=True,
            entries_allowed=True,
            positions=taken_book,
            taken_count=taken,
            equity=equity,
            seen_block=set(),
            existing=setups,
            take=True,
        )
        taken_sim = next((sim for sim in found[-1].sims if sim.taken), None) if found else None
        if taken_sim is None:
            continue
        taken += 1
        distance = abs(candidate.entry - candidate.stop) / candidate.entry
        cluster = cluster_name(candidate.market)
        if cluster is None:
            continue
        taken_book.append(
            OpenPosition(
                candidate.market,
                taken_sim.entry_px * taken_sim.size,
                candidate.side,
                distance,
                cluster,
            )
        )
    return found


def _blocked_pass(
    tape: Tape,
    clock: datetime,
    seed: int,
    *,
    skip: set[tuple[str, str]] | None = None,
) -> list[_Setup]:
    """The book is stale, so nothing is walked and nothing is taken."""

    found: list[_Setup] = []
    blocked = skip or set()
    for candidate in propose(tape, seed=seed, include_baselines=True):
        if (candidate.strategy, candidate.market) in blocked:
            continue
        _consider(
            found,
            tape,
            candidate,
            clock,
            use_book=False,
            entries_allowed=False,
            positions=[],
            taken_count=0,
            equity=float(config.SIM_STARTING_EQUITY_USDC),
            seen_block=set(),
            existing=[],
            take=False,
        )
    return found


def _consider(
    setups: list[_Setup],
    tape: Tape,
    candidate: Candidate,
    when: datetime,
    *,
    use_book: bool,
    entries_allowed: bool,
    positions: list[OpenPosition],
    taken_count: int,
    equity: float,
    seen_block: set[tuple[str, str]],
    existing: list[_Setup],
    take: bool,
) -> None:
    if not take and _open_for(existing, candidate.strategy, candidate.market, "ungated"):
        return
    if not take and _open_for(setups, candidate.strategy, candidate.market, "ungated"):
        return
    book = _book(tape, candidate.market) if use_book else None
    fee_rate = _fee(tape, candidate.market)
    if use_book:
        rate = _funding_rate(tape, candidate.market)
    else:
        rate = _rate_as_of(tape, candidate.market, when)
    reason, notional, slot = _screen(
        candidate,
        clock=when,
        fresh=entries_allowed,
        fee_rate=fee_rate,
        funding_rate=rate,
        equity=equity,
        state=initial_state(equity, when),
        open_positions=tuple(positions),
        accepted=taken_count,
    )
    order_usd = float(notional) if notional is not None else float(config.MIN_ORDER_USD)
    verdict, features = _verdict(
        candidate,
        book,
        when=when,
        fee_rate=fee_rate,
        funding_rate=rate,
        order_usd=order_usd,
        stale=not entries_allowed,
        session_open=session_block(candidate.market, when, hold_hours=candidate.hold_hours) is None,
    )
    if reason is not None and notional is None:
        key = (candidate.strategy, candidate.market)
        if key in seen_block:
            return
        seen_block.add(key)
        setups.append(_Setup(candidate, when, verdict, "skip", reason, features))
        return
    walk = _try_walk(book, candidate, notional, fee_rate) if use_book else None
    if use_book and walk is None:
        setups.append(_Setup(candidate, when, verdict, "skip", reason or _NO_FILL, features))
        return
    sims: list[_Sim] = []
    if not use_book and notional is not None:
        sims.append(_candle_sim(candidate, when, order_usd, fee_rate, rate))
    elif walk is not None:
        sims.append(_walk_sim(candidate, when, walk, fee_rate, rate, taken=False))
    wanted = (
        take
        and slot
        and walk is not None
        and not candidate.baseline
        and allow_take(verdict.verdict)
    )
    if wanted and walk is not None:
        sims.append(_walk_sim(candidate, when, walk, fee_rate, rate, taken=True))
    decision, skip = _label(candidate, reason, slot, verdict, wanted)
    setups.append(_Setup(candidate, when, verdict, decision, skip, features, sims))


def _label(
    candidate: Candidate,
    reason: str | None,
    slot: bool,
    verdict: GateVerdict,
    taken: bool,
) -> tuple[str, str | None]:
    if taken:
        return "trade", None
    if candidate.baseline:
        return "skip", _BASELINE
    if reason is not None and not slot:
        return "skip", reason
    if verdict.verdict == "verify_more":
        return "hold", verdict.reasons[0] if verdict.reasons else "verify_more"
    if verdict.verdict == "reject":
        return "skip", _GATE_REJECT
    return "skip", reason or _NO_FILL


def _verdict(
    candidate: Candidate,
    book: Book | None,
    *,
    when: datetime,
    fee_rate: float,
    funding_rate: float,
    order_usd: float,
    stale: bool,
    session_open: bool,
) -> tuple[GateVerdict, dict[str, object]]:
    distance = abs(candidate.entry - candidate.stop) / candidate.entry if candidate.entry else 0.0
    cost = round_trip_cost(fee_rate)
    edge = candidate.pred_edge_r
    if distance > 0:
        edge = candidate.pred_edge_r - cost / distance
    if candidate.side == "long":
        paid = funding_rate if funding_rate > 0 else 0.0
    else:
        paid = -funding_rate if funding_rate < 0 else 0.0
    funding_r = (paid * candidate.hold_hours) / distance if distance > 0 else 0.0
    ranked = rank_history(mean_r=0.0, n=0, std_r=0.0, weight=_unit(candidate.weight))
    spread = _spread(book) if book is not None else None
    depth = _depth(book, candidate.side) if book is not None else None
    age = None if book is None else max(0.0, _age_seconds(book, when))
    facts = GateFacts(
        stale=stale,
        session_open=session_open,
        spread=spread,
        stop_distance_pct=distance,
        round_trip_cost=cost,
        pred_edge_r=edge,
        edge_lcb_r=ranked.lcb,
        book_depth_usd=depth,
        order_notional_usd=order_usd,
        book_age_s=age,
        market=candidate.market,
        funding_cost_r=funding_r,
    )
    features: dict[str, object] = {
        "spread": spread,
        "depth_usd": depth,
        "book_age_s": age,
        "edge_after_cost_r": edge,
        "lcb_r": ranked.lcb,
        "hard_cap": spread_hard_cap(candidate.market),
    }
    return decide(facts), features


def _candle_sim(
    candidate: Candidate,
    when: datetime,
    notional: float,
    fee_rate: float,
    rate: float,
) -> _Sim:
    size = notional / candidate.entry
    return _Sim(
        candidate=candidate,
        book="ungated",
        entry_px=candidate.entry,
        entry_time=when,
        size=size,
        stop=candidate.stop,
        initial_stop=candidate.stop,
        target=candidate.target,
        entry_fee=notional * fee_rate,
        slip_usd=0.0,
        funding_rate=rate,
        fee_rate=fee_rate,
        plan_entry_px=candidate.entry,
        taken=False,
    )


def _walk_sim(
    candidate: Candidate,
    when: datetime,
    walk: Walk,
    fee_rate: float,
    rate: float,
    *,
    taken: bool,
) -> _Sim:
    return _Sim(
        candidate=candidate,
        book="gated" if taken else "ungated",
        entry_px=walk.average_px,
        entry_time=when,
        size=walk.filled,
        stop=candidate.stop,
        initial_stop=candidate.stop,
        target=candidate.target,
        entry_fee=walk.fee,
        slip_usd=walk.slippage_usd,
        funding_rate=rate,
        fee_rate=fee_rate,
        plan_entry_px=walk.best_px,
        taken=taken,
    )


def _advance(
    setups: list[_Setup],
    bars: dict[str, list[Bar]],
    when: datetime,
    ideas: list[Candidate],
    tape: Tape,
) -> None:
    opposed = {(idea.strategy, idea.market, _other(idea.side)) for idea in ideas}
    aged: set[int] = set()
    for setup in setups:
        for sim in setup.sims:
            if sim.exit_px is not None or sim.book != "ungated":
                continue
            rows = bars.get(sim.candidate.market) or []
            bar = next((item for item in rows if item.open_time == when), None)
            if bar is None or bar.open_time <= sim.entry_time:
                continue
            prior = [item for item in rows if item.open_time < when]
            sim.stop = ratchet_stop(
                sim.candidate.strategy,
                sim.candidate.side,
                sim.stop,
                sim.entry_px,
                prior,
            )
            _mark(sim, bar)
            hit = bar_exit(
                side=sim.candidate.side,
                stop=sim.stop,
                initial_stop=sim.initial_stop,
                target=sim.target,
                entry_time=sim.entry_time,
                hold_hours=sim.candidate.hold_hours,
                bar=bar,
            )
            if hit is None:
                rates = _rates_as_of(tape, sim.candidate.market, when)
                latest = rates[-1] if rates else 0.0
                done = (
                    sim.candidate.strategy == "funding_fade_1h"
                    and funding_normalised(rates, latest)
                )
                flip = (sim.candidate.strategy, sim.candidate.market, sim.candidate.side) in opposed
                hit = scheduled_exit(
                    sim.candidate.strategy,
                    bar,
                    flip=flip,
                    funding_done=done,
                )
            if hit is not None:
                _finish(sim, hit.price, bar.open_time, hit.reason)
                continue
            if id(setup) in aged or sim.taken or setup.verdict.verdict != "verify_more":
                continue
            aged.add(id(setup))
            setup.unresolved += 1
            if setup.unresolved >= config.VERIFY_BARS:
                setup.verdict = expire(setup.verdict, setup.unresolved)
                setup.decision = "skip"
                setup.skip_reason = "verify_expired"


def _sweep_time(setups: list[_Setup], bars: dict[str, list[Bar]], clock: datetime) -> None:
    for setup in setups:
        for sim in setup.sims:
            if sim.exit_px is not None:
                continue
            deadline = sim.entry_time + timedelta(hours=sim.candidate.hold_hours)
            if clock < deadline:
                continue
            rows = bars.get(sim.candidate.market) or []
            if not rows:
                continue
            _finish(sim, rows[-1].close, clock, "time")


def _finish(sim: _Sim, price: float, when: datetime, reason: str) -> None:
    if reason in {"stop", "trail"}:
        sim.intended_exit_px = sim.stop
    elif reason == "target":
        sim.intended_exit_px = sim.target
    else:
        sim.intended_exit_px = price
    sign = 1.0 if sim.candidate.side == "long" else -1.0
    gross = sign * (price - sim.entry_px) * sim.size
    exit_fee = abs(price * sim.size) * sim.fee_rate
    hours = max((when - sim.entry_time).total_seconds() / 3600.0, 0.0)
    funding = funding_payment(
        notional=sim.entry_px * sim.size,
        hourly_rate=sim.funding_rate,
        hours=hours,
        side=sim.candidate.side,
    )
    risk = abs(sim.entry_px - sim.initial_stop) * sim.size
    sim.exit_px = price
    sim.exit_time = when
    sim.exit_reason = reason
    sim.exit_fee = exit_fee
    sim.funding_usd = funding
    sim.pnl = gross - sim.entry_fee - exit_fee - funding
    sim.realised_r = sim.pnl / risk if risk > 0 else 0.0


def _mark(sim: _Sim, bar: Bar) -> None:
    if sim.candidate.side == "long":
        sim.mfe = max(sim.mfe, bar.high - sim.entry_px)
        sim.mae = max(sim.mae, sim.entry_px - bar.low)
    else:
        sim.mfe = max(sim.mfe, sim.entry_px - bar.low)
        sim.mae = max(sim.mae, bar.high - sim.entry_px)


def _persist(
    store: Store,
    tape: Tape,
    clock: datetime,
    setups: list[_Setup],
    *,
    fresh: bool,
    git_sha: str = "replay",
    prior_equity: float | None = None,
) -> CycleResult:
    strategy_ids: dict[str, int] = {}
    signals = 0
    fills = 0
    taken = 0
    closed = 0
    pnl = 0.0
    ungated_r: list[float] = []
    gated_r: list[float] = []
    for setup in setups:
        signal = store.add(
            _signal(
                setup.candidate,
                clock=setup.when,
                reason=setup.skip_reason,
                fee_rate=_fee(tape, setup.candidate.market),
                slip_fraction=0.0,
                funding_rate=setup.sims[0].funding_rate if setup.sims else 0.0,
                strategy_id=_ensure_strategy(store, setup.candidate, strategy_ids),
                decision=setup.decision,
                gate=setup.verdict.verdict,
                git_sha=git_sha,
            )
        )
        signals += 1
        if signal.id is None:
            continue
        gate = store.add(
            GateDecision(
                signal_id=signal.id,
                verdict=setup.verdict.verdict,
                probability=setup.verdict.probability,
                reasons=list(setup.verdict.reasons),
                features=setup.gate_features,
                created_at=setup.when,
                strategy_id=signal.strategy_id,
                git_sha=git_sha,
            )
        )
        for sim in setup.sims:
            _store_shadow(store, signal.id, sim)
            fills += 1
            if sim.exit_px is not None:
                closed += 1
                pnl += sim.pnl
                bucket = gated_r if sim.book == "gated" else ungated_r
                bucket.append(sim.realised_r)
            if not sim.taken or gate.id is None:
                continue
            if not gate_allows_take(gate.verdict, store, setup.when, sim.candidate.market):
                continue
            _store_plan(store, signal.id, gate.id, sim, setup.when)
            taken += 1
    base = float(config.SIM_STARTING_EQUITY_USDC) if prior_equity is None else prior_equity
    equity = base + pnl
    store.add(
        Heartbeat(
            ts=clock,
            version=__version__,
            network=config.HL_NETWORK,
            ws_ages={"btc_book_s": _book_age(tape, clock)},
        )
    )
    store.add(Equity(ts=clock, shadow_equity=equity))
    blocked = not fresh and fills == 0
    store.add(
        RiskEvent(
            ts=clock,
            kind="stale_data" if blocked else "cycle",
            severity="WARN" if blocked else "INFO",
            detail="one simulated cycle; no orders",
            payload={"signals": signals, "shadow_fills": fills, "taken": taken, "closed": closed},
        )
    )
    from pb_engine.health import record_health

    record_health(store, as_of=clock)
    return CycleResult(
        now=clock,
        signals=signals,
        shadow_fills=fills,
        taken=taken,
        closed=closed,
        equity=equity,
        ungated_mean_r=_mean(ungated_r),
        gated_mean_r=_mean(gated_r),
    )


def _store_shadow(store: Store, signal_id: int, sim: _Sim) -> None:
    funding = sim.funding_usd
    if sim.exit_px is None:
        funding = funding_payment(
            notional=sim.entry_px * sim.size,
            hourly_rate=sim.funding_rate,
            hours=sim.candidate.hold_hours,
            side=sim.candidate.side,
        )
    hold = None
    if sim.exit_time is not None:
        hold = int((sim.exit_time - sim.entry_time).total_seconds())
    store.add(
        ShadowTrade(
            signal_id=signal_id,
            source="shadow",
            book=sim.book,
            entry_px=sim.entry_px,
            exit_px=sim.exit_px,
            fees=sim.entry_fee + sim.exit_fee,
            slippage=sim.slip_usd,
            funding=funding,
            realised_r=sim.realised_r if sim.exit_px is not None else None,
            mae=sim.mae,
            mfe=sim.mfe,
            hold_seconds=hold,
            exit_reason=sim.exit_reason,
        )
    )


def _store_plan(store: Store, signal_id: int, gate_id: int, sim: _Sim, when: datetime) -> None:
    plan = store.add(
        TradePlan(
            signal_id=signal_id,
            market=sim.candidate.market,
            side=sim.candidate.side,
            entry_px=sim.plan_entry_px,
            stop_px=sim.initial_stop,
            target_px=sim.target,
            size=sim.size,
            created_at=when,
            gate_decision_id=gate_id,
        )
    )
    if plan.id is None:
        return
    entry_side = sim.candidate.side
    exit_side = _other(entry_side)
    fills = [
        FillView("entry", entry_side, sim.entry_px, sim.size),
    ]
    store.add(
        Fill(
            source="shadow",
            px=sim.entry_px,
            size=sim.size,
            ts=sim.entry_time,
            fee=sim.entry_fee,
        )
    )
    if sim.exit_px is not None and sim.exit_time is not None:
        fills.append(FillView("exit", exit_side, sim.exit_px, sim.size))
        store.add(
            Fill(source="shadow", px=sim.exit_px, size=sim.size, ts=sim.exit_time, fee=sim.exit_fee)
        )
    judgement = judge(
        PlanView(
            side=entry_side,
            entry_px=sim.plan_entry_px,
            stop_px=sim.stop,
            target_px=sim.target,
            size=sim.size,
            intended_exit_px=sim.intended_exit_px,
            initial_stop_px=sim.initial_stop,
        ),
        fills,
        slip_cap=slip_cap(sim.candidate.market),
    )
    store.add(
        CloseEvent(
            plan_id=plan.id,
            outcome=judgement.outcome,
            legs=list(judgement.legs),
            unverified_gaps=list(judgement.gaps),
            created_at=sim.exit_time or when,
        )
    )
    if judgement.alert_severity is None:
        return
    store.add(
        AlertOutbox(
            severity=judgement.alert_severity,
            dedup_key=f"mismatch:{plan.id}",
            body="simulated close mismatch " + ",".join(judgement.gaps),
            created_at=sim.exit_time or when,
        )
    )


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
    """Return a block reason, a notional to shadow, and whether risk left a slot.

    A notional of ``None`` means do not walk. A slot means the taken book
    can still hold this name. The ranker's shadow label is not a block.
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
    if not sized.accepted:
        return sized.reason or Reason.BAD_BOOK, float(config.MIN_ORDER_USD), False
    return None, sized.notional_usd, True


def _signal(
    candidate: Candidate,
    *,
    clock: datetime,
    reason: str | None,
    fee_rate: float,
    slip_fraction: float,
    funding_rate: float,
    strategy_id: int,
    decision: str,
    gate: str,
    git_sha: str = "replay",
) -> Signal:
    ranked = rank_history(mean_r=0.0, n=0, std_r=0.0, weight=_unit(candidate.weight))
    if candidate.side == "long":
        paid = funding_rate if funding_rate > 0 else 0.0
    else:
        paid = -funding_rate if funding_rate < 0 else 0.0
    features = _features(candidate)
    features["gate"] = gate
    features["not_live"] = True
    features["rank_status"] = ranked.status
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
        decision=decision,
        features=features,
        skip_reason=reason,
        session_state=session_state(candidate.market, clock),
        git_sha=git_sha,
    )


def _ensure_strategy(store: Store, candidate: Candidate, ids: dict[str, int]) -> int:
    found = ids.get(candidate.strategy)
    if found is not None:
        return found
    existing = store.read(
        "SELECT id FROM hl_strategy WHERE name = ? AND version = ? AND asset_class = ?",
        (candidate.strategy, "1", "crypto"),
    )
    if existing:
        row_id = int(existing[0]["id"])
        ids[candidate.strategy] = row_id
        return row_id
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


def _fee(tape: Tape, market: str) -> float:
    meta = _meta(tape, market)
    return taker_fee(
        market,
        growth_mode=False if meta is None else meta.growth_mode,
        fee_scale=None if meta is None else meta.deployer_fee_scale,
    )


def _funding_rate(tape: Tape, market: str) -> float:
    for ctx in tape.ctxs:
        if ctx.name == market and ctx.funding is not None:
            return ctx.funding
    return _rate_as_of(tape, market, tape.captured_at)


def _rate_as_of(tape: Tape, market: str, when: datetime) -> float:
    rates = _rates_as_of(tape, market, when)
    if rates:
        return rates[-1]
    return 0.0


def _rates_as_of(tape: Tape, market: str, when: datetime) -> list[float]:
    cutoff = int(when.timestamp() * 1000) + 1
    return [row.rate for row in tape.funding if row.coin == market and row.time_ms <= cutoff]


def _touch(book: Book, side: str) -> float | None:
    levels = book.asks if side == "long" else book.bids
    if not levels:
        return None
    if side == "long":
        return min(level.px for level in levels)
    return max(level.px for level in levels)


def _spread(book: Book) -> float | None:
    if not book.bids or not book.asks:
        return None
    bid = max(level.px for level in book.bids)
    ask = min(level.px for level in book.asks)
    mid = (bid + ask) / 2
    if mid <= 0 or ask < bid:
        return None
    return (ask - bid) / mid


def _depth(book: Book, side: str) -> float:
    levels: tuple[BookLevel, ...] = book.asks if side == "long" else book.bids
    if side == "long":
        ordered = sorted(levels, key=lambda level: level.px)
    else:
        ordered = sorted(levels, key=lambda level: level.px, reverse=True)
    return sum(level.px * level.sz for level in ordered[:5])


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


def _recent_signal_keys(store: Store, since: datetime) -> set[tuple[str, str]]:
    rows = store.read(
        "SELECT st.name AS name, sig.market AS market FROM hl_signal sig "
        "JOIN hl_strategy st ON st.id = sig.strategy_id WHERE sig.ts >= ?",
        (since.isoformat(),),
    )
    return {(str(row["name"]), str(row["market"])) for row in rows}


def _open_risk_positions(store: Store) -> list[OpenPosition]:
    rows = store.read(
        "SELECT sig.market AS market, sig.side AS side, sig.entry_px AS entry_px, "
        "sig.stop_px AS stop_px, pl.size AS size "
        "FROM hl_shadow_trade sh "
        "JOIN hl_signal sig ON sig.id = sh.signal_id "
        "LEFT JOIN hl_trade_plan pl ON pl.signal_id = sh.signal_id "
        "WHERE sh.exit_px IS NULL AND sh.book = 'gated'",
    )
    found: list[OpenPosition] = []
    for row in rows:
        market = str(row["market"])
        cluster = cluster_name(market)
        entry = float(row["entry_px"] or 0)
        stop = float(row["stop_px"] or 0)
        size = float(row["size"] or 0)
        if cluster is None or entry <= 0:
            continue
        found.append(
            OpenPosition(
                market,
                entry * size,
                str(row["side"]),
                abs(entry - stop) / entry,
                cluster,
            )
        )
    return found


def _fresh(book: Book | None, now: datetime) -> bool:
    if book is None:
        return False
    report = assess(book_time=book_clock(book), stream_time=None, now=now, require_stream=False)
    return not report.blocks_new_entries


def _age_seconds(book: Book, now: datetime) -> float:
    return (now - book_clock(book)).total_seconds()


def _book_age(tape: Tape, now: datetime) -> float | None:
    book = _book(tape, "BTC")
    if book is None:
        return None
    return round(_age_seconds(book, now), 3)


def _open_positions(setups: list[_Setup]) -> list[OpenPosition]:
    found: list[OpenPosition] = []
    for setup in setups:
        for sim in setup.sims:
            if sim.exit_px is not None or sim.book != "ungated":
                continue
            if sim.candidate.entry <= 0:
                continue
            cluster = cluster_name(sim.candidate.market)
            if cluster is None:
                continue
            distance = abs(sim.entry_px - sim.initial_stop) / sim.entry_px
            found.append(
                OpenPosition(
                    sim.candidate.market,
                    sim.entry_px * sim.size,
                    sim.candidate.side,
                    distance,
                    cluster,
                )
            )
    return found


def _open_for(setups: list[_Setup], strategy: str, market: str, book: str) -> bool:
    for setup in setups:
        for sim in setup.sims:
            if sim.exit_px is not None or sim.book != book:
                continue
            if sim.candidate.strategy == strategy and sim.candidate.market == market:
                return True
    return False


def _other(side: str) -> str:
    return "short" if side == "long" else "long"


def _closed_pnl(setups: list[_Setup]) -> float:
    total = 0.0
    for setup in setups:
        for sim in setup.sims:
            if sim.exit_px is not None:
                total += sim.pnl
    return total


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)
