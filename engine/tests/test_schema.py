"""The Postgres migration is a file. These tests only read it."""

from __future__ import annotations

import re
from pathlib import Path

from pb_engine.models import (
    ASSET_CLASSES,
    CALIBRATION_KINDS,
    CLOSE_OUTCOMES,
    DAILY_SCORE_KINDS,
    FILL_SOURCES,
    GATE_VERDICTS,
    SEVERITIES,
    SHADOW_BOOKS,
    SIDES,
    SIGNAL_DECISIONS,
    STRATEGY_STATUSES,
    WINDOW_VERDICTS,
)
from pb_engine.store import SQLITE_DDL

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "db" / "hl" / "001_init.sql"

EXPECTED_TABLES = (
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
    "hl_control",
)


def _check(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"CHECK ({column} IN ({quoted}))"


SHARED_CHECKS = (
    _check("asset_class", ASSET_CLASSES),
    _check("status", STRATEGY_STATUSES),
    _check("side", SIDES),
    _check("decision", SIGNAL_DECISIONS),
    _check("verdict", GATE_VERDICTS),
    _check("outcome", CLOSE_OUTCOMES),
    _check("book", SHADOW_BOOKS),
    "CHECK (source IN ('shadow'))",
    _check("source", FILL_SOURCES),
    _check("severity", SEVERITIES),
    _check("kind", CALIBRATION_KINDS),
    _check("kind", DAILY_SCORE_KINDS),
    "CHECK (verdict IS NULL OR verdict IN ("
    + ", ".join(f"'{value}'" for value in WINDOW_VERDICTS)
    + "))",
    "CHECK (weight >= 0 AND weight <= 1)",
    "CHECK (probability >= 0 AND probability <= 1)",
    "CHECK (id = 1)",
    "(kind = 'strategy' AND strategy_id IS NOT NULL)",
    "(kind = 'engine' AND strategy_id IS NULL)",
    "(kind = 'total' AND strategy_id IS NULL)",
)


def test_migration_lists_every_stage_one_table() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    for name in EXPECTED_TABLES:
        pattern = rf"CREATE TABLE IF NOT EXISTS hl\.{name}\b"
        assert len(re.findall(pattern, sql)) == 1, name
        assert re.search(rf"\bhl\.{name}\b", sql), name
    assert "CREATE SCHEMA IF NOT EXISTS hl;" in sql
    assert sql.lower().count("create table if not exists") == len(EXPECTED_TABLES)


def test_checks_match_in_postgres_and_sqlite() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    for snippet in SHARED_CHECKS:
        assert snippet in sql, snippet
        assert snippet in SQLITE_DDL, snippet
    assert sql.count(_check("asset_class", ASSET_CLASSES)) >= 2
    assert SQLITE_DDL.count(_check("asset_class", ASSET_CLASSES)) >= 2


def test_migration_file_has_no_credentials_and_is_not_applied() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "paper/simulation" in sql
    assert "does not execute this file" in lowered
    assert "hl_engine" in sql
    assert "hl_reader" in sql
    assert "later" in lowered
    assert "hardening" in lowered
    assert "grant " not in lowered
    assert "create role" not in lowered
    assert "timestamptz" in lowered
    assert "jsonb" in lowered
    for banned in ("postgres://", "neon.tech", "database_url", "password", "private_key"):
        assert banned not in lowered
    assert re.search(r"0x[0-9a-fA-F]{6,}", sql) is None
    store_source = (ROOT / "src" / "pb_engine" / "store.py").read_text(encoding="utf-8")
    model_source = (ROOT / "src" / "pb_engine" / "models.py").read_text(encoding="utf-8")
    assert "001_init" not in store_source
    assert "timestamptz" not in store_source.lower()
    assert "jsonb" not in store_source.lower()
    assert "sqlite" not in model_source.lower()
    assert "timestamptz" not in model_source.lower()
