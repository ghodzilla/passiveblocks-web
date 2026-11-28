"""One live paper cycle. Public mainnet reads only.

The cycle, the gate, the closer, the risk limits, and the session
calendars are the ones the replay already uses. This module fetches
the tape and keeps the loop from opening the same idea twice in an
hour. It does not sign and it does not send an order.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime, timedelta

from pb_engine import config
from pb_engine.closer import FillView, PlanView, judge
from pb_engine.cycle import CycleResult, run_once
from pb_engine.database_url import database_url, redact
from pb_engine.exits import bar_exit, ratchet_stop
from pb_engine.market_data.freshness import book_time
from pb_engine.market_data.info import InfoClient
from pb_engine.market_data.replay import Tape
from pb_engine.market_data.types import CORE_COINS, Book, Candle, FundingPrint, PerpCtx, PerpMeta
from pb_engine.market_data.ws import PublicStream, SocketTimeout
from pb_engine.market_data.ws_live import connect_mainnet
from pb_engine.models import CloseEvent, Fill
from pb_engine.neon_sync import mirror
from pb_engine.shadow import slip_cap
from pb_engine.store import Store
from pb_engine.strategies.bars import bars_for
from pb_engine.universe import record_universe

_CAPTURE_SECONDS = 30.0


def run_live_cycle(
    db: str | None,
    *,
    seed: int = 1,
    now: datetime | None = None,
    client: InfoClient | None = None,
    connect=None,
) -> CycleResult:
    clock = datetime.now(UTC) if now is None else now
    if clock.tzinfo is None or clock.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    info = InfoClient() if client is None else client
    opener = connect_mainnet if connect is None else connect
    tape, stream_time = capture_tape(info, clock, opener)
    with Store(db) as store:
        record_universe(store, tape, clock.date())
        closed = advance_open(store, tape, clock)
        prior = store.latest_equity()
        if prior is None:
            prior = float(config.SIM_STARTING_EQUITY_USDC)
        result = run_once(
            store,
            tape,
            seed=seed,
            now=clock,
            replay_history=False,
            git_sha="live-paper",
            require_stream=True,
            stream_time=stream_time,
            prior_equity=prior + closed,
        )
        store.trim_series()
        _mirror(store)
        return result


def capture_tape(client: InfoClient, now: datetime, connect) -> tuple[Tape, datetime | None]:
    started = time.monotonic()

    def left() -> None:
        if time.monotonic() - started > _CAPTURE_SECONDS:
            raise TimeoutError("live capture took too long")

    left()
    meta: list[PerpMeta] = list(client.meta(""))
    ctxs: list[PerpCtx] = list(client.asset_ctxs(""))
    mids = dict(client.mids(""))
    left()
    try:
        meta.extend(client.meta("xyz"))
        ctxs.extend(client.asset_ctxs("xyz"))
        mids.update(client.mids("xyz"))
    except Exception:
        # The crypto cycle does not need the stock dex. The filter records
        # whatever arrived.
        pass
    books = [client.book(coin) for coin in CORE_COINS]
    candles: list[Candle] = []
    funding: list[FundingPrint] = []
    windows = {
        "15m": now - timedelta(days=2),
        "1h": now - timedelta(days=10),
        "4h": now - timedelta(days=45),
    }
    for coin in CORE_COINS:
        left()
        for interval, start in windows.items():
            candles.extend(client.candles(coin, interval, _millis(start), _millis(now)))
        funding.extend(client.funding(coin, _millis(now - timedelta(days=31)), _millis(now)))
    stream_time, streamed = _listen(connect, now)
    merged = {book.coin: book for book in books}
    merged.update(streamed)
    try:
        dex_index = dict(client.dex_indexes())
    except Exception:
        dex_index = {}
    tape = Tape(
        captured_at=now,
        dex_index=dex_index,
        meta=tuple(meta),
        ctxs=tuple(ctxs),
        mids=mids,
        books=tuple(merged.values()),
        candles=tuple(candles),
        funding=tuple(funding),
    )
    return tape, stream_time


def advance_open(store: Store, tape: Tape, now: datetime) -> float:
    """Walk bars forward on shadows that are still open. No orders."""

    rows = store.read(
        "SELECT sh.id AS shadow_id, sh.book AS book, sh.entry_px AS entry_px, "
        "sh.fees AS fees, sh.funding AS funding, sig.market AS market, "
        "sig.side AS side, sig.stop_px AS stop_px, sig.target_px AS target_px, "
        "sig.ts AS entry_ts, st.name AS strategy, st.params AS params, "
        "pl.id AS plan_id, pl.size AS size, pl.entry_px AS plan_entry "
        "FROM hl_shadow_trade sh "
        "JOIN hl_signal sig ON sig.id = sh.signal_id "
        "JOIN hl_strategy st ON st.id = sig.strategy_id "
        "LEFT JOIN hl_trade_plan pl ON pl.signal_id = sh.signal_id "
        "WHERE sh.exit_px IS NULL",
    )
    pnl = 0.0
    for row in rows:
        hit = _exit_hit(row, tape)
        if hit is None:
            continue
        price, reason, when, hold = hit
        entry = float(row["entry_px"] or 0)
        size = float(row["size"] or 0)
        trade = _trade_pnl(str(row["side"]), entry, price, size, row["fees"], row["funding"])
        risk = abs(entry - float(row["stop_px"] or 0)) * size
        realised = trade / risk if risk > 0 else None
        closed = store.finish_shadow(
            int(row["shadow_id"]),
            exit_px=price,
            exit_reason=reason,
            realised_r=realised,
            fees=None if row["fees"] is None else float(row["fees"]),
            funding=None if row["funding"] is None else float(row["funding"]),
            hold_seconds=hold,
        )
        if not closed:
            continue
        pnl += trade
        if row["plan_id"] is not None and str(row["book"]) == "gated" and size > 0:
            _close_plan(store, row, price, when, now)
    return pnl


def _listen(connect, now: datetime) -> tuple[datetime | None, dict[str, Book]]:
    try:
        stream = PublicStream(connect, coins=CORE_COINS)
        stream.open()
        for _ in range(6):
            try:
                stream.pump(now)
            except SocketTimeout:
                break
            if "BTC" in stream.books:
                break
    except Exception:
        return None, {}
    fresh = stream.last_received_at
    if fresh is None:
        return None, {}
    # A frame proves the socket is alive. The book age is still the
    # exchange timestamp, so a quiet book can block entries on its own.
    if stream.books:
        newest = max(book_time(book) for book in stream.books.values())
        if newest > fresh:
            fresh = newest
    return fresh, dict(stream.books)


def _exit_hit(row: dict[str, object], tape: Tape):
    market = str(row["market"])
    bars = bars_for(tape.candles, market, "1h")
    if not bars:
        return None
    entry_at = datetime.fromisoformat(str(row["entry_ts"]))
    if entry_at.tzinfo is None:
        return None
    params = _params(row.get("params"))
    hold = float(params.get("hold_hours") or 24)
    side = str(row["side"])
    stop = float(row["stop_px"])
    initial = stop
    entry = float(row["entry_px"] or 0)
    target = float(row["target_px"])
    seen: list = []
    strategy = str(row["strategy"])
    for bar in bars:
        seen.append(bar)
        if bar.open_time <= entry_at:
            continue
        stop = ratchet_stop(strategy, side, stop, entry, seen)
        hit = bar_exit(
            side=side,
            stop=stop,
            initial_stop=initial,
            target=target,
            entry_time=entry_at,
            hold_hours=hold,
            bar=bar,
        )
        if hit is None:
            continue
        hold_seconds = max(int((bar.open_time - entry_at).total_seconds()), 0)
        return hit.price, hit.reason, bar.open_time, hold_seconds
    return None


def _close_plan(
    store: Store,
    row: dict[str, object],
    price: float,
    when: datetime,
    now: datetime,
) -> None:
    side = str(row["side"])
    exit_side = "short" if side == "long" else "long"
    size = float(row["size"])
    entry = float(row["plan_entry"] or row["entry_px"] or 0)
    fills = (
        FillView("entry", side, entry, size),
        FillView("exit", exit_side, price, size),
    )
    judgement = judge(
        PlanView(
            side=side,
            entry_px=entry,
            stop_px=float(row["stop_px"]),
            target_px=float(row["target_px"]),
            size=size,
            intended_exit_px=price,
            initial_stop_px=float(row["stop_px"]),
        ),
        fills,
        slip_cap=slip_cap(str(row["market"])),
    )
    store.add(
        Fill(source="shadow", px=price, size=size, ts=when, fee=0.0)
    )
    store.add(
        CloseEvent(
            plan_id=int(row["plan_id"]),
            outcome=judgement.outcome,
            legs=list(judgement.legs),
            unverified_gaps=list(judgement.gaps),
            created_at=now,
        )
    )


def _trade_pnl(
    side: str,
    entry: float,
    price: float,
    size: float,
    fees: object,
    funding: object,
) -> float:
    if size <= 0 or entry <= 0:
        return 0.0
    sign = 1.0 if side == "long" else -1.0
    gross = sign * (price - entry) * size
    return gross - float(fees or 0) - float(funding or 0)


def _params(raw: object) -> dict[str, object]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw:
        return {}
    loaded = json.loads(raw)
    if isinstance(loaded, dict):
        return loaded
    return {}


def _mirror(store: Store) -> None:
    url = database_url()
    if not url:
        return
    try:
        mirror(store, url)
    except Exception as exc:
        sys.stderr.write("neon mirror skipped. " + redact(str(exc)) + "\n")


def _millis(when: datetime) -> int:
    return int(when.timestamp() * 1000)
