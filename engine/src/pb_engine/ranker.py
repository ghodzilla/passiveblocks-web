"""Shrink a strategy's past results and decide shadow versus live.

Nothing here places a trade. A live rank is still only a candidate.
This cycle has no gate, so a live rank is not a taken fill.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from pb_engine import config


@dataclass(frozen=True, slots=True)
class Rank:
    edge: float
    lcb: float
    pred_edge: float
    score: float
    status: str
    skip_reason: str | None


def rank_history(
    *,
    mean_r: float,
    n: int,
    std_r: float,
    extra_cost_r: float = 0.0,
    weight: float = 1.0,
    calib_factor: float = 1.0,
) -> Rank:
    """Spec §7.2. ``n`` below 30, or an LCB that is not positive, is shadow."""

    mean = _number("mean_r", mean_r)
    extra = _number("extra_cost_r", extra_cost_r)
    scale = _number("weight", weight)
    calib = _number("calib_factor", calib_factor)
    spread = _number("std_r", std_r)
    if isinstance(n, bool) or not isinstance(n, int) or n < 0:
        raise ValueError("n must be an int >= 0")
    if spread < 0 or scale < 0 or scale > 1 or calib < 0:
        raise ValueError("std, weight, and calibration are out of range")
    if n == 0:
        edge = 0.0
        lcb = 0.0
    else:
        edge = mean * n / (n + config.RANK_SHRINK_N)
        lcb = edge - config.LCB_Z * spread / math.sqrt(n)
    pred = edge * calib - extra
    score = pred * scale
    if n < config.RANK_MIN_N or lcb <= 0:
        return Rank(edge, lcb, pred, score, "shadow", "no_proven_edge")
    if pred <= config.MIN_PRED_EDGE_R:
        return Rank(edge, lcb, pred, score, "shadow", "negative_edge")
    return Rank(edge, lcb, pred, score, "live", None)


def _number(label: str, value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{label} must be a number")
    if not math.isfinite(value):
        raise ValueError(f"{label} must be finite")
    return float(value)
