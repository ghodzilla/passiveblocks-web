"""Exit rules stored on the strategies, including the Donchian trail.

The trail ratchets the stop. It does not widen it. A bar that touches
the stop and the target exits at the stop.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from pb_engine import config
from pb_engine.strategies.bars import Bar
from pb_engine.strategies.indicators import percentile


@dataclass(frozen=True, slots=True)
class ExitHit:
    price: float
    reason: str


def ratchet_stop(
    strategy: str,
    side: str,
    stop: float,
    entry: float,
    bars: list[Bar],
) -> float:
    """Move a Donchian stop to the 10-bar extreme when that tightens it."""

    if strategy != "trend_donchian_1h" or len(bars) < 1 or entry <= 0:
        return stop
    window = bars[-config.TRAIL_BARS :]
    if side == "long":
        extreme = min(bar.low for bar in window)
        if extreme < entry:
            return max(stop, extreme)
        return stop
    extreme = max(bar.high for bar in window)
    if extreme > entry:
        return min(stop, extreme)
    return stop


def bar_exit(
    *,
    side: str,
    stop: float,
    initial_stop: float,
    target: float,
    entry_time: datetime,
    hold_hours: float,
    bar: Bar,
) -> ExitHit | None:
    """Stop, target, or time stop on one bar. Flip is decided by the caller."""

    if side == "long":
        if bar.low <= stop:
            price = min(bar.open, stop)
            reason = "trail" if stop > initial_stop else "stop"
            return ExitHit(price, reason)
        if bar.high >= target:
            return ExitHit(target, "target")
    else:
        if bar.high >= stop:
            price = max(bar.open, stop)
            reason = "trail" if stop < initial_stop else "stop"
            return ExitHit(price, reason)
        if bar.low <= target:
            return ExitHit(target, "target")
    deadline = entry_time + timedelta(hours=hold_hours)
    if bar.open_time >= deadline:
        return ExitHit(bar.close, "time")
    return None


def scheduled_exit(
    strategy: str,
    bar: Bar,
    *,
    flip: bool,
    funding_done: bool,
) -> ExitHit | None:
    """Exits that are not a stop or a target. The stop is checked first."""

    if flip:
        return ExitHit(bar.close, "flip")
    if funding_done:
        return ExitHit(bar.close, "funding_normal")
    if strategy == "utc_range_break" and bar.open_time.hour >= 23:
        return ExitHit(bar.close, "session_end")
    return None


def funding_normalised(rates: list[float], latest: float) -> bool:
    """True when the latest rate sits inside the middle of a full window.

    A short history does not count. The fade rule needs the configured
    lookback before this exit is allowed to fire.
    """

    need = config.FUNDING_LOOKBACK_HOURS
    if len(rates) < need:
        return False
    window = rates[-need:]
    return percentile(window, 0.05) < latest < percentile(window, 0.95)
