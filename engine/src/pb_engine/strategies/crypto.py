"""Five crypto strategies from the spec. They return a candidate or nothing.

The trail, the flip exit, and the funding-normal exit are recorded in
features. This module does not move a stop and does not mark a fill.
"""

from __future__ import annotations

import math

from pb_engine import config
from pb_engine.strategies.bars import Bar
from pb_engine.strategies.indicators import adx, atr, ema, percentile, stdev, vwap
from pb_engine.strategies.types import Candidate

PARAMS: dict[str, dict[str, float | int]] = {
    "trend_donchian_1h": {
        "donchian": 20,
        "ema": 50,
        "atr": 14,
        "atr_mult": 2,
        "trail_bars": 10,
        "hold_hours": 48,
        "target_r": 2,
    },
    "tsmom_4h": {
        "return_bars": 6,
        "atr": 14,
        "atr_mult": 2.5,
        "vol_mult": 1,
        "hold_hours": 72,
        "target_r": 2,
    },
    "meanrev_15m": {
        "vwap_bars": 20,
        "sigma": 2.5,
        "adx_n": 14,
        "adx_max": 20,
        "atr": 14,
        "atr_mult": 1.5,
        "hold_hours": 6,
    },
    "funding_fade_1h": {
        "atr": 14,
        "atr_mult": 2,
        "stall_bars": 3,
        "stall_atr": 0.5,
        "hold_hours": 24,
        "target_r": 1,
    },
    "utc_range_break": {
        "range_end_hour": 4,
        "volume_mult": 1.5,
        "atr": 14,
        "atr_mult": 2,
        "target_r": 1,
    },
}


def trend_donchian_1h(market: str, bars_1h: list[Bar], bars_4h: list[Bar]) -> Candidate | None:
    params = PARAMS["trend_donchian_1h"]
    window = int(params["donchian"])
    if len(bars_1h) < window + 1:
        return None
    slope = _ema_slope([bar.close for bar in bars_4h], int(params["ema"]))
    if slope is None or slope == 0:
        return None
    width = atr(bars_1h, int(params["atr"]))
    if width is None or width <= 0:
        return None
    prior = bars_1h[-(window + 1) : -1]
    last = bars_1h[-1]
    mult = float(params["atr_mult"])
    target_r = float(params["target_r"])
    if last.close > max(bar.high for bar in prior) and slope > 0:
        return _bracket(
            "trend_donchian_1h",
            market,
            "long",
            last.close,
            last.close - mult * width,
            target_r,
            float(params["hold_hours"]),
            {"slope": slope, "atr": width},
        )
    if last.close < min(bar.low for bar in prior) and slope < 0:
        return _bracket(
            "trend_donchian_1h",
            market,
            "short",
            last.close,
            last.close + mult * width,
            target_r,
            float(params["hold_hours"]),
            {"slope": slope, "atr": width},
        )
    return None


def tsmom_4h(market: str, bars_4h: list[Bar]) -> Candidate | None:
    params = PARAMS["tsmom_4h"]
    lookback = int(params["return_bars"])
    if len(bars_4h) < max(lookback + 1, int(params["atr"]) + 1):
        return None
    width = atr(bars_4h, int(params["atr"]))
    last = bars_4h[-1].close
    then = bars_4h[-(lookback + 1)].close
    if width is None or width <= 0 or last <= 0 or then <= 0:
        return None
    change = last / then - 1
    threshold = float(params["vol_mult"]) * width / last
    if abs(change) <= threshold:
        return None
    side = "long" if change > 0 else "short"
    reach = float(params["atr_mult"]) * width
    stop = last - reach if side == "long" else last + reach
    return _bracket(
        "tsmom_4h",
        market,
        side,
        last,
        stop,
        float(params["target_r"]),
        float(params["hold_hours"]),
        {"return": change, "threshold": threshold, "atr": width},
    )


def meanrev_15m(market: str, bars_15m: list[Bar], bars_1h: list[Bar]) -> Candidate | None:
    params = PARAMS["meanrev_15m"]
    window = int(params["vwap_bars"])
    if len(bars_15m) < window:
        return None
    regime = adx(bars_1h, int(params["adx_n"]))
    if regime is None or regime >= float(params["adx_max"]):
        return None
    recent = bars_15m[-window:]
    center = vwap(recent)
    noise = stdev([bar.close for bar in recent])
    width = atr(bars_15m, int(params["atr"]))
    last = bars_15m[-1].close
    if center is None or noise is None or noise <= 0 or width is None or width <= 0 or last <= 0:
        return None
    band = float(params["sigma"]) * noise
    if last > center + band:
        side = "short"
        stop = last + float(params["atr_mult"]) * width
    elif last < center - band:
        side = "long"
        stop = last - float(params["atr_mult"]) * width
    else:
        return None
    built = _candidate(
        "meanrev_15m",
        market,
        side,
        last,
        stop,
        center,
        float(params["hold_hours"]),
        {"vwap": center, "stdev": noise, "adx": regime, "atr": width},
    )
    if built is None:
        return None
    risk = abs(built.entry - built.stop)
    return _replace_edge(built, abs(built.target - built.entry) / risk)


def funding_fade_1h(market: str, rates: list[float], bars_1h: list[Bar]) -> Candidate | None:
    params = PARAMS["funding_fade_1h"]
    if len(rates) < config.FUNDING_LOOKBACK_HOURS:
        return None
    width = atr(bars_1h, int(params["atr"]))
    if width is None or width <= 0 or len(bars_1h) < int(params["stall_bars"]):
        return None
    recent = bars_1h[-int(params["stall_bars"]) :]
    span = max(bar.high for bar in recent) - min(bar.low for bar in recent)
    if span >= float(params["stall_atr"]) * width:
        return None
    window = rates[-config.FUNDING_LOOKBACK_HOURS :]
    last_rate = window[-1]
    if last_rate >= percentile(window, 0.95):
        side = "short"
    elif last_rate <= percentile(window, 0.05):
        side = "long"
    else:
        return None
    entry = bars_1h[-1].close
    reach = float(params["atr_mult"]) * width
    stop = entry + reach if side == "short" else entry - reach
    return _bracket(
        "funding_fade_1h",
        market,
        side,
        entry,
        stop,
        float(params["target_r"]),
        float(params["hold_hours"]),
        {"funding": last_rate, "span": span, "atr": width},
    )


def utc_range_break(market: str, bars_15m: list[Bar]) -> Candidate | None:
    params = PARAMS["utc_range_break"]
    if len(bars_15m) < int(params["atr"]) + 1:
        return None
    last = bars_15m[-1]
    day = last.open_time.date()
    if last.open_time.hour < int(params["range_end_hour"]):
        return None
    opening = [
        bar
        for bar in bars_15m
        if bar.open_time.date() == day and bar.open_time.hour < int(params["range_end_hour"])
    ]
    if not opening:
        return None
    average = sum(bar.volume for bar in opening) / len(opening)
    if last.volume <= float(params["volume_mult"]) * average:
        return None
    width = atr(bars_15m, int(params["atr"]))
    if width is None or width <= 0:
        return None
    high = max(bar.high for bar in opening)
    low = min(bar.low for bar in opening)
    cap = float(params["atr_mult"]) * width
    if last.close > high:
        stop = max(low, last.close - cap)
        side = "long"
    elif last.close < low:
        stop = min(high, last.close + cap)
        side = "short"
    else:
        return None
    end = last.open_time.replace(hour=23, minute=59, second=0, microsecond=0)
    hold = (end - last.open_time).total_seconds() / 3600
    if hold <= 0:
        return None
    return _bracket(
        "utc_range_break",
        market,
        side,
        last.close,
        stop,
        float(params["target_r"]),
        hold,
        {"range_high": high, "range_low": low, "atr": width},
    )


def _ema_slope(values: list[float], n: int) -> float | None:
    if len(values) < n + 1:
        return None
    current = ema(values, n)
    previous = ema(values[:-1], n)
    if current is None or previous is None:
        return None
    return current - previous


def _bracket(
    strategy: str,
    market: str,
    side: str,
    entry: float,
    stop: float,
    target_r: float,
    hold_hours: float,
    features: dict[str, object],
) -> Candidate | None:
    if side == "long":
        target = entry + target_r * (entry - stop)
    else:
        target = entry - target_r * (stop - entry)
    built = _candidate(strategy, market, side, entry, stop, target, hold_hours, features)
    if built is None:
        return None
    return _replace_edge(built, target_r)


def _candidate(
    strategy: str,
    market: str,
    side: str,
    entry: float,
    stop: float,
    target: float,
    hold_hours: float,
    features: dict[str, object],
) -> Candidate | None:
    if side not in {"long", "short"} or entry <= 0 or hold_hours <= 0:
        return None
    if not all(math.isfinite(value) for value in (entry, stop, target, hold_hours)):
        return None
    if side == "long" and not stop < entry:
        return None
    if side == "short" and not stop > entry:
        return None
    distance = abs(entry - stop) / entry
    if distance <= 0 or distance > 1:
        return None
    return Candidate(
        strategy=strategy,
        market=market,
        side=side,
        entry=entry,
        stop=stop,
        target=target,
        pred_edge_r=0.0,
        hold_hours=hold_hours,
        features=features,
    )


def _replace_edge(candidate: Candidate, edge: float) -> Candidate | None:
    if not math.isfinite(edge):
        return None
    return Candidate(
        strategy=candidate.strategy,
        market=candidate.market,
        side=candidate.side,
        entry=candidate.entry,
        stop=candidate.stop,
        target=candidate.target,
        pred_edge_r=edge,
        hold_hours=candidate.hold_hours,
        features=candidate.features,
    )
