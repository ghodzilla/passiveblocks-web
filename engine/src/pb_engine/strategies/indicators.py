"""Small indicators used by the frozen strategies. No packages beyond the stdlib."""

from __future__ import annotations

import math

from pb_engine.strategies.bars import Bar


def atr(bars: list[Bar], n: int) -> float | None:
    if n <= 0 or len(bars) < n:
        return None
    ranges = _true_range(bars)
    value = sum(ranges[:n]) / n
    for item in ranges[n:]:
        value = (value * (n - 1) + item) / n
    if not math.isfinite(value) or value < 0:
        return None
    return value


def ema(values: list[float], n: int) -> float | None:
    if n <= 0 or len(values) < n:
        return None
    weight = 2 / (n + 1)
    value = sum(values[:n]) / n
    for item in values[n:]:
        value = item * weight + value * (1 - weight)
    if not math.isfinite(value):
        return None
    return value


def adx(bars: list[Bar], n: int) -> float | None:
    if n <= 0 or len(bars) <= n:
        return None
    plus: list[float] = []
    minus: list[float] = []
    ranges: list[float] = []
    for index in range(1, len(bars)):
        up = bars[index].high - bars[index - 1].high
        down = bars[index - 1].low - bars[index].low
        plus.append(up if up > down and up > 0 else 0.0)
        minus.append(down if down > up and down > 0 else 0.0)
        previous = bars[index - 1].close
        ranges.append(
            max(
                bars[index].high - bars[index].low,
                abs(bars[index].high - previous),
                abs(bars[index].low - previous),
            )
        )
    if len(ranges) < n:
        return None
    smooth_range = _wilder(ranges, n)
    smooth_plus = _wilder(plus, n)
    smooth_minus = _wilder(minus, n)
    dx: list[float] = []
    for total, up_sum, down_sum in zip(smooth_range, smooth_plus, smooth_minus, strict=True):
        if total <= 0:
            dx.append(0.0)
            continue
        plus_di = 100 * up_sum / total
        minus_di = 100 * down_sum / total
        denom = plus_di + minus_di
        dx.append(0.0 if denom <= 0 else 100 * abs(plus_di - minus_di) / denom)
    if len(dx) < n:
        return None
    value = sum(dx[:n]) / n
    for item in dx[n:]:
        value = (value * (n - 1) + item) / n
    if not math.isfinite(value):
        return None
    return value


def vwap(bars: list[Bar]) -> float | None:
    if not bars:
        return None
    priced = 0.0
    volume = 0.0
    for bar in bars:
        typical = (bar.high + bar.low + bar.close) / 3
        if bar.volume > 0:
            priced += typical * bar.volume
            volume += bar.volume
    if volume > 0:
        return priced / volume
    typicals = [(bar.high + bar.low + bar.close) / 3 for bar in bars]
    return sum(typicals) / len(typicals)


def stdev(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    var = sum((item - mean) ** 2 for item in values) / (len(values) - 1)
    if var < 0:
        return None
    return math.sqrt(var)


def percentile(values: list[float], q: float) -> float:
    if not values or not 0 <= q <= 1:
        raise ValueError("percentile needs values and a q in 0..1")
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    pos = q * (len(ordered) - 1)
    low = int(pos)
    high = min(low + 1, len(ordered) - 1)
    frac = pos - low
    return ordered[low] * (1 - frac) + ordered[high] * frac


def _true_range(bars: list[Bar]) -> list[float]:
    ranges = [bars[0].high - bars[0].low]
    for index in range(1, len(bars)):
        previous = bars[index - 1].close
        ranges.append(
            max(
                bars[index].high - bars[index].low,
                abs(bars[index].high - previous),
                abs(bars[index].low - previous),
            )
        )
    return ranges


def _wilder(values: list[float], n: int) -> list[float]:
    total = sum(values[:n])
    out = [total]
    for item in values[n:]:
        total = total - total / n + item
        out.append(total)
    return out
