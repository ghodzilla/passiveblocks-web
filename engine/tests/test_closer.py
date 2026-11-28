"""A plan is closed only when the fills sit next to it."""

from __future__ import annotations

import pytest

from pb_engine.closer import CloseRefused, FillView, PlanView, judge


def _plan(**overrides: object) -> PlanView:
    base: dict[str, object] = {
        "side": "long",
        "entry_px": 100.0,
        "stop_px": 95.0,
        "target_px": 110.0,
        "size": 1.0,
    }
    base.update(overrides)
    return PlanView(**base)  # type: ignore[arg-type]


def test_matching_fills_close_as_planned() -> None:
    result = judge(
        _plan(),
        (
            FillView("entry", "long", 100.0, 1.0),
            FillView("exit", "short", 95.0, 1.0),
        ),
        slip_cap=0.001,
    )
    assert result.outcome == "closed_as_planned"
    assert result.gaps == ()
    assert result.alert_severity is None


def test_a_missing_exit_stays_open() -> None:
    result = judge(
        _plan(),
        (FillView("entry", "long", 100.0, 1.0),),
        slip_cap=0.001,
    )
    assert result.outcome == "verify_more"
    assert "no_exit_fill" in result.gaps
    assert result.alert_severity is None


def test_a_partial_exit_stays_open() -> None:
    result = judge(
        _plan(),
        (
            FillView("entry", "long", 100.0, 1.0),
            FillView("exit", "short", 95.0, 0.4),
        ),
        slip_cap=0.001,
    )
    assert result.outcome == "verify_more"
    assert "partial_exit" in result.gaps


def test_the_wrong_side_is_a_critical_mismatch() -> None:
    result = judge(
        _plan(),
        (
            FillView("entry", "long", 100.0, 1.0),
            FillView("exit", "long", 95.0, 1.0),
        ),
        slip_cap=0.001,
    )
    assert result.outcome == "mismatch"
    assert result.alert_severity == "CRITICAL"
    assert "wrong_side" in result.gaps


def test_a_missing_stop_is_a_critical_mismatch() -> None:
    result = judge(
        _plan(stop_px=0.0),
        (FillView("entry", "long", 100.0, 1.0),),
        slip_cap=0.001,
    )
    assert result.outcome == "mismatch"
    assert result.alert_severity == "CRITICAL"
    assert "missing_stop" in result.gaps


def test_a_far_exit_is_a_warning_mismatch() -> None:
    result = judge(
        _plan(),
        (
            FillView("entry", "long", 100.0, 1.0),
            FillView("exit", "short", 80.0, 1.0),
        ),
        slip_cap=0.001,
    )
    assert result.outcome == "mismatch"
    assert result.alert_severity == "WARN"
    assert "exit_outside_slip" in result.gaps


def test_no_fills_are_refused() -> None:
    with pytest.raises(CloseRefused):
        judge(_plan(), (), slip_cap=0.001)


def test_a_trailed_stop_can_still_close_as_planned() -> None:
    result = judge(
        _plan(stop_px=97.0, initial_stop_px=95.0),
        (
            FillView("entry", "long", 100.0, 1.0),
            FillView("exit", "short", 97.0, 1.0),
        ),
        slip_cap=0.001,
    )
    assert result.outcome == "closed_as_planned"
    stop = next(leg for leg in result.legs if leg["role"] == "stop")
    assert stop["trailed"] is True
    assert stop["initial_stop_px"] == 95.0
