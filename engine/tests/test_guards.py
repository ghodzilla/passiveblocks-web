"""Stop, funding, pace, sessions, and the ranker."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from pb_engine import config
from pb_engine.ranker import rank_history
from pb_engine.risk import Reason, guard_candidate
from pb_engine.session import (
    commodity_session,
    hold_crosses_oil_roll,
    oil_roll_steps,
    session_block,
    stock_session,
)

ET = ZoneInfo("America/New_York")
T0 = datetime(2026, 11, 28, 12, tzinfo=UTC)


def _guard(**overrides: object) -> str | None:
    values: dict[str, object] = {
        "side": "long",
        "now": T0,
        "stop_distance_pct": 0.01,
        "round_trip_cost": 0.0009,
        "pred_edge_r": 1.0,
        "hold_hours": 24,
        "funding_rate": 0.0,
        "entries_today": 0,
        "consecutive_losses": 0,
        "last_loss_at": None,
    }
    values.update(overrides)
    return guard_candidate(**values)  # type: ignore[arg-type]


def test_stop_must_clear_three_round_trips() -> None:
    assert _guard(stop_distance_pct=0.002) == Reason.STOP_COST
    assert _guard(stop_distance_pct=0.0027) is None
    assert _guard(stop_distance_pct=0.01) is None


def test_funding_guard_uses_the_hold_and_the_pre_hour_window() -> None:
    blocked = _guard(funding_rate=0.001, hold_hours=24, stop_distance_pct=0.02, pred_edge_r=0.2)
    assert blocked == Reason.FUNDING_EDGE
    small = _guard(
        funding_rate=0.000001,
        hold_hours=24,
        stop_distance_pct=0.02,
        pred_edge_r=0.2,
    )
    assert small is None
    assert _guard(funding_rate=0.01, pred_edge_r=0) is None

    almost = T0.replace(minute=58, second=0)
    assert _guard(now=almost, funding_rate=0.0002, pred_edge_r=0) == Reason.FUNDING_BLACKOUT
    assert _guard(now=T0.replace(minute=57), funding_rate=0.0002, pred_edge_r=0) is None
    assert _guard(now=almost, funding_rate=0.0001, pred_edge_r=0) is None
    assert _guard(now=T0.replace(minute=0), funding_rate=0.0002, pred_edge_r=0) is None
    hour = T0.replace(minute=59)
    short = _guard(side="short", now=hour, funding_rate=-0.0002, pred_edge_r=0)
    assert short == Reason.FUNDING_BLACKOUT
    paid_by_longs = _guard(side="short", now=hour, funding_rate=0.0002, pred_edge_r=0)
    assert paid_by_longs is None


def test_entry_cap_and_loss_pause_read_config(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _guard(entries_today=29) is None
    assert _guard(entries_today=30) == Reason.ENTRY_CAP
    monkeypatch.setattr(config, "MAX_ENTRIES_PER_DAY", 1)
    assert _guard(entries_today=1) == Reason.ENTRY_CAP

    assert _guard(consecutive_losses=5, last_loss_at=T0) is None
    assert _guard(consecutive_losses=6, last_loss_at=None) == Reason.LOSS_PAUSE
    recent = T0 - timedelta(hours=5, minutes=59)
    assert _guard(consecutive_losses=6, last_loss_at=recent) == Reason.LOSS_PAUSE
    assert _guard(consecutive_losses=6, last_loss_at=T0 - timedelta(hours=6)) is None
    with pytest.raises(ValueError, match="timezone-aware"):
        _guard(now=datetime(2026, 11, 28, 12))


def test_ranker_starts_in_shadow_and_names_both_skip_reasons() -> None:
    cold = rank_history(mean_r=2, n=0, std_r=0)
    assert cold.status == "shadow"
    assert cold.skip_reason == "no_proven_edge"
    assert cold.lcb == 0

    proven = rank_history(mean_r=1, n=30, std_r=0)
    assert proven.edge == 0.5
    assert proven.lcb == 0.5
    assert proven.status == "live"
    assert proven.skip_reason is None
    assert proven.score == proven.pred_edge

    thin = rank_history(mean_r=0.1, n=30, std_r=0)
    assert thin.pred_edge == pytest.approx(0.05)
    assert thin.skip_reason == "negative_edge"

    noisy = rank_history(mean_r=1, n=30, std_r=100)
    assert noisy.lcb < 0
    assert noisy.skip_reason == "no_proven_edge"
    assert rank_history(mean_r=5, n=29, std_r=0).skip_reason == "no_proven_edge"


def test_stocks_are_flat_on_weekends_holidays_early_closes_and_earnings() -> None:
    saturday = datetime(2026, 11, 28, 12, tzinfo=ET)
    assert stock_session(saturday) == "INTERNAL"
    assert session_block("xyz:NVDA", saturday) == Reason.SESSION
    assert session_block("BTC", saturday) is None

    holiday = datetime(2026, 11, 26, 15, tzinfo=ET)
    assert stock_session(holiday) == "INTERNAL"
    assert commodity_session(holiday) == "EXTERNAL_OPEN"

    wednesday = datetime(2026, 12, 2, 15, tzinfo=ET)
    assert wednesday.weekday() == 2
    assert stock_session(wednesday) == "EXTERNAL_OPEN"
    assert session_block("xyz:NVDA", wednesday, earnings_on=wednesday.date()) == Reason.EARNINGS
    thursday = datetime(2026, 12, 3, 15, tzinfo=ET)
    assert session_block("NVDA", wednesday, earnings_on=thursday.date()) == Reason.EARNINGS
    assert session_block("NVDA", wednesday, earnings_on=thursday.date() + timedelta(days=7)) is None

    early = datetime(2026, 12, 24, 12, 29, tzinfo=ET)
    assert stock_session(early) == "EXTERNAL_OPEN"
    assert stock_session(datetime(2026, 12, 24, 12, 30, tzinfo=ET)) == "PRE_CLOSE"
    assert stock_session(datetime(2026, 12, 24, 13, tzinfo=ET)) == "INTERNAL"

    sunday = datetime(2026, 11, 29, 20, 4, tzinfo=ET)
    assert stock_session(sunday) == "INTERNAL"
    assert stock_session(datetime(2026, 11, 29, 20, 5, tzinfo=ET)) == "EXTERNAL_OPEN"
    friday = datetime(2026, 11, 27, 19, 29, tzinfo=ET)
    assert stock_session(friday) == "EXTERNAL_OPEN"
    assert stock_session(datetime(2026, 11, 27, 19, 30, tzinfo=ET)) == "PRE_CLOSE"
    assert session_block("xyz:SOXL", wednesday) == Reason.EXCLUDED


def test_oil_is_not_held_across_a_roll_and_commodities_flatten_for_the_weekend() -> None:
    steps = oil_roll_steps(2026, 10)
    assert len(steps) == 6
    assert steps[0].astimezone(ET) == datetime(2026, 10, 7, 17, 30, tzinfo=ET)
    assert steps[-1].astimezone(ET) == datetime(2026, 10, 14, 17, 30, tzinfo=ET)
    december = [step.astimezone(ET).date().isoformat() for step in oil_roll_steps(2026, 12)]
    assert "2026-12-25" not in december

    before = datetime(2026, 10, 7, 17, tzinfo=ET)
    after = datetime(2026, 10, 7, 18, tzinfo=ET)
    assert hold_crosses_oil_roll("xyz:CL", before, after) is True
    just_before = datetime(2026, 10, 7, 17, 29, tzinfo=ET)
    assert hold_crosses_oil_roll("xyz:BRENTOIL", before, just_before) is False
    assert hold_crosses_oil_roll("BTC", before, after) is False
    assert session_block("xyz:CL", before, hold_hours=2) == Reason.OIL_ROLL
    assert session_block("xyz:CL", datetime(2026, 10, 7, 17, 31, tzinfo=ET), hold_hours=1) is None

    friday = datetime(2026, 11, 27, 16, 29, tzinfo=ET)
    assert commodity_session(friday) == "EXTERNAL_OPEN"
    assert commodity_session(datetime(2026, 11, 27, 16, 30, tzinfo=ET)) == "INTERNAL"
    sunday = datetime(2026, 11, 29, 17, 59, tzinfo=ET)
    assert commodity_session(sunday) == "INTERNAL"
    assert commodity_session(datetime(2026, 11, 29, 18, tzinfo=ET)) == "EXTERNAL_OPEN"
    assert commodity_session(datetime(2026, 12, 25, 12, tzinfo=ET)) == "INTERNAL"
    assert session_block("xyz:GOLD", friday) is None
    assert session_block("xyz:GOLD", datetime(2026, 11, 27, 16, 30, tzinfo=ET)) == Reason.SESSION
