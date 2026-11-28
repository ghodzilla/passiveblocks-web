"""Write one desk-health row from the tables already stored.

The extra mix, risk and equity fields sit in the recovery JSON that the
schema already has. No new column is required.
"""

from __future__ import annotations

from datetime import datetime

from pb_engine.desk_api import get_desk_health
from pb_engine.models import DeskHealth
from pb_engine.store import Store


def record_health(store: Store, *, as_of: datetime) -> DeskHealth:
    view = get_desk_health(store)
    return store.add(
        DeskHealth(
            as_of=as_of,
            signal_escapes=int(view["signal_escapes"]),
            false_closes=int(view["false_closes"]),
            unnecessary_interruptions=int(view["unnecessary_interruptions"]),
            created_at=as_of,
            routing_accuracy=float(view["routing_accuracy"]),
            recovery={
                "stale_blocks": view["stale_blocks"],
                "gate_mix": view["gate_mix"],
                "close_mix": view["close_mix"],
                "open_risk": view["open_risk"],
                "equity_usdc": view["equity_usdc"],
                "drawdown": view["drawdown"],
                "limits": view["limits"],
            },
        )
    )
