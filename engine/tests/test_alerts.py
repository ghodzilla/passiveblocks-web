"""The alert stub queues a row and does not send it."""

from __future__ import annotations

from pathlib import Path

from pb_engine.alerts import NOTHING_SENT, alert_test, enqueue
from pb_engine.models import AlertOutbox
from pb_engine.store import Store

SRC = Path(__file__).resolve().parents[1] / "src" / "pb_engine" / "alerts.py"


def test_enqueue_leaves_the_row_unsent(tmp_path: Path) -> None:
    store = Store(tmp_path / "desk.sqlite3")
    row = enqueue(store, severity="INFO", dedup_key="alert-test", body="kept here")
    assert isinstance(row, AlertOutbox)
    assert row.sent_at is None
    message = alert_test(store)
    assert message == NOTHING_SENT
    again = store.read("select sent_at, body from hl_alert_outbox")
    assert len(again) == 1
    assert again[0]["sent_at"] is None


def test_source_does_not_name_a_token_or_a_network() -> None:
    text = SRC.read_text(encoding="utf-8")
    lowered = text.lower()
    assert "http" not in lowered
    assert "token" not in lowered or "no token" in lowered
    assert "telegram" not in lowered
    assert "urllib" not in lowered
    assert "httpx" not in lowered
