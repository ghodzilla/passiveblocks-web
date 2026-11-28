"""Lock the account leverage cap at 2.

Banned environment names, so a reviewer can see what must not override
the cap: MAX_LEVERAGE, HL_LEVERAGE, LEVERAGE, RISK_PER_TRADE,
MAX_POSITIONS, DAILY_LOSS_STOP, DRAWDOWN_KILL.
"""

from __future__ import annotations

import ast
import inspect
import re
from pathlib import Path

import pytest

from pb_engine import config
from pb_engine.risk import OpenPosition, Reason, size_position

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"


def _literals(path: Path) -> dict[str, object]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: dict[str, object] = {}
    for node in tree.body:
        target: str | None = None
        value: ast.expr | None = None
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            target = node.target.id
            value = node.value
        elif (
            isinstance(node, ast.Assign)
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
        ):
            target = node.targets[0].id
            value = node.value
        if target is None or value is None:
            continue
        if target in found:
            pytest.fail(f"{target} is assigned more than once in {path.name}")
        found[target] = ast.literal_eval(value)
    return found


def test_max_leverage_is_exactly_two() -> None:
    values = _literals(SRC / "pb_engine" / "config.py")
    assert values["MAX_LEVERAGE"] == 2
    assert type(config.MAX_LEVERAGE) is int
    assert config.MAX_LEVERAGE == 2


def test_package_does_not_read_environment_or_config_files() -> None:
    for path in SRC.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        banned = re.search(
            r"\bos\.environ\b|\bgetenv\b|\bdotenv\b|HL_LEVERAGE|HL_AGENT|private_key",
            text,
        )
        assert banned is None, path.name
        tree = ast.parse(text)
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr in {"environ", "getenv"}:
                pytest.fail(f"{path.name} reads the environment")
            if isinstance(node, ast.Name) and node.id in {"getenv", "environ"}:
                pytest.fail(f"{path.name} reads the environment")
            opened = (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "open"
            )
            if opened:
                pytest.fail(f"{path.name} opens a file")
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                module = node.module if isinstance(node, ast.ImportFrom) else None
                names = [alias.name for alias in node.names]
                imported = [module, *names] if module else names
                for name in imported:
                    if name and name.split(".")[0] in {"dotenv", "tomllib", "configparser", "yaml"}:
                        pytest.fail(f"{path.name} imports {name}")


def test_risk_module_does_not_copy_a_literal_two() -> None:
    tree = ast.parse((SRC / "pb_engine" / "risk.py").read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and type(node.value) in {int, float} and node.value == 2:
            pytest.fail("risk.py must use config.MAX_LEVERAGE, not a literal 2")
        if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            if node.value.id == "config" and isinstance(node.ctx, ast.Store):
                pytest.fail("risk.py assigns to config")


def test_sizing_source_references_the_config_constant() -> None:
    source = inspect.getsource(size_position)
    assert "config.MAX_LEVERAGE" in source


def test_sizing_follows_the_config_constant(monkeypatch: pytest.MonkeyPatch) -> None:
    """A copied literal 2 would ignore this in-process change.

    The lock test above is what keeps the real value at 2. This only
    proves sizing reads that name.
    """

    monkeypatch.setattr(config, "MAX_LEVERAGE", 1)
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.01,
        market="SOL",
        side="long",
        cluster="crypto",
        open_positions=(
            OpenPosition("BTC", 400, "long", 0.005, "crypto"),
            OpenPosition("ETH", 400, "short", 0.005, "crypto"),
        ),
    )
    assert decision.accepted is False
    assert decision.reason == Reason.LEVERAGE_CAP
    assert decision.notional_usd == 0


def test_same_trade_fits_when_the_cap_is_two() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.01,
        market="SOL",
        side="long",
        cluster="crypto",
        open_positions=(
            OpenPosition("BTC", 400, "long", 0.005, "crypto"),
            OpenPosition("ETH", 400, "short", 0.005, "crypto"),
        ),
    )
    assert decision.accepted is True
    assert decision.notional_usd == pytest.approx(500)
    assert (400 + 400 + decision.notional_usd) / 1000 <= config.MAX_LEVERAGE


def test_two_800_positions_reject_a_third_that_would_breach() -> None:
    """Equity 1000 and two 800 notionals leave 400 of room.

    A 1% stop wants 500, which would make gross leverage 2.1. That entry
    is rejected. It is not resized to 400.
    """

    decision = size_position(
        equity=1000,
        stop_distance_pct=0.01,
        market="SOL",
        side="long",
        cluster="crypto",
        open_positions=(
            OpenPosition("BTC", 800, "long", 0.005, "crypto"),
            OpenPosition("ETH", 800, "short", 0.005, "crypto"),
        ),
    )
    assert decision.accepted is False
    assert decision.reason == Reason.LEVERAGE_CAP
    assert decision.notional_usd == 0
    assert decision.risk_usd == 0


def test_third_position_that_fits_under_two_x_is_allowed() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.025,
        market="SOL",
        side="long",
        cluster="crypto",
        open_positions=(
            OpenPosition("BTC", 800, "long", 0.005, "crypto"),
            OpenPosition("ETH", 800, "short", 0.005, "crypto"),
        ),
    )
    assert decision.accepted is True
    assert decision.notional_usd == pytest.approx(200)
    assert (800 + 800 + decision.notional_usd) / 1000 < config.MAX_LEVERAGE


def test_exactly_two_x_is_allowed() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.0125,
        market="SOL",
        side="long",
        cluster="crypto",
        open_positions=(
            OpenPosition("BTC", 800, "long", 0.005, "crypto"),
            OpenPosition("ETH", 800, "short", 0.005, "crypto"),
        ),
    )
    assert decision.accepted is True
    assert decision.notional_usd == pytest.approx(400)
    assert (800 + 800 + decision.notional_usd) / 1000 == pytest.approx(config.MAX_LEVERAGE)


@pytest.mark.parametrize("stop", [0.004, 0.005, 0.01, 0.0125, 0.02, 0.05, 0.5])
@pytest.mark.parametrize(
    "positions",
    [
        (),
        (("BTC", 800, "long"),),
        (("BTC", 800, "long"), ("ETH", 800, "short")),
        (("BTC", 1000, "long"), ("ETH", 990, "short")),
        (("BTC", 250, "long"), ("ETH", 250, "short"), ("SOL", 250, "long")),
        (("BTC", 1500, "short"),),
    ],
)
def test_accepted_notional_never_breaks_the_cap(
    stop: float,
    positions: tuple[tuple[str, float, str], ...],
) -> None:
    book = tuple(
        OpenPosition(market, notional, side, 0.005, "crypto")
        for market, notional, side in positions
    )
    used = {market for market, _, _ in positions}
    market = next(name for name in ("BTC", "ETH", "SOL", "GOLD") if name not in used)
    cluster = config.MARKET_CLUSTER[market]
    decision = size_position(
        equity=1000,
        stop_distance_pct=stop,
        market=market,
        side="long",
        cluster=cluster,
        open_positions=book,
    )
    if decision.accepted:
        gross = sum(notional for _, notional, _ in positions) + decision.notional_usd
        assert gross / 1000 <= config.MAX_LEVERAGE + 1e-9
        assert decision.notional_usd <= 1000 * config.MAX_POSITION_NOTIONAL_MULTIPLE
        assert decision.risk_usd <= 1000 * config.RISK_PER_TRADE + 1e-9
    else:
        assert decision.notional_usd == 0
        assert decision.risk_usd == 0
