"""Autonomy levels L0 to L4. Spec §9.4.

The ceiling is ``AUTONOMY_CAP`` and stays a literal in config. The level
this simulation actually uses starts at L1. Raising it needs a person to
pass the confirm flag. Nothing in the cycle raises it. L4 actions, such
as changing the leverage cap, are refused.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime

from pb_engine import config
from pb_engine.models import RiskEvent
from pb_engine.store import Store

NAMES = {
    0: "Read",
    1: "Prepare",
    2: "Reversible",
    3: "Trade",
    4: "Money",
}

_LEVEL_KIND = "autonomy_level"
_REFUSED_KIND = "autonomy_refused"
_START = 1


class AutonomyRefused(PermissionError):
    """The requested level is above the one a person has confirmed."""


@dataclass(frozen=True, slots=True)
class Autonomy:
    exercised: int
    cap: int
    name: str


def describe(store: Store) -> Autonomy:
    level = exercised_level(store)
    return Autonomy(level, int(config.AUTONOMY_CAP), NAMES[level])


def exercised_level(store: Store) -> int:
    rows = store.read(
        "select payload from hl_risk_event where kind = ? order by id desc limit 1",
        (_LEVEL_KIND,),
    )
    if not rows:
        return _START
    payload = rows[0].get("payload")
    level = _payload_level(payload)
    if level is None:
        return _START
    return level


def promote(
    store: Store,
    level: int,
    *,
    confirmed: bool,
    actor: str,
    reason: str,
) -> Autonomy:
    """Raise or lower the exercised level. ``confirmed`` must be true.

    This does not change a risk limit. A level above the cap is refused.
    """

    now = datetime.now(UTC)
    if not isinstance(level, int) or isinstance(level, bool) or level not in NAMES:
        _log_refusal(store, now, "level must be 0 to 4")
        raise AutonomyRefused("level must be 0 to 4")
    if level > int(config.AUTONOMY_CAP):
        _log_refusal(store, now, "above the cap")
        raise AutonomyRefused("above the cap")
    if not confirmed:
        _log_refusal(store, now, "confirm flag missing")
        raise AutonomyRefused("promotion needs a manual confirm flag")
    if not actor.strip() or not reason.strip():
        _log_refusal(store, now, "actor and reason are required")
        raise AutonomyRefused("actor and reason are required")
    store.add(
        RiskEvent(
            ts=now,
            kind=_LEVEL_KIND,
            severity="INFO",
            detail=f"{actor} set the exercised level to L{level}",
            payload={"level": level, "actor": actor, "reason": reason},
        )
    )
    return describe(store)


def require(store: Store, level: int) -> None:
    """Refuse work above the exercised level. Does not raise the level."""

    current = exercised_level(store)
    if level > current:
        raise AutonomyRefused(f"L{level} is above the exercised level L{current}")
    if level > int(config.AUTONOMY_CAP):
        raise AutonomyRefused("above the cap")


def _log_refusal(store: Store, now: datetime, detail: str) -> None:
    store.add(
        RiskEvent(
            ts=now,
            kind=_REFUSED_KIND,
            severity="WARN",
            detail=detail,
            payload={"taken": False},
        )
    )


def _payload_level(payload: object) -> int | None:
    if not isinstance(payload, str):
        return None
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    level = parsed.get("level")
    if isinstance(level, bool) or not isinstance(level, int):
        return None
    if level not in NAMES or level > int(config.AUTONOMY_CAP):
        return None
    return level
