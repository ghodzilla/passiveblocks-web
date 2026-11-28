from __future__ import annotations

from pathlib import Path

import pytest

from pb_engine.cli import main, status_lines

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"


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


def test_health_report_and_alert_stay_local(
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    db = tmp_path / "desk.sqlite3"
    assert main(["health", "--db", str(db)]) == 0
    health = capsys.readouterr().out
    assert "orders=none" in health
    assert "nothing was sent" in health
    assert "signal_escapes=0" in health

    assert main(["report", "--db", str(db)]) == 0
    report = capsys.readouterr().out
    assert "NOT VALIDATED" in report
    assert "nothing was sent" in report
    assert "orders=none" in report

    assert main(["alert-test", "--db", str(db)]) == 0
    alert = capsys.readouterr().out
    assert "nothing was sent" in alert
    assert "orders=none" in alert
    assert "no token was read" in alert


def test_run_once_without_a_tape_does_not_trade(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["run-once"]) == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "does not send orders" in captured.err
    assert "run-once" in captured.err


def test_run_once_live_data_does_not_take_a_replay(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["run-once", "--live-data", "--replay", str(FIXTURES)]) == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "does not send orders" in captured.err
    assert "live-data" in captured.err


def test_run_once_replay_exits_zero(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    db = tmp_path / "cycle.sqlite3"
    assert main(["run-once", "--replay", str(FIXTURES), "--db", str(db)]) == 0
    out = capsys.readouterr().out
    assert "NOT VALIDATED" in out
    assert "orders=none" in out
    assert "keys=none" in out
    assert "taken=" in out
    assert "closed=" in out
    assert "shadow_equity=" in out
    assert "ungated_mean_r=" in out
    assert "gated_mean_r=" in out
    assert db.is_file()


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
