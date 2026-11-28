"""One replay writes a consistent local database and does not take a trade."""

from __future__ import annotations

import ast
import sqlite3
from datetime import timedelta
from pathlib import Path

from pb_engine.cycle import run_once_replay
from pb_engine.market_data.replay import load_tape
from pb_engine.risk import Reason
from pb_engine.session import session_block

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"
CYCLE = Path(__file__).resolve().parents[1] / "src" / "pb_engine" / "cycle.py"


def test_replay_cycle_is_shadow_only_and_offline(tmp_path: Path, monkeypatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("replay called the network")

    monkeypatch.setattr("pb_engine.market_data.http.post_json", boom)
    db = tmp_path / "cycle.sqlite3"
    result = run_once_replay(FIXTURES, db)
    assert result.taken == 0
    assert result.closed == 0
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
        )
    }
    assert counts["hl_heartbeat"] == 1
    assert counts["hl_equity"] == 1
    assert counts["hl_signal"] == result.signals
    assert counts["hl_shadow_trade"] == result.shadow_fills
    assert counts["hl_gate_decision"] == 0
    assert counts["hl_trade_plan"] == 0
    assert counts["hl_close_event"] == 0
    assert counts["hl_order"] == 0
    assert counts["hl_fill"] == 0
    trades = conn.execute("SELECT source, book FROM hl_shadow_trade").fetchall()
    assert trades
    assert set(trades) == {("shadow", "ungated")}
    decisions = {row[0] for row in conn.execute("SELECT decision FROM hl_signal")}
    assert decisions == {"skip"}
    statuses = {row[0] for row in conn.execute("SELECT status FROM hl_strategy")}
    assert statuses == {"shadow"}
    reasons = {row[0] for row in conn.execute("SELECT skip_reason FROM hl_signal")}
    assert "baseline" in reasons
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


def test_cycle_source_does_not_open_a_socket() -> None:
    tree = ast.parse(CYCLE.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            assert node.module.split(".")[0] not in {"urllib", "websockets", "socket"}
        if isinstance(node, ast.Attribute):
            assert node.attr not in {"post_json", "connect_mainnet"}
