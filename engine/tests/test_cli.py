from __future__ import annotations

import pytest

from pb_engine.cli import main, status_lines


def test_status_prints_the_locked_limits(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["status"]) == 0
    out = capsys.readouterr().out
    for line in status_lines():
        assert line in out
    assert "NOT VALIDATED" in out
    assert "max_leverage=2" in out
    assert "risk_per_trade=0.005" in out
    assert "max_positions=3" in out
    assert "daily_loss_stop=0.02" in out
    assert "drawdown_kill=0.10" in out
    assert "orders=none" in out
    assert "keys=none" in out
    assert "hl_network=sim-mainnet-data" in out


@pytest.mark.parametrize("command", ["run-once", "health", "report", "alert-test"])
def test_unbuilt_commands_do_not_pretend_to_run(
    command: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main([command]) == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "does not send orders" in captured.err
    assert command in captured.err


def test_help_exits_cleanly(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    assert "no orders" in capsys.readouterr().out


def test_version_names_the_scaffold(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert "no orders" in capsys.readouterr().out
