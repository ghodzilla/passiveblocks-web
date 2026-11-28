"""One replay can take a simulated trade and still sends nothing."""

from __future__ import annotations

import ast
import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from pb_engine.cycle import gate_allows_take, run_once_replay
from pb_engine.market_data.replay import load_tape
from pb_engine.risk import Reason
from pb_engine.session import session_block
from pb_engine.store import Store

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"
CYCLE = Path(__file__).resolve().parents[1] / "src" / "pb_engine" / "cycle.py"


def test_replay_cycle_is_shadow_only_and_offline(tmp_path: Path, monkeypatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("replay called the network")

    monkeypatch.setattr("pb_engine.market_data.http.post_json", boom)
    db = tmp_path / "cycle.sqlite3"
    result = run_once_replay(FIXTURES, db)
    assert result.taken >= 1
    assert result.closed >= 1
    assert result.equity != 1000
    assert result.signals >= 2
    assert result.shadow_fills >= 1

    conn = sqlite3.connect(db)
    counts = {
        name: conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        for name in (
            "hl_heartbeat",
            "hl_equity",
            "hl_signal",
            "hl_shadow_trade",
            "hl_gate_decision",
            "hl_trade_plan",
            "hl_close_event",
            "hl_order",
            "hl_fill",
            "hl_alert_outbox",
        )
    }
    assert counts["hl_heartbeat"] == 1
    assert counts["hl_equity"] == 1
    assert counts["hl_signal"] == result.signals
    assert counts["hl_shadow_trade"] == result.shadow_fills
    assert counts["hl_gate_decision"] == result.signals
    assert counts["hl_trade_plan"] == result.taken
    assert counts["hl_order"] == 0
    assert counts["hl_fill"] >= result.taken
    books = {row[0] for row in conn.execute("SELECT book FROM hl_shadow_trade")}
    assert books == {"gated", "ungated"}
    sources = {row[0] for row in conn.execute("SELECT source FROM hl_shadow_trade")}
    assert sources == {"shadow"}
    decisions = {row[0] for row in conn.execute("SELECT decision FROM hl_signal")}
    assert "trade" in decisions
    statuses = {row[0] for row in conn.execute("SELECT status FROM hl_strategy")}
    assert statuses == {"shadow"}
    reasons = {row[0] for row in conn.execute("SELECT skip_reason FROM hl_signal")}
    assert "baseline" in reasons
    bad_plans = conn.execute(
        """
        SELECT COUNT(*) FROM hl_trade_plan AS plan
        JOIN hl_gate_decision AS gate ON gate.id = plan.gate_decision_id
        WHERE gate.verdict != 'accept'
        """
    ).fetchone()[0]
    assert bad_plans == 0
    for verdict in ("reject", "verify_more"):
        shadowed = conn.execute(
            """
            SELECT COUNT(*) FROM hl_shadow_trade AS trade
            JOIN hl_gate_decision AS gate ON gate.signal_id = trade.signal_id
            WHERE trade.book = 'ungated' AND gate.verdict = ?
            """,
            (verdict,),
        ).fetchone()[0]
        assert shadowed >= 1
    gated_without_accept = conn.execute(
        """
        SELECT COUNT(*) FROM hl_shadow_trade AS trade
        JOIN hl_gate_decision AS gate ON gate.signal_id = trade.signal_id
        WHERE trade.book = 'gated' AND gate.verdict != 'accept'
        """
    ).fetchone()[0]
    assert gated_without_accept == 0
    for outcome, gaps in conn.execute("SELECT outcome, unverified_gaps FROM hl_close_event"):
        parsed = json.loads(gaps)
        if outcome == "closed_as_planned":
            assert "no_exit_fill" not in parsed
            assert "missing_entry" not in parsed
    feature = conn.execute(
        "SELECT features FROM hl_signal WHERE decision = 'trade' LIMIT 1"
    ).fetchone()
    assert feature is not None
    parsed_feature = json.loads(feature[0])
    assert parsed_feature["not_live"] is True
    assert parsed_feature["rank_status"] == "shadow"
    conn.close()

    tape = load_tape(FIXTURES)
    assert session_block("xyz:NVDA", tape.captured_at) == Reason.SESSION
    assert session_block("BTC", tape.captured_at) is None


def test_a_stale_replay_clock_blocks_new_shadow_entries(tmp_path: Path) -> None:
    tape = load_tape(FIXTURES)
    later = tape.captured_at + timedelta(hours=1)
    result = run_once_replay(FIXTURES, tmp_path / "stale.sqlite3", now=later)
    assert result.shadow_fills == 0
    assert result.taken == 0
    assert result.signals >= 1
    conn = sqlite3.connect(tmp_path / "stale.sqlite3")
    kinds = {row[0] for row in conn.execute("SELECT kind FROM hl_risk_event")}
    assert "stale_data" in kinds
    assert conn.execute("SELECT COUNT(*) FROM hl_heartbeat").fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM hl_close_event").fetchone()[0] == 0
    conn.close()


def test_a_missing_gate_is_logged_and_not_taken(tmp_path: Path) -> None:
    now = datetime(2026, 11, 28, tzinfo=UTC)
    db = tmp_path / "escape.sqlite3"
    with Store(db) as store:
        assert gate_allows_take(None, store, now, "BTC") is False
        assert gate_allows_take("reject", store, now, "BTC") is False
        assert gate_allows_take("verify_more", store, now, "BTC") is False
        assert gate_allows_take("accept", store, now, "BTC") is True
    conn = sqlite3.connect(db)
    rows = conn.execute("SELECT kind, severity FROM hl_risk_event").fetchall()
    assert rows == [("signal_escape", "WARN")]
    assert conn.execute("SELECT COUNT(*) FROM hl_trade_plan").fetchone()[0] == 0
    conn.close()


def test_cycle_source_does_not_open_a_socket() -> None:
    tree = ast.parse(CYCLE.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            assert node.module.split(".")[0] not in {"urllib", "websockets", "socket"}
        if isinstance(node, ast.Attribute):
            assert node.attr not in {"post_json", "connect_mainnet"}
