"""The host install stays on the shared droplet and does not send anything."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from pb_engine.alerts import alert_failure
from pb_engine.cli import main
from pb_engine.models import DeskHealth, RiskEvent
from pb_engine.store import Store

ROOT = Path(__file__).resolve().parents[1]
OPS = ROOT / "ops"

BANNED = (
    "private_key",
    "HL_AGENT",
    "api.telegram.org",
    "--live-data",
    "MemoryLow=",
    "systemctl enable",
    "systemctl start",
    "postgres://",
    "postgresql://",
)


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_units_are_capped_and_hardened() -> None:
    slice_text = _text(OPS / "systemd" / "hl-engine.slice")
    service = _text(OPS / "systemd" / "hl-engine.service")
    alert = _text(OPS / "systemd" / "pb-alert@.service")
    for name, text in ("slice", slice_text), ("alert", alert):
        for banned in (*BANNED, "EnvironmentFile"):
            assert banned not in text, name
    for banned in BANNED:
        assert banned not in service
    assert service.count("EnvironmentFile=") == 1
    assert "EnvironmentFile=/etc/hl-engine/engine.env" in service
    assert "CPUQuota=60%" in slice_text
    assert "MemoryMax=900M" in slice_text
    assert "MemoryHigh=700M" in slice_text
    assert "IOWeight=20" in slice_text
    assert "TasksMax=64" in slice_text
    assert "Type=notify" in service
    assert "WatchdogSec=60" in service
    assert "Restart=always" in service
    assert "User=hlengine" in service
    assert "Slice=hl-engine.slice" in service
    assert "OnFailure=pb-alert@%n.service" in service
    assert "NoNewPrivileges=yes" in service
    assert "ProtectSystem=strict" in service
    assert "ProtectHome=yes" in service
    assert "PrivateTmp=yes" in service
    assert "PrivateDevices=yes" in service
    assert "CapabilityBoundingSet=" in service
    assert "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6" in service
    assert "RestrictAddressFamilies=AF_UNIX\n" in alert
    assert "ReadWritePaths=/var/lib/hl-engine /var/log/hl-engine" in service
    assert "ReadOnlyPaths=/opt/hl-engine /etc/hl-engine" in service
    assert "ProtectSystem=strict" in service
    assert "ExecStart=/opt/hl-engine/app/ops/hl-engine-sim" in service
    assert "ExecStart=/opt/hl-engine/app/ops/pb-alert-fail %i" in alert
    assert "Type=oneshot" in alert
    rotate = _text(OPS / "logrotate" / "hl-engine")
    assert "size 10M" in rotate
    assert "rotate 8" in rotate
    assert "copytruncate" in rotate


def test_sim_script_runs_live_paper() -> None:
    script = OPS / "hl-engine-sim"
    text = _text(script)
    assert "run-once --live-data" in text
    assert "systemd-notify" in text
    assert "orders=none" in text
    assert "api.telegram.org" not in text
    assert "postgres://" not in text
    assert "postgresql://" not in text
    assert "EnvironmentFile" not in text
    subprocess.run(["bash", "-n", str(script)], check=True)
    subprocess.run(["bash", "-n", str(OPS / "pb-alert-fail")], check=True)
    subprocess.run(["bash", "-n", str(OPS / "install.sh")], check=True)


def test_install_script_is_idempotent(tmp_path: Path) -> None:
    prefix = tmp_path / "root"
    env = {
        "PREFIX": str(prefix),
        "HL_INSTALL_SKIP_UV": "1",
        "PATH": "/usr/bin:/bin",
    }
    script = OPS / "install.sh"
    first = subprocess.run(
        ["bash", str(script)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert first.returncode == 0, first.stderr
    second = subprocess.run(
        ["bash", str(script)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert second.returncode == 0, second.stderr
    assert (prefix / "opt/hl-engine/app/ops/hl-engine-sim").is_file()
    assert (prefix / "etc/systemd/system/hl-engine.service").is_file()
    assert (prefix / "etc/systemd/system/hl-engine.slice").is_file()
    assert (prefix / "etc/systemd/system/pb-alert@.service").is_file()
    assert (prefix / "etc/logrotate.d/hl-engine").is_file()
    assert (prefix / "var/lib/hl-engine").is_dir()
    assert (prefix / "var/log/hl-engine/hl-engine.log").is_file()
    assert "not enabled" in first.stdout
    install_text = _text(script)
    for banned in ("systemctl enable", "systemctl start", "useradd", "api.telegram.org"):
        assert banned not in install_text


def test_prune_keeps_the_log_tables_short(tmp_path: Path) -> None:
    from datetime import UTC, datetime

    store = Store(tmp_path / "desk.sqlite3")
    now = datetime(2026, 11, 28, tzinfo=UTC)
    for _ in range(60):
        store.add(
            DeskHealth(
                as_of=now,
                signal_escapes=0,
                false_closes=0,
                unnecessary_interruptions=0,
                created_at=now,
            )
        )
        store.add(RiskEvent(ts=now, kind="cycle", severity="INFO", detail="one cycle"))
    removed = store.prune()
    health = store.read("select count(*) as n from hl_desk_health")[0]["n"]
    events = store.read("select count(*) as n from hl_risk_event")[0]["n"]
    assert health == 48
    assert events == 60
    assert removed["hl_desk_health"] == 12
    assert main(["prune", "--db", str(tmp_path / "desk.sqlite3")]) == 0


def test_alert_fail_stays_local(tmp_path: Path) -> None:
    db = tmp_path / "desk.sqlite3"
    store = Store(db)
    message = alert_failure(store, "hl-engine.service")
    assert "nothing was sent" in message
    again = alert_failure(store, "hl-engine.service")
    assert again == message
    rows = store.read("select sent_at from hl_alert_outbox")
    assert len(rows) == 1
    assert rows[0]["sent_at"] is None
    with pytest.raises(ValueError):
        alert_failure(store, "../etc/passwd")
    assert main(["alert-fail", "--db", str(db), "--unit", "not a unit"]) == 2
    assert main(["sim-state", "--db", str(db)]) == 0
