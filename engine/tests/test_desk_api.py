"""The desk view can read. It cannot write or name an order tool."""

from __future__ import annotations

import ast
import inspect
from pathlib import Path

import pb_engine.desk_api as desk_api
from pb_engine.cycle import run_once_replay
from pb_engine.desk_api import get_desk_health, get_status, snapshot
from pb_engine.store import Store

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "pb_engine" / "desk_api.py"
FIXTURES = ROOT / "fixtures" / "mainnet"

ALLOWED = {
    "get_status",
    "get_positions",
    "get_pnl",
    "get_balance",
    "get_whitelist",
    "get_gate_decisions",
    "get_open_plans",
    "get_close_events",
    "get_desk_health",
    "get_autonomy_cap",
    "snapshot",
}

BANNED = {
    "place_order",
    "cancel",
    "modify",
    "update_leverage",
    "flatten",
    "halt",
    "blacklist",
    "set_config",
    "send_asset",
    "approve_agent",
    "withdraw",
}


def test_public_names_are_reads_only() -> None:
    public = {
        name
        for name, value in vars(desk_api).items()
        if inspect.isfunction(value)
        and getattr(value, "__module__", "") == desk_api.__name__
        and not name.startswith("_")
    }
    assert ALLOWED <= public
    extra = public - ALLOWED
    assert extra == set()
    tree = ast.parse(SRC.read_text(encoding="utf-8"))
    defined = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            defined.append(node.name.lower())
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            defined.extend(alias.name.lower() for alias in node.names)
    for name in defined:
        assert name not in BANNED
        for banned in BANNED:
            assert banned not in name
    text = SRC.read_text(encoding="utf-8")
    assert "store.add" not in text
    assert "update_control" not in text


def test_reads_do_not_change_the_store(tmp_path: Path) -> None:
    db = tmp_path / "desk.sqlite3"
    run_once_replay(FIXTURES, db, seed=1)
    store = Store(db)
    before = store.read("select count(*) as n from hl_signal")[0]["n"]
    view = snapshot(store)
    after = store.read("select count(*) as n from hl_signal")[0]["n"]
    assert after == before
    assert view["status"]["mode"] == "SIMULATION"  # type: ignore[index]
    assert "NOT VALIDATED" in str(view["headline"])
    assert get_status(store)["orders"] == "none"
    health = get_desk_health(store)
    assert health["signal_escapes"] == 0
    assert health["false_closes"] == 0
    assert "equity_usdc" in health
    assert "open_risk" in health


def test_select_helper_rejects_writes(tmp_path: Path) -> None:
    store = Store(tmp_path / "empty.sqlite3")
    try:
        store.read("update hl_control set halt = 1 where id = 1")
    except ValueError as exc:
        assert "select" in str(exc)
    else:
        raise AssertionError("a write was accepted")
