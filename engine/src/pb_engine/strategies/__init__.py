"""Strategy ideas for one cycle. No store, no gate, no orders."""

from __future__ import annotations

from datetime import datetime

from pb_engine.market_data.replay import Tape
from pb_engine.market_data.types import CORE_COINS, Candle, FundingPrint
from pb_engine.strategies.bars import bars_for
from pb_engine.strategies.baselines import btc_hold_1x, random_entry
from pb_engine.strategies.crypto import (
    funding_fade_1h,
    meanrev_15m,
    trend_donchian_1h,
    tsmom_4h,
    utc_range_break,
)
from pb_engine.strategies.types import Candidate


def propose(
    tape: Tape,
    *,
    seed: int = 1,
    as_of: datetime | None = None,
    include_baselines: bool = True,
) -> list[Candidate]:
    candles, funding = _slice(tape, as_of)
    found: list[Candidate] = []
    for coin in CORE_COINS:
        bars_15m = bars_for(candles, coin, "15m")
        bars_1h = bars_for(candles, coin, "1h")
        bars_4h = bars_for(candles, coin, "4h")
        rates = [row.rate for row in funding if row.coin == coin]
        for candidate in (
            trend_donchian_1h(coin, bars_1h, bars_4h),
            tsmom_4h(coin, bars_4h),
            meanrev_15m(coin, bars_15m, bars_1h),
            funding_fade_1h(coin, rates, bars_1h),
            utc_range_break(coin, bars_15m),
        ):
            if candidate is not None:
                found.append(candidate)
    if not include_baselines:
        return found
    price = _price(candles, tape, "BTC")
    held = btc_hold_1x(price) if price is not None else None
    if held is not None:
        found.append(held)
    picked = CORE_COINS[seed % len(CORE_COINS)]
    picked_price = _price(candles, tape, picked)
    baseline = None
    if picked_price is not None:
        baseline = random_entry(picked_price, market=picked, seed=seed)
    if baseline is not None:
        found.append(baseline)
    return found


def _slice(
    tape: Tape,
    as_of: datetime | None,
) -> tuple[tuple[Candle, ...], tuple[FundingPrint, ...]]:
    if as_of is None:
        return tape.candles, tape.funding
    cutoff = int(as_of.timestamp() * 1000) + 1
    candles = tuple(row for row in tape.candles if row.open_time_ms <= cutoff)
    funding = tuple(row for row in tape.funding if row.time_ms <= cutoff)
    return candles, funding


def _price(candles: tuple[Candle, ...], tape: Tape, coin: str) -> float | None:
    closes = [row.close for row in candles if row.coin == coin and row.interval == "1h"]
    if closes and closes[-1] > 0:
        return closes[-1]
    mid = tape.mids.get(coin)
    if mid is not None and mid > 0:
        return mid
    return None
