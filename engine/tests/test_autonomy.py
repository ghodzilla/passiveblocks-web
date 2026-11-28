"""Exercised autonomy stays at L1 until a person confirms a change."""

from __future__ import annotations

from pathlib import Path

import pytest

from pb_engine import config
from pb_engine.autonomy import AutonomyRefused, exercised_level, promote, require
from pb_engine.cli import main
from pb_engine.controls import pause_entries
from pb_engine.store import Store

ROOT = Path(__file__).resolve().parents[1]


def test_default_level_is_prepare(tmp_path: Path) -> None:
    store = Store(tmp_path / "desk.sqlite3")
    assert exercised_level(store) == 1
    assert config.AUTONOMY_CAP == 3


def test_unconfirmed_promotion_is_refused(tmp_path: Path) -> None:
    store = Store(tmp_path / "desk.sqlite3")
    with pytest.raises(AutonomyRefused):
        promote(store, 2, confirmed=False, actor="owner", reason="review")
    assert exercised_level(store) == 1


def test_level_above_the_cap_is_refused(tmp_path: Path) -> None:
    store = Store(tmp_path / "desk.sqlite3")
    with pytest.raises(AutonomyRefused):
        promote(store, 4, confirmed=True, actor="owner", reason="too far")
    assert exercised_level(store) == 1


def test_confirmed_promotion_cannot_change_a_limit(tmp_path: Path) -> None:
    store = Store(tmp_path / "desk.sqlite3")
    state = promote(store, 2, confirmed=True, actor="owner", reason="review the desk")
    assert state.exercised == 2
    assert config.MAX_LEVERAGE == 2
    assert config.RISK_PER_TRADE == 0.005
    with pytest.raises(AutonomyRefused):
        require(store, 3)


def test_pause_is_refused_at_l1(tmp_path: Path) -> None:
    db = tmp_path / "desk.sqlite3"
    store = Store(db)
    with pytest.raises(AutonomyRefused):
        pause_entries(store, actor="owner", reason="stand down")
    assert store.get_control().pause_new_entries is False
    code = main(
        ["control", "--db", str(db), "pause-entries", "--actor", "owner", "--reason", "x"]
    )
    assert code == 2


def test_run_once_does_not_promote() -> None:
    text = (ROOT / "src" / "pb_engine" / "cycle.py").read_text(encoding="utf-8")
    assert "promote(" not in text
