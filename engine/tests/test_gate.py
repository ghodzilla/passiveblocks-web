"""The gate is deterministic and is not the strategy grading itself."""

from __future__ import annotations

import ast
from pathlib import Path

from pb_engine import config
from pb_engine.gate import GateFacts, allow_take, decide, expire

ROOT = Path(__file__).resolve().parents[1]


def _facts(**overrides: object) -> GateFacts:
    base: dict[str, object] = {
        "stale": False,
        "session_open": True,
        "spread": 0.0001,
        "stop_distance_pct": 0.02,
        "round_trip_cost": 0.0009,
        "pred_edge_r": 2.0,
        "edge_lcb_r": 0.0,
        "book_depth_usd": 1_000_000.0,
        "order_notional_usd": 200.0,
        "book_age_s": 0.1,
        "market": "BTC",
    }
    base.update(overrides)
    return GateFacts(**base)  # type: ignore[arg-type]


def test_same_facts_return_the_same_accept() -> None:
    first = decide(_facts())
    second = decide(_facts())
    assert first == second
    assert first.verdict == "accept"
    assert 0.0 <= first.probability <= 1.0
    assert first.reasons == ("ok",)


def test_hard_rules_reject() -> None:
    assert decide(_facts(stale=True)).verdict == "reject"
    assert "stale" in decide(_facts(stale=True)).reasons
    assert decide(_facts(session_open=False)).verdict == "reject"
    assert decide(_facts(pred_edge_r=0.0)).verdict == "reject"
    assert decide(_facts(stop_distance_pct=0.001)).verdict == "reject"
    wide = decide(_facts(spread=0.01))
    assert wide.verdict == "reject"
    assert "spread" in wide.reasons
    thin = decide(_facts(book_depth_usd=10.0, order_notional_usd=100.0))
    assert thin.verdict == "reject"
    assert "depth" in thin.reasons
    assert decide(_facts(stale=True)).probability == config.GATE_REJECT_PROBABILITY


def test_soft_rules_ask_for_more() -> None:
    missing = decide(_facts(spread=None, book_depth_usd=None))
    assert missing.verdict == "verify_more"
    assert "missing_book" in missing.reasons
    assert missing.probability == config.GATE_VERIFY_PROBABILITY
    borderline = decide(_facts(pred_edge_r=0.1))
    assert borderline.verdict == "verify_more"
    assert "borderline_edge" in borderline.reasons
    assert decide(_facts(first_bar=True)).verdict == "verify_more"
    assert decide(_facts(warmup_incomplete=True)).verdict == "verify_more"


def test_sol_uses_its_own_spread_cap() -> None:
    assert decide(_facts(market="SOL", spread=0.001)).verdict == "accept"
    assert decide(_facts(market="BTC", spread=0.0025)).verdict == "reject"


def test_verify_more_expires_to_reject() -> None:
    waiting = decide(_facts(spread=None, book_depth_usd=None))
    assert expire(waiting, config.VERIFY_BARS - 1).verdict == "verify_more"
    expired = expire(waiting, config.VERIFY_BARS)
    assert expired.verdict == "reject"
    assert "verify_expired" in expired.reasons
    assert expire(decide(_facts()), config.VERIFY_BARS).verdict == "accept"


def test_only_accept_may_be_taken() -> None:
    assert allow_take("accept") is True
    assert allow_take("verify_more") is False
    assert allow_take("reject") is False
    assert allow_take(None) is False


def test_the_gate_does_not_import_a_strategy() -> None:
    root = ROOT / "src" / "pb_engine" / "gate"
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert "strategies" not in node.module
