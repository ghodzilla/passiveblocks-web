"""Copy the local SQLite book into schema hl.

SQLite stays the store the cycle writes. This module is a best-effort
copy. A missing URL or a failed connection leaves the local rows in
place. It does not execute the migration file and it does not create
roles or grants.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

from pb_engine.database_url import redact
from pb_engine.store import Store

Connect = Callable[[str], Any]

_TABLES = (
    "hl_strategy",
    "hl_market",
    "hl_signal",
    "hl_gate_decision",
    "hl_trade_plan",
    "hl_close_event",
    "hl_market_blacklist",
    "hl_desk_health",
    "hl_shadow_trade",
    "hl_order",
    "hl_fill",
    "hl_position",
    "hl_equity",
    "hl_funding",
    "hl_risk_event",
    "hl_heartbeat",
    "hl_calibration",
    "hl_window",
    "hl_daily_score",
    "hl_alert_outbox",
)

_CONFLICT = {
    "hl_strategy": ("name", "version", "asset_class"),
    "hl_market": ("as_of", "market"),
}

_FK = {
    "hl_signal": {"strategy_id": "hl_strategy"},
    "hl_gate_decision": {"signal_id": "hl_signal", "strategy_id": "hl_strategy"},
    "hl_trade_plan": {"signal_id": "hl_signal", "gate_decision_id": "hl_gate_decision"},
    "hl_close_event": {"plan_id": "hl_trade_plan"},
    "hl_shadow_trade": {"signal_id": "hl_signal"},
    "hl_order": {"plan_id": "hl_trade_plan"},
    "hl_fill": {"order_id": "hl_order"},
    "hl_calibration": {"strategy_id": "hl_strategy"},
    "hl_daily_score": {"strategy_id": "hl_strategy"},
}

_JSON = frozenset(
    {
        "params",
        "features",
        "reasons",
        "legs",
        "unverified_gaps",
        "recovery",
        "raw",
        "ws_ages",
        "payload",
        "strategies",
    }
)
_BOOL = frozenset(
    {
        "eligible",
        "growth_mode",
        "halt",
        "flatten_requested",
        "drain",
        "pause_new_entries",
        "has_stop",
    }
)
_DATES = {
    "hl_market": frozenset({"as_of"}),
    "hl_daily_score": frozenset({"day"}),
    "hl_calibration": frozenset({"week_start"}),
}
_TIMES = frozenset(
    {
        "ts",
        "created_at",
        "updated_at",
        "frozen_at",
        "sent_at",
        "acked_at",
        "cleared_at",
        "as_of",
        "started_at",
        "ended_at",
    }
)


class MirrorError(RuntimeError):
    """A copy failed. The message has already been redacted."""


def mirror(store: Store, url: str, connect: Connect | None = None) -> int:
    if str(store.path) == ":memory:":
        raise MirrorError("mirror needs the sqlite file")
    opener = connect if connect is not None else _connect
    try:
        conn = opener(url)
    except Exception as exc:
        raise MirrorError(redact(str(exc))) from None
    written = 0
    try:
        mapping = store.mirror_map()
        for table in _TABLES:
            written += _copy_table(store, conn, table, mapping)
        written += _copy_control(store, conn)
        _update_closed_shadows(store, conn, mapping)
        conn.commit()
    except MirrorError:
        _rollback(conn)
        raise
    except Exception as exc:
        _rollback(conn)
        raise MirrorError(redact(str(exc))) from None
    finally:
        close = getattr(conn, "close", None)
        if close is not None:
            close()
    store.save_mirror_map(mapping)
    return written


def _connect(url: str) -> Any:
    import psycopg

    return psycopg.connect(url, connect_timeout=5)


def _copy_table(store: Store, conn: Any, table: str, mapping: dict[tuple[str, int], int]) -> int:
    rows = store.read(f"SELECT * FROM {table} ORDER BY id")
    written = 0
    for row in rows:
        sqlite_id = int(row["id"])
        key = (table, sqlite_id)
        if key in mapping and table not in _CONFLICT:
            continue
        remote = _insert(conn, table, row, mapping)
        if remote is None:
            continue
        mapping[key] = remote
        written += 1
    return written


def _insert(
    conn: Any,
    table: str,
    row: dict[str, object],
    mapping: dict[tuple[str, int], int],
) -> int | None:
    columns: list[str] = []
    values: list[object] = []
    for name, raw in row.items():
        if name == "id" or not _plain(name):
            continue
        mapped = _fk(table, name, raw, mapping)
        if mapped is _MISSING:
            return None
        columns.append(name)
        values.append(_adapt(table, name, mapped))
    if not columns:
        return None
    names = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    conflict = _CONFLICT.get(table)
    if conflict is None:
        sql = f"INSERT INTO hl.{table} ({names}) VALUES ({placeholders}) RETURNING id"
    else:
        keys = ", ".join(conflict)
        updates = ", ".join(
            f"{name} = EXCLUDED.{name}" for name in columns if name not in conflict
        )
        sql = (
            f"INSERT INTO hl.{table} ({names}) VALUES ({placeholders}) "
            f"ON CONFLICT ({keys}) DO UPDATE SET {updates} RETURNING id"
        )
    cursor = conn.execute(sql, values)
    found = cursor.fetchone()
    if found is None:
        return None
    return int(found[0])


_MISSING = object()


def _fk(table: str, column: str, raw: object, mapping: dict[tuple[str, int], int]) -> object:
    target = _FK.get(table, {}).get(column)
    if target is None or raw is None:
        return raw
    remote = mapping.get((target, int(raw)))
    if remote is None:
        return _MISSING
    return remote


def _copy_control(store: Store, conn: Any) -> int:
    rows = store.read("SELECT * FROM hl_control WHERE id = 1")
    if not rows:
        return 0
    row = rows[0]
    conn.execute(
        """
        INSERT INTO hl.hl_control (
            id, halt, flatten_requested, drain, pause_new_entries, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            halt = EXCLUDED.halt,
            flatten_requested = EXCLUDED.flatten_requested,
            drain = EXCLUDED.drain,
            pause_new_entries = EXCLUDED.pause_new_entries,
            updated_at = EXCLUDED.updated_at
        """,
        (
            1,
            bool(row["halt"]),
            bool(row["flatten_requested"]),
            bool(row["drain"]),
            bool(row["pause_new_entries"]),
            _adapt("hl_control", "updated_at", row["updated_at"]),
        ),
    )
    return 1


def _update_closed_shadows(
    store: Store,
    conn: Any,
    mapping: dict[tuple[str, int], int],
) -> None:
    rows = store.read(
        "SELECT id, exit_px, exit_reason, realised_r, fees, funding, hold_seconds "
        "FROM hl_shadow_trade WHERE exit_px IS NOT NULL"
    )
    for row in rows:
        remote = mapping.get(("hl_shadow_trade", int(row["id"])))
        if remote is None:
            continue
        conn.execute(
            """
            UPDATE hl.hl_shadow_trade
            SET exit_px = %s, exit_reason = %s, realised_r = %s, fees = %s,
                funding = %s, hold_seconds = %s
            WHERE id = %s
            """,
            (
                row["exit_px"],
                row["exit_reason"],
                row["realised_r"],
                row["fees"],
                row["funding"],
                row["hold_seconds"],
                remote,
            ),
        )


def _adapt(table: str, column: str, raw: object) -> object:
    if raw is None:
        return None
    if column in _BOOL:
        return bool(raw)
    if column in _JSON:
        from psycopg.types.json import Json

        if isinstance(raw, str):
            return Json(json.loads(raw))
        return Json(raw)
    if column in _DATES.get(table, frozenset()):
        if isinstance(raw, str):
            return date.fromisoformat(raw[:10])
        return raw
    if column in _TIMES and isinstance(raw, str):
        value = datetime.fromisoformat(raw)
        if value.tzinfo is None or value.utcoffset() is None:
            return value.replace(tzinfo=UTC)
        return value
    return raw


def _plain(name: str) -> bool:
    return name.isidentifier() and name == name.lower()


def _rollback(conn: Any) -> None:
    rollback = getattr(conn, "rollback", None)
    if rollback is not None:
        try:
            rollback()
        except Exception:
            return
