"""Queue a local alert. This build does not send it.

No token is read and no message leaves the machine. The row stays in
the outbox with an empty sent time.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

from pb_engine.models import AlertOutbox
from pb_engine.store import Store

NOTHING_SENT = "alert queued locally. nothing was sent. no token was read."


def enqueue(store: Store, *, severity: str, dedup_key: str, body: str) -> AlertOutbox:
    if severity not in {"CRITICAL", "WARN", "INFO"}:
        raise ValueError("severity must be CRITICAL, WARN, or INFO")
    if not dedup_key.strip() or not body.strip():
        raise ValueError("dedup key and body are required")
    existing = store.read(
        "select id from hl_alert_outbox where dedup_key = ? limit 1",
        (dedup_key,),
    )
    if existing:
        found = store.get(AlertOutbox, int(existing[0]["id"]))
        if found is None:
            raise RuntimeError("queued alert could not be read")
        return found
    return store.add(
        AlertOutbox(
            severity=severity,
            dedup_key=dedup_key,
            body=body,
            created_at=datetime.now(UTC),
        )
    )


_UNIT = re.compile(r"^[A-Za-z0-9_@.-]{1,80}$")


def alert_failure(store: Store, unit: str) -> str:
    """Queue a note that a unit failed. Nothing is sent."""

    if not isinstance(unit, str) or _UNIT.fullmatch(unit) is None:
        raise ValueError("unit name must be a plain service name")
    hour = datetime.now(UTC).strftime("%Y%m%d%H")
    enqueue(
        store,
        severity="WARN",
        dedup_key=f"unit-failed:{unit}:{hour}",
        body=f"{unit} failed. The note stays on this machine.",
    )
    return NOTHING_SENT


def alert_test(store: Store) -> str:
    enqueue(
        store,
        severity="INFO",
        dedup_key="alert-test",
        body="test alert. this row stays on this machine.",
    )
    return NOTHING_SENT
