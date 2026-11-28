"""Row shapes for the engine tables.

These types are the column list. They do not open a database.
The store is the only writer.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

# Allowed values. The SQL checks must list these same tokens.
ASSET_CLASSES = ("crypto", "stock", "commodity")
STRATEGY_STATUSES = ("practice", "shadow", "live", "benched", "retired")
SIDES = ("long", "short")
SIGNAL_DECISIONS = ("trade", "skip", "hold")
GATE_VERDICTS = ("accept", "verify_more", "reject")
CLOSE_OUTCOMES = ("closed_as_planned", "verify_more", "mismatch")
SEVERITIES = ("CRITICAL", "WARN", "INFO")
SHADOW_BOOKS = ("gated", "ungated")
FILL_SOURCES = ("shadow", "exchange")
DAILY_SCORE_KINDS = ("strategy", "total")
CALIBRATION_KINDS = ("strategy", "engine")
WINDOW_VERDICTS = ("GO", "EXTEND", "NO-GO")

JsonObject = dict[str, Any]
JsonList = list[Any]


@dataclass(frozen=True, slots=True)
class Strategy:
    name: str
    version: str
    asset_class: str
    params: JsonObject
    params_hash: str
    status: str
    weight: float
    id: int | None = None
    frozen_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class MarketSnapshot:
    as_of: date
    market: str
    dex: str
    asset_class: str
    eligible: bool
    id: int | None = None
    volume_7d_median: float | None = None
    open_interest: float | None = None
    impact_spread_bps: float | None = None
    taker_fee: float | None = None
    maker_fee: float | None = None
    growth_mode: bool | None = None
    max_leverage: int | None = None
    session_type: str | None = None
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class Signal:
    ts: datetime
    strategy_id: int
    market: str
    side: str
    entry_px: float
    stop_px: float
    target_px: float
    pred_edge_r: float
    pred_win_prob: float
    pred_fee_bps: float
    pred_slippage_bps: float
    pred_funding_bps: float
    edge_lcb_r: float
    weight: float
    decision: str
    features: JsonObject
    id: int | None = None
    skip_reason: str | None = None
    session_state: str | None = None
    git_sha: str | None = None


@dataclass(frozen=True, slots=True)
class GateDecision:
    signal_id: int
    verdict: str
    probability: float
    reasons: JsonList
    features: JsonObject
    created_at: datetime
    id: int | None = None
    strategy_id: int | None = None
    git_sha: str | None = None


@dataclass(frozen=True, slots=True)
class TradePlan:
    signal_id: int
    market: str
    side: str
    entry_px: float
    stop_px: float
    target_px: float
    size: float
    created_at: datetime
    id: int | None = None
    gate_decision_id: int | None = None
    entry_cloid: str | None = None
    stop_cloid: str | None = None
    target_cloid: str | None = None


@dataclass(frozen=True, slots=True)
class CloseEvent:
    plan_id: int
    outcome: str
    legs: JsonList
    unverified_gaps: JsonList
    created_at: datetime
    id: int | None = None


@dataclass(frozen=True, slots=True)
class MarketBlacklist:
    market: str
    actor: str
    reason: str
    created_at: datetime
    id: int | None = None
    cleared_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class DeskHealth:
    as_of: datetime
    signal_escapes: int
    false_closes: int
    unnecessary_interruptions: int
    created_at: datetime
    id: int | None = None
    routing_accuracy: float | None = None
    recovery: JsonObject | None = None


@dataclass(frozen=True, slots=True)
class ShadowTrade:
    signal_id: int
    source: str
    book: str
    id: int | None = None
    entry_px: float | None = None
    exit_px: float | None = None
    fees: float | None = None
    slippage: float | None = None
    funding: float | None = None
    realised_r: float | None = None
    mae: float | None = None
    mfe: float | None = None
    hold_seconds: int | None = None
    exit_reason: str | None = None


@dataclass(frozen=True, slots=True)
class OrderRow:
    """A recorded order row. Writing one does not send it anywhere."""

    market: str
    side: str
    created_at: datetime
    id: int | None = None
    plan_id: int | None = None
    cloid: str | None = None
    oid: int | None = None
    order_type: str | None = None
    limit_px: float | None = None
    size: float | None = None
    status: str | None = None
    raw: JsonObject | None = None


@dataclass(frozen=True, slots=True)
class Fill:
    source: str
    px: float
    size: float
    ts: datetime
    id: int | None = None
    order_id: int | None = None
    fee: float | None = None
    closed_pnl: float | None = None
    raw: JsonObject | None = None


@dataclass(frozen=True, slots=True)
class PositionSnapshot:
    ts: datetime
    market: str
    size: float
    has_stop: bool
    id: int | None = None
    entry_px: float | None = None
    leverage: float | None = None
    liq_px: float | None = None
    upnl: float | None = None


@dataclass(frozen=True, slots=True)
class Equity:
    ts: datetime
    shadow_equity: float
    id: int | None = None
    testnet_equity: float | None = None


@dataclass(frozen=True, slots=True)
class Funding:
    ts: datetime
    market: str
    rate: float
    payment: float
    id: int | None = None
    position_size: float | None = None


@dataclass(frozen=True, slots=True)
class RiskEvent:
    ts: datetime
    kind: str
    severity: str
    detail: str
    id: int | None = None
    payload: JsonObject | None = None


@dataclass(frozen=True, slots=True)
class Heartbeat:
    ts: datetime
    version: str
    network: str
    id: int | None = None
    ws_ages: JsonObject | None = None


@dataclass(frozen=True, slots=True)
class Calibration:
    week_start: date
    kind: str
    id: int | None = None
    strategy_id: int | None = None
    slope: float | None = None
    intercept: float | None = None
    brier: float | None = None
    cost_model_error: float | None = None
    drift_stat: float | None = None
    action: str | None = None


@dataclass(frozen=True, slots=True)
class Window:
    started_at: datetime
    manifest_hash: str
    strategies: JsonList
    id: int | None = None
    ended_at: datetime | None = None
    verdict: str | None = None


@dataclass(frozen=True, slots=True)
class DailyScore:
    day: date
    kind: str
    n_trades: int
    id: int | None = None
    strategy_id: int | None = None
    mean_r: float | None = None
    pnl: float | None = None


@dataclass(frozen=True, slots=True)
class AlertOutbox:
    severity: str
    dedup_key: str
    body: str
    created_at: datetime
    id: int | None = None
    sent_at: datetime | None = None
    acked_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class Control:
    """The single control row. Flags only. It cannot change a risk limit."""

    halt: bool
    flatten_requested: bool
    drain: bool
    pause_new_entries: bool
    updated_at: datetime
    id: int = 1


INSERTABLE = (
    Strategy,
    MarketSnapshot,
    Signal,
    GateDecision,
    TradePlan,
    CloseEvent,
    MarketBlacklist,
    DeskHealth,
    ShadowTrade,
    OrderRow,
    Fill,
    PositionSnapshot,
    Equity,
    Funding,
    RiskEvent,
    Heartbeat,
    Calibration,
    Window,
    DailyScore,
    AlertOutbox,
)
