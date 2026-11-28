"""Local SQLite store for Stage 1.

This module is the only code that knows the database. The Postgres
migration under db/hl/ is a file for later review. Nothing here reads
it, opens a network connection, or sends an order.

JSON values are stored as text. Timestamps are ISO-8601 text.
"""

from __future__ import annotations

import json
import sqlite3
import types
from dataclasses import fields, replace
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, TypeVar, Union, get_args, get_origin, get_type_hints

from pb_engine.models import (
    AlertOutbox,
    Calibration,
    CloseEvent,
    Control,
    DailyScore,
    DeskHealth,
    Equity,
    Fill,
    Funding,
    GateDecision,
    Heartbeat,
    MarketBlacklist,
    MarketSnapshot,
    OrderRow,
    PositionSnapshot,
    RiskEvent,
    ShadowTrade,
    Signal,
    Strategy,
    TradePlan,
    Window,
)

Row = (
    Strategy
    | MarketSnapshot
    | Signal
    | GateDecision
    | TradePlan
    | CloseEvent
    | MarketBlacklist
    | DeskHealth
    | ShadowTrade
    | OrderRow
    | Fill
    | PositionSnapshot
    | Equity
    | Funding
    | RiskEvent
    | Heartbeat
    | Calibration
    | Window
    | DailyScore
    | AlertOutbox
    | Control
)
RowT = TypeVar("RowT", bound=Row)

DEFAULT_SQLITE_PATH = Path("var") / "pb-engine.sqlite3"

# Log tables only. The shadow book is not in this set.
_PRUNE_TABLES = frozenset({"hl_desk_health", "hl_risk_event", "hl_alert_outbox"})
_PRUNE_KEEP = {"hl_desk_health": 48, "hl_risk_event": 200, "hl_alert_outbox": 100}
_PRUNE_TIGHT = {"hl_desk_health": 12, "hl_risk_event": 50, "hl_alert_outbox": 20}
_DB_CAP_BYTES = 32 * 1024 * 1024

_INSERT_TABLE: dict[type[Any], str] = {
    Strategy: "hl_strategy",
    MarketSnapshot: "hl_market",
    Signal: "hl_signal",
    GateDecision: "hl_gate_decision",
    TradePlan: "hl_trade_plan",
    CloseEvent: "hl_close_event",
    MarketBlacklist: "hl_market_blacklist",
    DeskHealth: "hl_desk_health",
    ShadowTrade: "hl_shadow_trade",
    OrderRow: "hl_order",
    Fill: "hl_fill",
    PositionSnapshot: "hl_position",
    Equity: "hl_equity",
    Funding: "hl_funding",
    RiskEvent: "hl_risk_event",
    Heartbeat: "hl_heartbeat",
    Calibration: "hl_calibration",
    Window: "hl_window",
    DailyScore: "hl_daily_score",
    AlertOutbox: "hl_alert_outbox",
}
_READ_TABLE: dict[type[Any], str] = {**_INSERT_TABLE, Control: "hl_control"}

# Close-enough mapping of the Postgres schema. JSON is text. No schema name.
SQLITE_DDL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS hl_strategy (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock', 'commodity')),
    params TEXT NOT NULL,
    params_hash TEXT NOT NULL,
    frozen_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('practice', 'shadow', 'live', 'benched', 'retired')),
    weight REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
    UNIQUE (name, version, asset_class)
);

CREATE TABLE IF NOT EXISTS hl_market (
    id INTEGER PRIMARY KEY,
    as_of TEXT NOT NULL,
    market TEXT NOT NULL,
    dex TEXT NOT NULL,
    asset_class TEXT NOT NULL CHECK (asset_class IN ('crypto', 'stock', 'commodity')),
    volume_7d_median REAL,
    open_interest REAL,
    impact_spread_bps REAL,
    taker_fee REAL,
    maker_fee REAL,
    growth_mode INTEGER CHECK (growth_mode IS NULL OR growth_mode IN (0, 1)),
    max_leverage INTEGER,
    session_type TEXT,
    eligible INTEGER NOT NULL CHECK (eligible IN (0, 1)),
    reason TEXT,
    UNIQUE (as_of, market)
);

CREATE TABLE IF NOT EXISTS hl_signal (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    strategy_id INTEGER NOT NULL REFERENCES hl_strategy (id),
    market TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    entry_px REAL NOT NULL,
    stop_px REAL NOT NULL,
    target_px REAL NOT NULL,
    pred_edge_r REAL NOT NULL,
    pred_win_prob REAL NOT NULL,
    pred_fee_bps REAL NOT NULL,
    pred_slippage_bps REAL NOT NULL,
    pred_funding_bps REAL NOT NULL,
    edge_lcb_r REAL NOT NULL,
    weight REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
    decision TEXT NOT NULL CHECK (decision IN ('trade', 'skip', 'hold')),
    skip_reason TEXT,
    features TEXT NOT NULL,
    session_state TEXT,
    git_sha TEXT
);

CREATE INDEX IF NOT EXISTS hl_signal_strategy_ts ON hl_signal (strategy_id, ts);

CREATE TABLE IF NOT EXISTS hl_gate_decision (
    id INTEGER PRIMARY KEY,
    signal_id INTEGER NOT NULL REFERENCES hl_signal (id),
    strategy_id INTEGER REFERENCES hl_strategy (id),
    verdict TEXT NOT NULL CHECK (verdict IN ('accept', 'verify_more', 'reject')),
    probability REAL NOT NULL CHECK (probability >= 0 AND probability <= 1),
    reasons TEXT NOT NULL,
    features TEXT NOT NULL,
    git_sha TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_gate_decision_signal ON hl_gate_decision (signal_id);

CREATE TABLE IF NOT EXISTS hl_trade_plan (
    id INTEGER PRIMARY KEY,
    signal_id INTEGER NOT NULL REFERENCES hl_signal (id),
    gate_decision_id INTEGER REFERENCES hl_gate_decision (id),
    market TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    entry_px REAL NOT NULL,
    stop_px REAL NOT NULL,
    target_px REAL NOT NULL,
    size REAL NOT NULL,
    entry_cloid TEXT,
    stop_cloid TEXT,
    target_cloid TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_trade_plan_signal ON hl_trade_plan (signal_id);

CREATE TABLE IF NOT EXISTS hl_close_event (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES hl_trade_plan (id),
    outcome TEXT NOT NULL CHECK (outcome IN ('closed_as_planned', 'verify_more', 'mismatch')),
    legs TEXT NOT NULL,
    unverified_gaps TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_close_event_plan ON hl_close_event (plan_id);

CREATE TABLE IF NOT EXISTS hl_market_blacklist (
    id INTEGER PRIMARY KEY,
    market TEXT NOT NULL,
    actor TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    cleared_at TEXT
);

CREATE TABLE IF NOT EXISTS hl_desk_health (
    id INTEGER PRIMARY KEY,
    as_of TEXT NOT NULL,
    routing_accuracy REAL,
    signal_escapes INTEGER NOT NULL,
    false_closes INTEGER NOT NULL,
    unnecessary_interruptions INTEGER NOT NULL,
    recovery TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hl_shadow_trade (
    id INTEGER PRIMARY KEY,
    signal_id INTEGER NOT NULL REFERENCES hl_signal (id),
    source TEXT NOT NULL CHECK (source IN ('shadow')),
    book TEXT NOT NULL CHECK (book IN ('gated', 'ungated')),
    entry_px REAL,
    exit_px REAL,
    fees REAL,
    slippage REAL,
    funding REAL,
    realised_r REAL,
    mae REAL,
    mfe REAL,
    hold_seconds INTEGER,
    exit_reason TEXT
);

CREATE INDEX IF NOT EXISTS hl_shadow_trade_signal ON hl_shadow_trade (signal_id);

CREATE TABLE IF NOT EXISTS hl_order (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER REFERENCES hl_trade_plan (id),
    cloid TEXT,
    oid INTEGER,
    market TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    order_type TEXT,
    limit_px REAL,
    size REAL,
    status TEXT,
    raw TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_order_plan ON hl_order (plan_id);

CREATE TABLE IF NOT EXISTS hl_fill (
    id INTEGER PRIMARY KEY,
    order_id INTEGER REFERENCES hl_order (id),
    source TEXT NOT NULL CHECK (source IN ('shadow', 'exchange')),
    px REAL NOT NULL,
    size REAL NOT NULL,
    fee REAL,
    closed_pnl REAL,
    raw TEXT,
    ts TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_fill_order ON hl_fill (order_id);

CREATE TABLE IF NOT EXISTS hl_position (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    market TEXT NOT NULL,
    size REAL NOT NULL,
    entry_px REAL,
    leverage REAL,
    liq_px REAL,
    upnl REAL,
    has_stop INTEGER NOT NULL CHECK (has_stop IN (0, 1))
);

CREATE INDEX IF NOT EXISTS hl_position_ts ON hl_position (ts, market);

CREATE TABLE IF NOT EXISTS hl_equity (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    testnet_equity REAL,
    shadow_equity REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS hl_equity_ts ON hl_equity (ts);

CREATE TABLE IF NOT EXISTS hl_funding (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    market TEXT NOT NULL,
    position_size REAL,
    rate REAL NOT NULL,
    payment REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS hl_risk_event (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    kind TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARN', 'INFO')),
    detail TEXT NOT NULL,
    payload TEXT
);

CREATE TABLE IF NOT EXISTS hl_heartbeat (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    version TEXT NOT NULL,
    network TEXT NOT NULL,
    ws_ages TEXT
);

CREATE TABLE IF NOT EXISTS hl_calibration (
    id INTEGER PRIMARY KEY,
    strategy_id INTEGER REFERENCES hl_strategy (id),
    week_start TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('strategy', 'engine')),
    slope REAL,
    intercept REAL,
    brier REAL,
    cost_model_error REAL,
    drift_stat REAL,
    action TEXT,
    CHECK (
        (kind = 'strategy' AND strategy_id IS NOT NULL)
        OR (kind = 'engine' AND strategy_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS hl_calibration_strategy
    ON hl_calibration (strategy_id, week_start)
    WHERE kind = 'strategy';

CREATE UNIQUE INDEX IF NOT EXISTS hl_calibration_engine
    ON hl_calibration (week_start)
    WHERE kind = 'engine';

CREATE TABLE IF NOT EXISTS hl_window (
    id INTEGER PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    manifest_hash TEXT NOT NULL,
    strategies TEXT NOT NULL,
    verdict TEXT CHECK (verdict IS NULL OR verdict IN ('GO', 'EXTEND', 'NO-GO'))
);

CREATE TABLE IF NOT EXISTS hl_daily_score (
    id INTEGER PRIMARY KEY,
    day TEXT NOT NULL,
    strategy_id INTEGER REFERENCES hl_strategy (id),
    kind TEXT NOT NULL CHECK (kind IN ('strategy', 'total')),
    n_trades INTEGER NOT NULL,
    mean_r REAL,
    pnl REAL,
    CHECK (
        (kind = 'strategy' AND strategy_id IS NOT NULL)
        OR (kind = 'total' AND strategy_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS hl_daily_score_strategy
    ON hl_daily_score (day, strategy_id)
    WHERE kind = 'strategy';

CREATE UNIQUE INDEX IF NOT EXISTS hl_daily_score_total
    ON hl_daily_score (day)
    WHERE kind = 'total';

CREATE TABLE IF NOT EXISTS hl_alert_outbox (
    id INTEGER PRIMARY KEY,
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARN', 'INFO')),
    dedup_key TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    acked_at TEXT
);

CREATE INDEX IF NOT EXISTS hl_alert_outbox_unsent
    ON hl_alert_outbox (created_at)
    WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS hl_control (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    halt INTEGER NOT NULL CHECK (halt IN (0, 1)),
    flatten_requested INTEGER NOT NULL CHECK (flatten_requested IN (0, 1)),
    drain INTEGER NOT NULL CHECK (drain IN (0, 1)),
    pause_new_entries INTEGER NOT NULL CHECK (pause_new_entries IN (0, 1)),
    updated_at TEXT NOT NULL
);

PRAGMA user_version = 1;
"""


class Store:
    """A Stage 1 database. The default file is ``var/pb-engine.sqlite3``."""

    default_path = DEFAULT_SQLITE_PATH

    def __init__(self, path: str | Path | None = None) -> None:
        self.path = _sqlite_path(self.default_path if path is None else path)
        self._conn = sqlite3.connect(self.path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.executescript(SQLITE_DDL)
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.execute("PRAGMA user_version = 1")
        self._seed_control()
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def table_names(self) -> set[str]:
        rows = self._conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        return {str(row[0]) for row in rows}

    def column_names(self, table: str) -> list[str]:
        return list(self.column_types(table))

    def column_types(self, table: str) -> dict[str, str]:
        if table not in set(_READ_TABLE.values()):
            raise ValueError("unknown table")
        rows = self._conn.execute(f"PRAGMA table_info({table})")
        return {str(row[1]): str(row[2]) for row in rows}

    def schema_version(self) -> int:
        row = self._conn.execute("PRAGMA user_version").fetchone()
        return int(row[0])

    def __enter__(self) -> Store:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def add(self, row: RowT) -> RowT:
        if isinstance(row, Control):
            raise TypeError("control is a single seeded row; use update_control")
        table = _INSERT_TABLE[type(row)]
        columns: list[str] = []
        values: list[Any] = []
        for field in fields(row):
            value = getattr(row, field.name)
            if value is None:
                continue
            columns.append(field.name)
            values.append(_to_sql(value))
        placeholders = ", ".join("?" for _ in columns)
        names = ", ".join(columns)
        sql = f"INSERT INTO {table} ({names}) VALUES ({placeholders})"
        try:
            cursor = self._conn.execute(sql, values)
            self._conn.commit()
        except sqlite3.IntegrityError:
            self._conn.rollback()
            raise
        loaded = self.get(type(row), int(cursor.lastrowid or 0))
        if loaded is None:
            raise RuntimeError("inserted row could not be read back")
        return loaded

    def read(self, sql: str, params: tuple[object, ...] = ()) -> list[dict[str, object]]:
        """Run one SELECT. Anything else is refused."""

        if not isinstance(sql, str) or ";" in sql:
            raise ValueError("read expects one select")
        words = sql.lower().split()
        if not words or words[0] != "select":
            raise ValueError("read expects one select")
        banned = {"insert", "update", "delete", "drop", "alter", "create", "replace"}
        if banned.intersection(words):
            raise ValueError("read expects one select")
        cursor = self._conn.execute(sql, params)
        return [{str(key): row[key] for key in row.keys()} for row in cursor.fetchall()]

    def prune(self) -> dict[str, int]:
        """Drop old health, risk, and outbox rows, then vacuum.

        The shadow book is left as it is. This only keeps the log tables small.
        """

        removed = self._trim_logs(_PRUNE_KEEP)
        self._conn.commit()
        self._conn.execute("VACUUM")
        if self._db_bytes() > _DB_CAP_BYTES:
            removed_tight = self._trim_logs(_PRUNE_TIGHT)
            for name, count in removed_tight.items():
                removed[name] = removed.get(name, 0) + count
            self._conn.commit()
            self._conn.execute("VACUUM")
        removed["db_bytes"] = self._db_bytes()
        return removed

    def _trim_logs(self, keep: dict[str, int]) -> dict[str, int]:
        removed: dict[str, int] = {}
        for table, limit in keep.items():
            if table not in _PRUNE_TABLES:
                raise ValueError("prune refuses this table")
            before = int(self._conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            self._conn.execute(
                f"DELETE FROM {table} WHERE id NOT IN "
                f"(SELECT id FROM {table} ORDER BY id DESC LIMIT ?)",
                (limit,),
            )
            after = int(self._conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            removed[table] = before - after
        return removed

    def _db_bytes(self) -> int:
        if str(self.path) == ":memory:":
            return 0
        return int(Path(self.path).stat().st_size)

    def get(self, kind: type[RowT], row_id: int) -> RowT | None:
        table = _READ_TABLE[kind]
        cursor = self._conn.execute(f"SELECT * FROM {table} WHERE id = ?", (row_id,))
        found = cursor.fetchone()
        if found is None:
            return None
        return _from_row(kind, found)

    def get_control(self) -> Control:
        row = self.get(Control, 1)
        if row is None:
            raise RuntimeError("control row is missing")
        return row

    def update_control(
        self,
        *,
        halt: bool | None = None,
        flatten_requested: bool | None = None,
        drain: bool | None = None,
        pause_new_entries: bool | None = None,
    ) -> Control:
        """Change control flags. This cannot change a risk limit."""

        updates = {
            "halt": halt,
            "flatten_requested": flatten_requested,
            "drain": drain,
            "pause_new_entries": pause_new_entries,
        }
        chosen = {name: value for name, value in updates.items() if value is not None}
        for name, value in chosen.items():
            if not isinstance(value, bool):
                raise TypeError(f"{name} must be a bool")
        if not chosen:
            return self.get_control()
        current = self.get_control()
        updated_at = datetime.now(UTC)
        merged = replace(current, **chosen, updated_at=updated_at)
        assignments = ", ".join(f"{name} = ?" for name in (*chosen, "updated_at"))
        parameters = [_to_sql(getattr(merged, name)) for name in (*chosen, "updated_at")]
        self._conn.execute(
            f"UPDATE hl_control SET {assignments} WHERE id = 1",
            parameters,
        )
        self._conn.commit()
        return self.get_control()

    def _seed_control(self) -> None:
        self._conn.execute(
            """
            INSERT OR IGNORE INTO hl_control (
                id, halt, flatten_requested, drain, pause_new_entries, updated_at
            ) VALUES (1, 0, 0, 0, 0, ?)
            """,
            (_to_sql(datetime.now(UTC)),),
        )


def _sqlite_path(path: str | Path) -> str:
    text = str(path)
    if "://" in text or text.startswith("postgres"):
        raise ValueError("Stage 1 store is a local sqlite file")
    if text == ":memory:":
        return text
    target = Path(text)
    if target.exists() and target.is_dir():
        raise ValueError("sqlite path is a directory")
    target.parent.mkdir(parents=True, exist_ok=True)
    return str(target)


def _to_sql(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timestamps must be timezone-aware")
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return value


def _from_row[RowT: Row](kind: type[RowT], row: sqlite3.Row) -> RowT:
    hints = get_type_hints(kind)
    data = {field.name: _from_sql(row[field.name], hints[field.name]) for field in fields(kind)}
    return kind(**data)


def _from_sql(raw: Any, hint: Any) -> Any:
    if raw is None:
        return None
    inner = _unwrap(hint)
    if inner is bool:
        return bool(raw)
    if inner is int:
        return int(raw)
    if inner is float:
        return float(raw)
    if inner is datetime:
        value = datetime.fromisoformat(raw)
        if value.tzinfo is None:
            raise ValueError("stored timestamp is missing a timezone")
        return value
    if inner is date:
        return date.fromisoformat(raw)
    if get_origin(inner) in {dict, list}:
        loaded = json.loads(raw)
        if not isinstance(loaded, get_origin(inner)):
            raise ValueError("stored json has the wrong shape")
        return loaded
    if inner is str:
        return str(raw)
    raise TypeError(f"unsupported column type {hint!r}")


def _unwrap(hint: Any) -> Any:
    origin = get_origin(hint)
    if origin is Union or origin is types.UnionType:
        args = [arg for arg in get_args(hint) if arg is not type(None)]
        if len(args) == 1:
            return args[0]
    return hint
