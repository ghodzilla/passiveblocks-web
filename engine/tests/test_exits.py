"""Exit rules, including the Donchian trail."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from pb_engine.exits import bar_exit, funding_normalised, ratchet_stop, scheduled_exit
from pb_engine.strategies.bars import Bar


def _bar(hour: int, open_: float, high: float, low: float, close: float) -> Bar:
    return Bar(datetime(2026, 1, 5, hour, tzinfo=UTC), open_, high, low, close, 1.0)


def test_donchian_trail_tightens_and_does_not_loosen() -> None:
    bars = [_bar(hour, 100, 101, 96 + hour * 0.1, 100) for hour in range(10)]
    tightened = ratchet_stop("trend_donchian_1h", "long", 90, 100, bars)
    assert tightened > 90
    assert tightened < 100
    loosened = ratchet_stop(
        "trend_donchian_1h",
        "long",
        tightened,
        100,
        [_bar(1, 100, 101, 80, 100)],
    )
    assert loosened == tightened
    untouched = ratchet_stop("tsmom_4h", "long", 90, 100, bars)
    assert untouched == 90


def test_a_short_trail_moves_down_only() -> None:
    bars = [_bar(hour, 100, 104, 99, 100) for hour in range(10)]
    tightened = ratchet_stop("trend_donchian_1h", "short", 110, 100, bars)
    assert tightened < 110
    assert tightened > 100
    later = ratchet_stop(
        "trend_donchian_1h",
        "short",
        tightened,
        100,
        [_bar(1, 100, 120, 99, 100)],
    )
    assert later == tightened


def test_the_trail_does_not_cross_the_entry() -> None:
    above = [_bar(hour, 101, 102, 100.5, 101) for hour in range(10)]
    assert ratchet_stop("trend_donchian_1h", "long", 90, 100, above) == 90


def test_stop_wins_when_the_same_bar_also_hits_the_target() -> None:
    hit = bar_exit(
        side="long",
        stop=96,
        initial_stop=96,
        target=110,
        entry_time=datetime(2026, 1, 5, tzinfo=UTC),
        hold_hours=48,
        bar=_bar(2, 100, 112, 95, 108),
    )
    assert hit is not None
    assert hit.reason == "stop"
    assert hit.price == 96


def test_a_gap_through_the_stop_fills_at_the_open() -> None:
    hit = bar_exit(
        side="long",
        stop=96,
        initial_stop=90,
        target=110,
        entry_time=datetime(2026, 1, 5, tzinfo=UTC),
        hold_hours=48,
        bar=_bar(2, 94, 97, 93, 95),
    )
    assert hit is not None
    assert hit.reason == "trail"
    assert hit.price == 94


def test_time_stop_uses_the_close() -> None:
    opened = datetime(2026, 1, 5, tzinfo=UTC)
    hit = bar_exit(
        side="long",
        stop=90,
        initial_stop=90,
        target=120,
        entry_time=opened,
        hold_hours=1,
        bar=Bar(opened + timedelta(hours=1), 100, 101, 99, 100.5, 1),
    )
    assert hit is not None
    assert hit.reason == "time"
    assert hit.price == 100.5


def test_flip_is_not_used_when_funding_history_is_short() -> None:
    assert funding_normalised([0.001, 0.002], 0.001) is False
    bar = _bar(23, 100, 101, 99, 100)
    hit = scheduled_exit("utc_range_break", bar, flip=False, funding_done=False)
    assert hit is not None
    assert hit.reason == "session_end"
