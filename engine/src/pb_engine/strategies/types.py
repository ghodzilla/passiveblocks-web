"""A strategy idea. Emitting one does not accept it or size it."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Candidate:
    strategy: str
    market: str
    side: str
    entry: float
    stop: float
    target: float
    pred_edge_r: float
    hold_hours: float
    features: dict[str, object]
    baseline: bool = False
    weight: float = 1.0
