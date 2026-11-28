"""Stock, index, and commodity session rules.

Clocks use ``America/New_York``. Nothing here fetches a calendar.
The lists in config are the closures this build knows about, not a
full exchange calendar. Crypto is not on these clocks.

The Monday–Thursday commodity maintenance break is not applied yet.
A commodity can still be blocked by the weekend, a full closure, or
an oil roll.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from pb_engine import config
from pb_engine.risk import Reason

ET = ZoneInfo("America/New_York")

_FRIDAY = 4
_SATURDAY = 5
_SUNDAY = 6


def session_kind(market: str) -> str:
    root = _root(market)
    if root in config.EXCLUDED_ROOTS:
        return "excluded"
    if root in config.INDEX_ROOTS:
        return "index"
    mapped = config.MARKET_CLUSTER.get(root)
    if mapped is not None:
        return mapped
    return "us_equity"


def cluster_name(market: str) -> str | None:
    kind = session_kind(market)
    if kind in {"crypto", "metals", "energy"}:
        return kind
    if kind in {"us_equity", "index"}:
        return "us_equity"
    return None


def session_state(market: str, now: datetime) -> str:
    kind = session_kind(market)
    if kind == "crypto":
        return "crypto"
    if kind == "excluded":
        return "excluded"
    if kind == "us_equity":
        return stock_session(now)
    return commodity_session(now)


def stock_session(now: datetime) -> str:
    """24/5 single-stock clock. Sunday 20:05 ET through Friday 20:00 ET."""

    local = _aware(now).astimezone(ET)
    day = local.date().isoformat()
    minutes = _minutes(local)
    if day in set(config.US_STOCK_HOLIDAYS):
        return "INTERNAL"
    early = _early_close_minute(day)
    if early is not None and minutes >= early - config.STOCK_PRECLOSE_MINUTES:
        if minutes < early:
            return "PRE_CLOSE"
        return "INTERNAL"
    close = config.STOCK_CLOSE_HOUR * 60 + config.STOCK_CLOSE_MINUTE
    reopen = config.STOCK_REOPEN_HOUR * 60 + config.STOCK_REOPEN_MINUTE
    preclose = close - config.STOCK_PRECLOSE_MINUTES
    weekday = local.weekday()
    if weekday == _SATURDAY or (weekday == _SUNDAY and minutes < reopen):
        return "INTERNAL"
    if weekday == _FRIDAY and minutes >= close:
        return "INTERNAL"
    if weekday == _FRIDAY and minutes >= preclose:
        return "PRE_CLOSE"
    return "EXTERNAL_OPEN"


def commodity_session(now: datetime) -> str:
    """Futures clock used for metals, oil, and the named index perps.

    Flat from 16:30 ET Friday until 18:00 ET Sunday, and on the full
    closures in config. The daily 17:00 break is not a flat window here.
    """

    local = _aware(now).astimezone(ET)
    if local.date().isoformat() in set(config.COMMODITY_CLOSED):
        return "INTERNAL"
    minutes = _minutes(local)
    close = config.COMMODITY_CLOSE_HOUR * 60 + config.COMMODITY_CLOSE_MINUTE
    flat_from = close - config.COMMODITY_FLAT_MINUTES
    reopen = config.COMMODITY_REOPEN_HOUR * 60 + config.COMMODITY_REOPEN_MINUTE
    weekday = local.weekday()
    if weekday == _SATURDAY or (weekday == _SUNDAY and minutes < reopen):
        return "INTERNAL"
    if weekday == _FRIDAY and minutes >= flat_from:
        return "INTERNAL"
    return "EXTERNAL_OPEN"


def session_block(
    market: str,
    now: datetime,
    *,
    hold_hours: float = 0,
    earnings_on: date | None = None,
) -> str | None:
    """Why a new entry is refused, or ``None`` when the clock allows it."""

    clock = _aware(now)
    kind = session_kind(market)
    if kind == "excluded":
        return Reason.EXCLUDED
    if kind == "us_equity":
        if stock_session(clock) != "EXTERNAL_OPEN":
            return Reason.SESSION
        if earnings_on is not None and _earnings_block(clock, earnings_on):
            return Reason.EARNINGS
    elif kind in {"metals", "energy", "index"} and commodity_session(clock) != "EXTERNAL_OPEN":
        return Reason.SESSION
    if (
        kind == "energy"
        and type(hold_hours) in {int, float}
        and hold_hours > 0
        and hold_crosses_oil_roll(market, clock, clock + timedelta(hours=float(hold_hours)))
    ):
        return Reason.OIL_ROLL
    return None


def oil_roll_steps(year: int, month: int) -> tuple[datetime, ...]:
    """17:30 ET on the 5th through 10th Monday–Friday of the month.

    Full commodity closures are skipped. Other holidays still count,
    because this build does not carry the futures holiday calendar.
    """

    if month < 1 or month > 12:
        raise ValueError("month must be 1..12")
    closed = set(config.COMMODITY_CLOSED)
    days: list[date] = []
    cursor = date(year, month, 1)
    while cursor.month == month:
        if cursor.weekday() < _SATURDAY and cursor.isoformat() not in closed:
            days.append(cursor)
        cursor += timedelta(days=1)
    start = config.OIL_ROLL_FIRST - 1
    chosen = days[start : config.OIL_ROLL_LAST]
    steps: list[datetime] = []
    for day in chosen:
        local = datetime(
            day.year,
            day.month,
            day.day,
            config.OIL_ROLL_HOUR,
            config.OIL_ROLL_MINUTE,
            tzinfo=ET,
        )
        steps.append(local.astimezone(UTC))
    return tuple(steps)


def hold_crosses_oil_roll(market: str, entry: datetime, exit_at: datetime) -> bool:
    if session_kind(market) != "energy":
        return False
    start = _aware(entry)
    end = _aware(exit_at)
    if end <= start:
        return False
    cursor = start.astimezone(ET).date().replace(day=1)
    last = end.astimezone(ET).date()
    while cursor <= last:
        for step in oil_roll_steps(cursor.year, cursor.month):
            if start < step <= end:
                return True
        cursor = _next_month(cursor)
    return False


def _earnings_block(now: datetime, earnings_on: date) -> bool:
    local = now.astimezone(ET).date()
    if not isinstance(earnings_on, date) or isinstance(earnings_on, datetime):
        raise TypeError("earnings_on must be a date")
    return earnings_on == local or local == _previous_weekday(earnings_on)


def _previous_weekday(day: date) -> date:
    holidays = set(config.US_STOCK_HOLIDAYS)
    prev = day - timedelta(days=1)
    while prev.weekday() >= _SATURDAY or prev.isoformat() in holidays:
        prev -= timedelta(days=1)
    return prev


def _early_close_minute(day: str) -> int | None:
    for name, hour, minute in config.US_STOCK_EARLY_CLOSES:
        if name == day:
            return hour * 60 + minute
    return None


def _minutes(local: datetime) -> int:
    return local.hour * 60 + local.minute


def _next_month(day: date) -> date:
    if day.month == 12:
        return date(day.year + 1, 1, 1)
    return date(day.year, day.month + 1, 1)


def _root(market: str) -> str:
    if not isinstance(market, str):
        return ""
    text = market.strip()
    if ":" in text:
        text = text.rsplit(":", 1)[-1]
    return text.upper()


def _aware(now: datetime) -> datetime:
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    return now.astimezone(UTC)
