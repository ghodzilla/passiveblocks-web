"""Lock the other hard limits from the spec.

Raising a limit has to fail these tests. Sizing reads the config names,
which the monkeypatch cases prove, so a copied literal cannot drift.
"""

from __future__ import annotations

import ast
import logging
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

import pytest

from pb_engine import config
from pb_engine.risk import (
    OpenPosition,
    Reason,
    initial_state,
    note_equity,
    resume_from_drawdown_kill,
    size_position,
)

ROOT = Path(__file__).resolve().parents[1]
T0 = datetime(2026, 11, 28, 12, tzinfo=UTC)


def _literals() -> dict[str, object]:
    path = ROOT / "src" / "pb_engine" / "config.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: dict[str, object] = {}
    for node in tree.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value:
            found[node.target.id] = ast.literal_eval(node.value)
    return found


def test_hard_limits_are_the_spec_literals() -> None:
    values = _literals()
    assert values["RISK_PER_TRADE"] == 0.005
    assert values["MAX_POSITIONS"] == 3
    assert values["MAX_POSITIONS_PER_MARKET"] == 1
    assert values["MAX_POSITION_NOTIONAL_MULTIPLE"] == 1.0
    assert values["MIN_ORDER_USD"] == 11
    assert values["CLUSTER_RISK_CAP"] == 0.015
    assert values["TOTAL_RISK_CAP"] == 0.02
    assert values["ENERGY_MAX_POSITIONS"] == 1
    assert values["MAX_NET_DIRECTIONAL"] == 1.5
    assert values["DAILY_LOSS_STOP"] == 0.02
    assert values["DRAWDOWN_KILL"] == 0.10
    assert values["AUTONOMY_CAP"] == 3
    assert values["SIM_STARTING_EQUITY_USDC"] == 1000
    assert values["HL_NETWORK"] == "sim-mainnet-data"
    assert values["MARKET_CLUSTER"] == {
        "BTC": "crypto",
        "ETH": "crypto",
        "SOL": "crypto",
        "GOLD": "metals",
        "SILVER": "metals",
        "CL": "energy",
        "WTI": "energy",
        "BRENTOIL": "energy",
    }
    assert config.RISK_PER_TRADE == 0.005
    assert config.DAILY_LOSS_STOP == 0.02
    assert config.DRAWDOWN_KILL == 0.10
    assert config.MAX_POSITIONS == 3


def test_half_percent_stop_risk_and_no_more() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
    )
    assert decision.accepted is True
    assert decision.notional_usd == pytest.approx(250)
    assert decision.risk_usd == pytest.approx(5)
    assert decision.risk_usd <= 1000 * config.RISK_PER_TRADE


def test_per_position_ceiling_cuts_risk_instead_of_raising_it() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.004,
        market="BTC",
        side="short",
        cluster="crypto",
    )
    assert decision.accepted is True
    assert decision.notional_usd == pytest.approx(1000)
    assert decision.risk_usd == pytest.approx(4)
    assert decision.risk_usd < 1000 * config.RISK_PER_TRADE


def test_budget_reads_the_risk_constant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "RISK_PER_TRADE", 0.01)
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
    )
    assert decision.notional_usd == pytest.approx(500)
    assert decision.risk_usd == pytest.approx(10)


def test_weight_above_one_is_rejected() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        weight=1.01,
    )
    assert decision.reason == Reason.BAD_WEIGHT
    assert decision.notional_usd == 0


def test_zero_weight_is_rejected() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        weight=0,
    )
    assert decision.reason == Reason.ZERO_WEIGHT


def test_half_weight_halves_the_risk() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        weight=0.5,
    )
    assert decision.accepted is True
    assert decision.risk_usd == pytest.approx(2.5)
    assert decision.notional_usd == pytest.approx(125)


def test_order_under_eleven_dollars_is_rejected() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.5,
        market="BTC",
        side="long",
        cluster="crypto",
    )
    assert decision.reason == Reason.BELOW_MIN
    assert decision.notional_usd == 0


def test_fourth_position_is_rejected() -> None:
    book = (
        OpenPosition("BTC", 250, "long", 0.02, "crypto"),
        OpenPosition("ETH", 250, "short", 0.02, "crypto"),
        OpenPosition("SOL", 250, "long", 0.02, "crypto"),
    )
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="GOLD",
        side="long",
        cluster="metals",
        open_positions=book,
    )
    assert decision.reason == Reason.MAX_POSITIONS


def test_max_positions_reads_the_config_constant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MAX_POSITIONS", 1)
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="ETH",
        side="long",
        cluster="crypto",
        open_positions=(OpenPosition("BTC", 100, "long", 0.02, "crypto"),),
    )
    assert decision.reason == Reason.MAX_POSITIONS


def test_second_position_in_the_same_market_is_rejected() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="btc",
        side="short",
        cluster="crypto",
        open_positions=(OpenPosition("BTC", 100, "long", 0.02, "crypto"),),
    )
    assert decision.reason == Reason.ONE_PER_MARKET


def test_cluster_risk_cap() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.01,
        market="SILVER",
        side="long",
        cluster="metals",
        open_positions=(OpenPosition("GOLD", 1000, "long", 0.012, "metals"),),
    )
    assert decision.reason == Reason.CLUSTER_RISK


def test_cluster_risk_at_the_cap_is_allowed() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.01,
        market="SILVER",
        side="short",
        cluster="metals",
        open_positions=(OpenPosition("GOLD", 1000, "long", 0.01, "metals"),),
    )
    assert decision.accepted is True
    assert decision.risk_usd == pytest.approx(5)


def test_total_risk_cap() -> None:
    book = (
        OpenPosition("GOLD", 1000, "long", 0.015, "metals"),
        OpenPosition("BTC", 500, "short", 0.01, "crypto"),
    )
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.01,
        market="ETH",
        side="short",
        cluster="crypto",
        open_positions=book,
    )
    assert decision.reason == Reason.TOTAL_RISK


def test_net_exposure_cap_blocks_a_one_sided_add() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.005,
        market="ETH",
        side="long",
        cluster="crypto",
        open_positions=(OpenPosition("BTC", 800, "long", 0.005, "crypto"),),
    )
    assert decision.reason == Reason.NET_EXPOSURE


def test_hedge_is_not_blocked_by_net_exposure() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.005,
        market="ETH",
        side="short",
        cluster="crypto",
        open_positions=(OpenPosition("BTC", 800, "long", 0.005, "crypto"),),
    )
    assert decision.accepted is True
    assert decision.notional_usd == pytest.approx(1000)


def test_second_energy_position_is_rejected() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BRENTOIL",
        side="short",
        cluster="energy",
        open_positions=(OpenPosition("CL", 100, "long", 0.05, "energy"),),
    )
    assert decision.reason == Reason.CLUSTER_POSITIONS


def test_known_market_cannot_change_cluster() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="metals",
    )
    assert decision.reason == Reason.BAD_CLUSTER


def test_book_already_over_the_leverage_cap_is_refused() -> None:
    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="SOL",
        side="long",
        cluster="crypto",
        open_positions=(
            OpenPosition("BTC", 1200, "long", 0.004, "crypto"),
            OpenPosition("ETH", 1200, "short", 0.004, "crypto"),
        ),
    )
    assert decision.reason == Reason.BAD_BOOK


@pytest.mark.parametrize(
    ("kwargs", "reason"),
    [
        ({"equity": 0}, Reason.BAD_EQUITY),
        ({"equity": -10}, Reason.BAD_EQUITY),
        ({"stop_distance_pct": 0}, Reason.BAD_STOP),
        ({"stop_distance_pct": 1.5}, Reason.BAD_STOP),
        ({"market": " "}, Reason.BAD_MARKET),
        ({"side": "flat"}, Reason.BAD_SIDE),
        ({"cluster": "fx"}, Reason.BAD_CLUSTER),
    ],
)
def test_bad_inputs_are_rejected(kwargs: dict[str, object], reason: str) -> None:
    payload: dict[str, object] = {
        "equity": 1000,
        "stop_distance_pct": 0.02,
        "market": "BTC",
        "side": "long",
        "cluster": "crypto",
    }
    payload.update(kwargs)
    decision = size_position(**payload)  # type: ignore[arg-type]
    assert decision.reason == reason
    assert decision.notional_usd == 0


def test_daily_stop_trips_at_two_percent_and_blocks_entries() -> None:
    state = initial_state(1000, T0)
    inside = note_equity(state, 980.01, T0.replace(hour=13))
    assert inside.daily_stopped is False
    assert inside.entries_allowed is True

    stopped = note_equity(state, 980, T0.replace(hour=13))
    assert stopped.daily_stopped is True
    assert stopped.halted is False
    assert stopped.must_flatten is True

    decision = size_position(
        equity=980,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        risk_state=stopped,
    )
    assert decision.reason == Reason.DAILY_LOSS_STOP


def test_daily_stop_stays_on_after_an_intraday_recovery() -> None:
    state = initial_state(1000, T0)
    stopped = note_equity(state, 980, T0.replace(hour=13))
    recovered = note_equity(stopped, 1000, T0.replace(hour=14))
    assert recovered.daily_stopped is True
    assert recovered is not stopped
    assert stopped.daily_stopped is True


def test_daily_stop_clears_on_the_next_utc_day() -> None:
    state = initial_state(1000, T0)
    stopped = note_equity(state, 980, T0.replace(hour=13))
    nxt = note_equity(stopped, 980, datetime(2026, 11, 29, tzinfo=UTC))
    assert nxt.daily_stopped is False
    assert nxt.day_start_equity == 980
    assert nxt.halted is False
    assert nxt.entries_allowed is True


def test_daily_stop_reads_the_config_constant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "DAILY_LOSS_STOP", 0.01)
    state = initial_state(1000, T0)
    stopped = note_equity(state, 985, T0.replace(hour=13))
    assert stopped.daily_stopped is True


def test_one_and_a_half_percent_day_does_not_trip_the_real_stop() -> None:
    state = initial_state(1000, T0)
    held = note_equity(state, 985, T0.replace(hour=13))
    assert held.daily_stopped is False


def test_drawdown_kill_latches_until_a_manual_restart() -> None:
    state = initial_state(1000, T0)
    inside = note_equity(state, 900.01, T0.replace(hour=13))
    assert inside.halted is False

    killed = note_equity(state, 900, T0.replace(hour=13))
    assert killed.halted is True
    assert killed.halt_reason == Reason.DRAWDOWN_KILL
    assert killed.daily_stopped is True
    assert killed.must_flatten is True

    recovered = note_equity(killed, 1000, T0.replace(hour=18))
    assert recovered.halted is True
    assert recovered.halt_reason == Reason.DRAWDOWN_KILL

    nxt = note_equity(killed, 1000, datetime(2026, 11, 29, tzinfo=UTC))
    assert nxt.halted is True
    assert nxt.daily_stopped is False

    decision = size_position(
        equity=1000,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        risk_state=nxt,
    )
    assert decision.reason == Reason.DRAWDOWN_KILL
    assert decision.notional_usd == 0


def test_drawdown_kill_reads_the_config_constant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "DRAWDOWN_KILL", 0.05)
    state = initial_state(1000, T0)
    killed = note_equity(state, 940, T0.replace(hour=13))
    assert killed.halted is True


def test_six_percent_drawdown_does_not_trip_the_real_kill() -> None:
    state = initial_state(1000, T0)
    held = note_equity(state, 940, T0.replace(hour=13))
    assert held.halted is False


def test_new_high_resets_the_peak_before_the_kill_is_measured() -> None:
    state = initial_state(1000, T0)
    higher = note_equity(state, 1100, T0.replace(hour=13))
    assert higher.peak_equity == 1100
    assert higher.halted is False
    killed = note_equity(higher, 990, T0.replace(hour=14))
    assert killed.halted is True


def test_manual_restart_rebases_the_peak_and_does_not_change_limits(
    caplog: pytest.LogCaptureFixture,
) -> None:
    day1 = datetime(2026, 11, 28, tzinfo=UTC)
    state = initial_state(1000, day1)
    opened = note_equity(state, 910, datetime(2026, 11, 29, tzinfo=UTC))
    killed = note_equity(opened, 900, datetime(2026, 11, 29, 4, tzinfo=UTC))
    assert killed.halted is True
    assert killed.daily_stopped is False

    before = (config.DRAWDOWN_KILL, config.MAX_LEVERAGE, config.RISK_PER_TRADE)
    with caplog.at_level(logging.INFO, logger="pb_engine.risk"):
        resumed = resume_from_drawdown_kill(
            killed,
            900,
            datetime(2026, 11, 29, 5, tzinfo=UTC),
            actor="  pritesh  ",
        )
    assert resumed.halted is False
    assert resumed.peak_equity == 900
    assert resumed.entries_allowed is True
    assert (config.DRAWDOWN_KILL, config.MAX_LEVERAGE, config.RISK_PER_TRADE) == before
    assert "pritesh" in caplog.text
    assert "0x" not in caplog.text
    assert "private" not in caplog.text.lower()

    decision = size_position(
        equity=900,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        risk_state=resumed,
    )
    assert decision.accepted is True
    assert decision.risk_usd <= 900 * config.RISK_PER_TRADE + 1e-9

    again = note_equity(resumed, 810, datetime(2026, 11, 29, 6, tzinfo=UTC))
    assert again.halted is True
    assert again.halt_reason == Reason.DRAWDOWN_KILL


def test_same_day_restart_does_not_clear_the_daily_stop() -> None:
    state = initial_state(1000, T0)
    killed = note_equity(state, 900, T0.replace(hour=13))
    resumed = resume_from_drawdown_kill(
        killed,
        900,
        T0.replace(hour=14),
        actor="pritesh",
    )
    assert resumed.halted is False
    assert resumed.daily_stopped is True
    decision = size_position(
        equity=900,
        stop_distance_pct=0.02,
        market="BTC",
        side="long",
        cluster="crypto",
        risk_state=resumed,
    )
    assert decision.reason == Reason.DAILY_LOSS_STOP


def test_restart_on_the_next_utc_day_clears_a_stale_daily_stop() -> None:
    state = initial_state(1000, T0)
    killed = note_equity(state, 900, T0.replace(hour=13))
    resumed = resume_from_drawdown_kill(
        killed,
        900,
        datetime(2026, 11, 29, tzinfo=UTC),
        actor="pritesh",
    )
    assert resumed.halted is False
    assert resumed.daily_stopped is False
    assert resumed.day_start_equity == 900
    assert resumed.entries_allowed is True


@pytest.mark.parametrize("actor", ["", "   ", 3])
def test_restart_requires_a_named_actor(actor: object) -> None:
    state = initial_state(1000, T0)
    killed = note_equity(state, 900, T0.replace(hour=13))
    with pytest.raises((ValueError, TypeError)):
        resume_from_drawdown_kill(killed, 900, T0, actor=actor)  # type: ignore[arg-type]


def test_restart_refuses_when_there_is_no_kill() -> None:
    state = initial_state(1000, T0)
    with pytest.raises(ValueError, match="no drawdown kill"):
        resume_from_drawdown_kill(state, 1000, T0, actor="pritesh")


def test_naive_clock_is_rejected() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        initial_state(1000, datetime(2026, 11, 28, 12))


def test_equity_observations_use_the_utc_date() -> None:
    state = initial_state(1000, datetime(2026, 11, 27, 12, tzinfo=UTC))
    aedt = timezone(timedelta(hours=11))
    still_yesterday = note_equity(state, 1000, datetime(2026, 11, 28, 10, 30, tzinfo=aedt))
    assert still_yesterday.day_utc == state.day_utc
    rolled = note_equity(state, 990, datetime(2026, 11, 28, 11, 30, tzinfo=aedt))
    assert rolled.day_utc.isoformat() == "2026-11-28"
    assert rolled.day_start_equity == 990
    assert rolled.daily_stopped is False
    assert rolled.halted is False


def test_a_blown_account_latches_the_kill() -> None:
    state = initial_state(1000, T0)
    blown = note_equity(state, 0, T0.replace(hour=13))
    assert blown.halted is True
    assert blown.daily_stopped is True
    assert blown.peak_equity == 1000


def test_initial_state_rejects_a_non_positive_equity() -> None:
    with pytest.raises(ValueError):
        initial_state(0, T0)
    with pytest.raises(ValueError):
        initial_state(float("nan"), T0)
