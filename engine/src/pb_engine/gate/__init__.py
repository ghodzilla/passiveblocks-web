"""Independent signal gate. Spec §9.1.

A strategy does not import this package. The same facts always return
the same verdict and the same probability. There is no learned model.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from pb_engine import config
from pb_engine.session import session_kind

_VERDICTS = ("accept", "verify_more", "reject")


@dataclass(frozen=True, slots=True)
class GateFacts:
    """Everything the gate is allowed to see. It does not fetch data."""

    stale: bool
    session_open: bool
    spread: float | None
    stop_distance_pct: float
    round_trip_cost: float
    pred_edge_r: float
    edge_lcb_r: float
    book_depth_usd: float | None
    order_notional_usd: float
    book_age_s: float | None
    market: str
    warmup_incomplete: bool = False
    first_bar: bool = False
    funding_cost_r: float = 0.0


@dataclass(frozen=True, slots=True)
class GateVerdict:
    verdict: str
    probability: float
    reasons: tuple[str, ...]

    def __post_init__(self) -> None:
        if self.verdict not in _VERDICTS:
            raise ValueError("verdict must be accept, verify_more, or reject")
        if not 0 <= self.probability <= 1:
            raise ValueError("probability must be in 0..1")


def decide(facts: GateFacts) -> GateVerdict:
    """One verdict. Reject wins over verify_more, which wins over accept."""

    hard = _hard_reasons(facts)
    if hard:
        return GateVerdict("reject", config.GATE_REJECT_PROBABILITY, tuple(hard))
    soft = _soft_reasons(facts)
    if soft:
        return GateVerdict("verify_more", config.GATE_VERIFY_PROBABILITY, tuple(soft))
    return GateVerdict("accept", _accept_probability(facts), ("ok",))


def allow_take(verdict: str | None) -> bool:
    """A missing verdict is a signal escape and must not be taken."""

    return verdict == "accept"


def expire(verdict: GateVerdict, bars_unresolved: int) -> GateVerdict:
    """A verify_more that is still open after ``VERIFY_BARS`` becomes a reject.

    On an hourly tape, three bars is later than thirty minutes, so the
    bar count is the bound that matters.
    """

    if verdict.verdict != "verify_more" or bars_unresolved < config.VERIFY_BARS:
        return verdict
    reasons = verdict.reasons
    if "verify_expired" not in reasons:
        reasons = reasons + ("verify_expired",)
    return GateVerdict("reject", config.GATE_REJECT_PROBABILITY, reasons)


def spread_hard_cap(market: str) -> float:
    kind = session_kind(market)
    root = market.split(":")[-1].upper() if isinstance(market, str) else ""
    if root == "SOL":
        return config.SPREAD_HARD_SOL
    if kind == "crypto":
        return config.SPREAD_HARD_BTC_ETH
    if kind == "index":
        return config.SPREAD_HARD_INDEX
    if kind in {"metals", "energy"}:
        return config.SPREAD_HARD_COMMODITY
    return config.SPREAD_HARD_STOCK


def _hard_reasons(facts: GateFacts) -> list[str]:
    reasons: list[str] = []
    if facts.stale:
        reasons.append("stale")
    if not facts.session_open:
        reasons.append("session")
    minimum = config.STOP_COST_MULTIPLE * facts.round_trip_cost
    if facts.stop_distance_pct < minimum:
        reasons.append("stop_vs_cost")
    if facts.pred_edge_r <= 0:
        reasons.append("non_positive_edge")
    cap = spread_hard_cap(facts.market)
    if facts.spread is not None and facts.spread > cap:
        reasons.append("spread")
    need = config.DEPTH_MULTIPLE * facts.order_notional_usd
    depth_known = facts.book_depth_usd is not None and facts.order_notional_usd > 0
    if depth_known and facts.book_depth_usd is not None and facts.book_depth_usd < need:
        reasons.append("depth")
    if facts.pred_edge_r > 0 and facts.funding_cost_r > config.FUNDING_OF_EDGE * facts.pred_edge_r:
        reasons.append("funding_edge")
    return reasons


def _soft_reasons(facts: GateFacts) -> list[str]:
    reasons: list[str] = []
    if facts.book_depth_usd is None or facts.spread is None:
        reasons.append("missing_book")
    if facts.warmup_incomplete:
        reasons.append("warmup")
    if facts.first_bar:
        reasons.append("first_bar")
    cap = spread_hard_cap(facts.market)
    warn = cap * config.SPREAD_WARN_FRACTION
    if facts.spread is not None and warn < facts.spread <= cap:
        reasons.append("spread_warn")
    if 0 < facts.pred_edge_r <= config.BORDERLINE_EDGE_R:
        reasons.append("borderline_edge")
    warn_funding = config.FUNDING_WARN_OF_EDGE * facts.pred_edge_r
    if facts.pred_edge_r > 0 and facts.funding_cost_r > warn_funding:
        reasons.append("funding_large")
    return reasons


def _accept_probability(facts: GateFacts) -> float:
    """Confidence in an accept. Not a win probability and not a draw.

    Starts at 0.55. A positive lower bound adds up to 0.20. Spread and
    book age subtract up to 0.15 and 0.10. Depth at or above the minimum
    adds up to 0.15.
    """

    lcb_term = min(max(facts.edge_lcb_r, 0.0), 1.0) * 0.2
    cap = spread_hard_cap(facts.market)
    spread_term = 0.0
    if facts.spread is not None and cap > 0:
        spread_term = min(max(facts.spread, 0.0) / cap, 1.0) * 0.15
    age_term = 0.0
    if facts.book_age_s is not None and config.BOOK_STALE_SECONDS > 0:
        age = max(facts.book_age_s, 0.0) / config.BOOK_STALE_SECONDS
        age_term = min(age, 1.0) * 0.1
    depth_term = 0.0
    need = config.DEPTH_MULTIPLE * facts.order_notional_usd
    if facts.book_depth_usd is not None and need > 0:
        depth_term = min(max(facts.book_depth_usd, 0.0) / need, 1.0) * 0.15
    raw = 0.55 + lcb_term - spread_term - age_term + depth_term
    if not math.isfinite(raw):
        return 0.0
    return min(1.0, max(0.0, raw))
