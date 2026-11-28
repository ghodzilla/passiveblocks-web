"""No fill, no done. Spec §9.2.

A plan is not closed because a timer or a mark says so. The outcome
follows the fills that sit next to the plan. This module does not send
an alert. The caller writes the outbox row when the severity is set.
"""

from __future__ import annotations

from dataclasses import dataclass


class CloseRefused(ValueError):
    """No fills were placed next to the plan, so there is no close."""


@dataclass(frozen=True, slots=True)
class PlanView:
    side: str
    entry_px: float
    stop_px: float
    target_px: float
    size: float
    intended_exit_px: float | None = None
    initial_stop_px: float | None = None


@dataclass(frozen=True, slots=True)
class FillView:
    """One simulated fill. ``role`` is ``entry`` or ``exit``."""

    role: str
    side: str
    px: float
    size: float


@dataclass(frozen=True, slots=True)
class CloseJudgement:
    outcome: str
    legs: tuple[dict[str, object], ...]
    gaps: tuple[str, ...]
    alert_severity: str | None


def judge(
    plan: PlanView,
    fills: tuple[FillView, ...] | list[FillView],
    *,
    slip_cap: float,
) -> CloseJudgement:
    """Line fills up against the plan. An empty fill list is refused."""

    if not fills:
        raise CloseRefused("no fills")
    if plan.side not in {"long", "short"}:
        raise ValueError("plan side must be long or short")
    if plan.size <= 0 or plan.entry_px <= 0 or slip_cap < 0:
        raise ValueError("plan size, entry, and slip cap must be usable")
    entry = [item for item in fills if item.role == "entry"]
    exit_fills = [item for item in fills if item.role == "exit"]
    legs = _legs(plan, entry, exit_fills)
    gaps: list[str] = []
    if plan.stop_px <= 0:
        return _mismatch(legs, ("missing_stop",), "CRITICAL")
    if not entry:
        return _mismatch(legs, ("missing_entry",), "WARN")
    entry_side = _net_side(entry)
    if entry_side != plan.side:
        return _mismatch(legs, ("wrong_side",), "CRITICAL")
    entry_size = sum(item.size for item in entry)
    entry_px = _average(entry)
    if not _near(entry_px, plan.entry_px, slip_cap):
        gaps.append("entry_outside_slip")
    if entry_size + 1e-9 < plan.size * 0.95:
        gaps.append("partial_entry")
    if not exit_fills:
        extra = tuple(gaps) + ("no_exit_fill",)
        if "entry_outside_slip" in gaps or "wrong_side" in gaps:
            return _mismatch(legs, extra, "WARN")
        return CloseJudgement("verify_more", legs, extra, None)
    exit_side = _net_side(exit_fills)
    expected = "short" if plan.side == "long" else "long"
    if exit_side != expected:
        return _mismatch(legs, tuple(gaps) + ("wrong_side",), "CRITICAL")
    exit_size = sum(item.size for item in exit_fills)
    exit_px = _average(exit_fills)
    references = [plan.stop_px, plan.target_px]
    if plan.intended_exit_px is not None and plan.intended_exit_px > 0:
        references.append(plan.intended_exit_px)
    if not any(_near(exit_px, price, slip_cap) for price in references):
        gaps.append("exit_outside_slip")
    if exit_size + 1e-9 < entry_size * 0.95:
        gaps.append("partial_exit")
    if "partial_exit" in gaps or "partial_entry" in gaps:
        return CloseJudgement("verify_more", legs, tuple(gaps), None)
    if gaps:
        severity = "CRITICAL" if "wrong_side" in gaps or "missing_stop" in gaps else "WARN"
        return _mismatch(legs, tuple(gaps), severity)
    return CloseJudgement("closed_as_planned", legs, (), None)


def _mismatch(
    legs: tuple[dict[str, object], ...],
    gaps: tuple[str, ...],
    severity: str,
) -> CloseJudgement:
    return CloseJudgement("mismatch", legs, gaps, severity)


def _legs(
    plan: PlanView,
    entry: list[FillView],
    exit_fills: list[FillView],
) -> tuple[dict[str, object], ...]:
    return (
        {
            "role": "entry",
            "plan_px": plan.entry_px,
            "plan_size": plan.size,
            "fill_px": _average(entry) if entry else None,
            "fill_size": sum(item.size for item in entry) if entry else 0.0,
            "fill": "missing" if not entry else "present",
        },
        {
            "role": "stop",
            "plan_px": plan.stop_px,
            "initial_stop_px": plan.initial_stop_px
            if plan.initial_stop_px is not None
            else plan.stop_px,
            "trailed": plan.initial_stop_px is not None
            and abs(plan.initial_stop_px - plan.stop_px) > 1e-9,
            "fill": "present" if exit_fills else "missing",
        },
        {
            "role": "target",
            "plan_px": plan.target_px,
            "fill_px": _average(exit_fills) if exit_fills else None,
            "fill_size": sum(item.size for item in exit_fills) if exit_fills else 0.0,
            "fill": "missing" if not exit_fills else "present",
        },
    )


def _average(fills: list[FillView]) -> float:
    size = sum(item.size for item in fills)
    if size <= 0:
        return 0.0
    return sum(item.px * item.size for item in fills) / size


def _net_side(fills: list[FillView]) -> str:
    return fills[0].side


def _near(price: float, plan: float, slip_cap: float) -> bool:
    if plan <= 0:
        return False
    return abs(price - plan) / plan <= slip_cap + 1e-12
