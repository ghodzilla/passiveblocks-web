"""Desk-health counts come from the tables, including a stale stand-down."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from pb_engine.cycle import run_once_replay
from pb_engine.desk_api import get_desk_health
from pb_engine.market_data.replay import load_tape
from pb_engine.store import Store

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"


def test_a_clean_replay_has_no_escapes(tmp_path: Path) -> None:
    db = tmp_path / "clean.sqlite3"
    run_once_replay(FIXTURES, db, seed=1)
    health = get_desk_health(Store(db))
    assert health["signal_escapes"] == 0
    assert health["false_closes"] == 0
    assert float(health["routing_accuracy"]) == 1.0
    assert health["equity_usdc"] != 1000
    rows = Store(db).read("select count(*) as n from hl_desk_health")
    assert rows[0]["n"] == 1


def test_a_stale_clock_is_counted(tmp_path: Path) -> None:
    db = tmp_path / "stale.sqlite3"
    later = load_tape(FIXTURES).captured_at + timedelta(hours=1)
    run_once_replay(FIXTURES, db, seed=1, now=later)
    health = get_desk_health(Store(db))
    assert int(health["stale_blocks"]) >= 1
    assert float(health["equity_usdc"]) == 1000
