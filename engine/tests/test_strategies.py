"""Each strategy fires on one hand-built series and stays quiet on another."""

from __future__ import annotations

import ast
from datetime import UTC, datetime, timedelta
from pathlib import Path

from pb_engine import config
from pb_engine.market_data.replay import load_tape
from pb_engine.strategies.bars import Bar
from pb_engine.strategies.baselines import btc_hold_1x, random_entry
from pb_engine.strategies.crypto import (
    funding_fade_1h,
    meanrev_15m,
    trend_donchian_1h,
    tsmom_4h,
    utc_range_break,
)
from pb_engine.strategies.indicators import adx

START = datetime(2026, 11, 2, tzinfo=UTC)
ROOT = Path(__file__).resolve().parents[1]


def _bars(
    prices: list[float],
    *,
    step: timedelta,
    spread: float = 0.0,
    volume: float = 1.0,
    start: datetime = START,
) -> list[Bar]:
    rows: list[Bar] = []
    for index, price in enumerate(prices):
        rows.append(
            Bar(
                open_time=start + index * step,
                open=price,
                high=price + spread,
                low=price - spread,
                close=price,
                volume=volume,
            )
        )
    return rows


def test_trend_donchian_needs_a_break_and_a_slope() -> None:
    rising = _bars([100 + index for index in range(55)], step=timedelta(hours=4), spread=1)
    prior = _bars([99] * 20, step=timedelta(hours=1), spread=1)
    nxt = prior[-1].open_time + timedelta(hours=1)
    breakout = prior + _bars([110], step=timedelta(hours=1), spread=1, start=nxt)
    fired = trend_donchian_1h("BTC", breakout, rising)
    assert fired is not None
    assert fired.side == "long"
    assert fired.stop < fired.entry
    assert fired.hold_hours == 48
    inside = prior + _bars([99], step=timedelta(hours=1), spread=1, start=nxt)
    assert trend_donchian_1h("BTC", inside, rising) is None
    flat = _bars([100] * 55, step=timedelta(hours=4), spread=1)
    assert trend_donchian_1h("BTC", breakout, flat) is None


def test_tsmom_needs_a_move_past_one_bar_of_volatility() -> None:
    quiet = _bars([100] * 20, step=timedelta(hours=4), spread=1)
    assert tsmom_4h("ETH", quiet) is None
    jumped = quiet[:-1] + _bars([120], step=timedelta(hours=4), spread=1, start=quiet[-1].open_time)
    fired = tsmom_4h("ETH", jumped)
    assert fired is not None
    assert fired.side == "long"
    assert fired.hold_hours == 72


def test_meanrev_fades_a_quiet_stretch_and_ignores_a_trend() -> None:
    quiet = _bars([100] * 40, step=timedelta(hours=1), spread=0.01)
    stretched = _bars([100] * 20 + [130], step=timedelta(minutes=15), spread=0.01)
    fired = meanrev_15m("SOL", stretched, quiet)
    assert fired is not None
    assert fired.side == "short"
    assert fired.target < fired.entry
    trend = _bars([100 + index for index in range(40)], step=timedelta(hours=1), spread=0.01)
    assert adx(trend, 14) is not None
    assert adx(trend, 14) > 20
    assert adx(quiet, 14) is not None
    assert adx(quiet, 14) < 20
    assert meanrev_15m("SOL", stretched, trend) is None


def test_funding_fade_needs_thirty_days_and_a_stall() -> None:
    rates = [0.0] * 680 + [0.01] * 40
    wide = _bars([100 + (index % 2) * 10 for index in range(30)], step=timedelta(hours=1), spread=0)
    tight_start = wide[-1].open_time + timedelta(hours=1)
    tight = _bars([100, 100, 100], step=timedelta(hours=1), spread=0.05, start=tight_start)
    fired = funding_fade_1h("BTC", rates, wide + tight)
    assert fired is not None
    assert fired.side == "short"
    assert funding_fade_1h("BTC", rates[:72], wide + tight) is None
    tape = load_tape(ROOT / "fixtures" / "mainnet")
    recorded = [row.rate for row in tape.funding if row.coin == "BTC"]
    assert len(recorded) < config.FUNDING_LOOKBACK_HOURS
    assert funding_fade_1h("BTC", recorded, wide + tight) is None


def test_utc_range_break_needs_the_volume_multiple() -> None:
    opening = _bars([100] * 16, step=timedelta(minutes=15), spread=0.5, volume=10)
    loud = _bars(
        [101],
        step=timedelta(minutes=15),
        spread=0.5,
        volume=20,
        start=opening[-1].open_time + timedelta(minutes=15),
    )
    fired = utc_range_break("BTC", opening + loud)
    assert fired is not None
    assert fired.side == "long"
    assert fired.stop < fired.entry
    quiet = _bars(
        [101],
        step=timedelta(minutes=15),
        spread=0.5,
        volume=10,
        start=opening[-1].open_time + timedelta(minutes=15),
    )
    assert utc_range_break("BTC", opening + quiet) is None


def test_baselines_are_deterministic_and_not_a_forecast() -> None:
    assert random_entry(100, seed=1) == random_entry(100, seed=1)
    drawn = [random_entry(100, seed=seed) for seed in range(30)]
    assert all(item is not None for item in drawn)
    sides = {item.side for item in drawn if item is not None}
    assert sides == {"long", "short"}
    held = btc_hold_1x(50_000)
    assert held is not None
    assert held.market == "BTC"
    assert held.side == "long"
    assert held.baseline is True
    assert held.pred_edge_r == 0
    assert held.stop < held.entry


def test_strategy_modules_do_not_touch_the_store_or_a_gate() -> None:
    root = ROOT / "src" / "pb_engine" / "strategies"
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert "store" not in node.module
                assert "cycle" not in node.module
                assert not node.module.endswith("gate")
            defined = isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            if defined:
                assert node.name not in {"accept", "place_order"}
