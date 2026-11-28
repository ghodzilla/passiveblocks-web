"""Human control requests. They stay refused until the exercised level allows them.

This module is not the desk view. The desk view cannot call it.
"""

from __future__ import annotations

from datetime import UTC, datetime

from pb_engine.autonomy import AutonomyRefused, require
from pb_engine.models import RiskEvent
from pb_engine.store import Store


def pause_entries(store: Store, *, actor: str, reason: str) -> str:
    """Pause new entries. Refused while the exercised level is below L2."""

    if not actor.strip() or not reason.strip():
        raise AutonomyRefused("actor and reason are required")
    require(store, 2)
    store.update_control(pause_new_entries=True)
    store.add(
        RiskEvent(
            ts=datetime.now(UTC),
            kind="entries_paused",
            severity="INFO",
            detail=f"{actor} paused new entries",
            payload={"actor": actor, "reason": reason},
        )
    )
    return "new entries paused. orders=none. nothing was sent."
