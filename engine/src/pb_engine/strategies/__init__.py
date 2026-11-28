"""Strategy ideas for one cycle. No store, no gate, no orders."""

from __future__ import annotations

from pb_engine.market_data.replay import Tape
from pb_engine.market_data.types import CORE_COINS
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


def propose(tape: Tape, *, seed: int = 1) -> list[Candidate]:
    found: list[Candidate] = []
    for coin in CORE_COINS:
        bars_15m = bars_for(tape.candles, coin, "15m")
        bars_1h = bars_for(tape.candles, coin, "1h")
        bars_4h = bars_for(tape.candles, coin, "4h")
        rates = [row.rate for row in tape.funding if row.coin == coin]
        for candidate in (
            trend_donchian_1h(coin, bars_1h, bars_4h),
            tsmom_4h(coin, bars_4h),
            meanrev_15m(coin, bars_15m, bars_1h),
            funding_fade_1h(coin, rates, bars_1h),
            utc_range_break(coin, bars_15m),
        ):
            if candidate is not None:
                found.append(candidate)
    price = _price(tape, "BTC")
    held = btc_hold_1x(price) if price is not None else None
    if held is not None:
        found.append(held)
    picked = CORE_COINS[seed % len(CORE_COINS)]
    picked_price = _price(tape, picked)
    baseline = None
    if picked_price is not None:
        baseline = random_entry(picked_price, market=picked, seed=seed)
    if baseline is not None:
        found.append(baseline)
    return found


def _price(tape: Tape, coin: str) -> float | None:
    closes = [row.close for row in tape.candles if row.coin == coin and row.interval == "1h"]
    if closes and closes[-1] > 0:
        return closes[-1]
    mid = tape.mids.get(coin)
    if mid is not None and mid > 0:
        return mid
    return None
