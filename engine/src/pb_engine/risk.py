"""Pre-trade risk limits.

This module sizes a new simulated entry and latches the daily stop and
the drawdown kill. It does not submit, cancel, or flatten anything.
A ``must_flatten`` flag means a later stage would have to close positions.
That stage does not exist in this package.

Call ``note_equity`` as equity changes, then pass that state into
``size_position``. Sizing trusts the flags on the state it is given.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from pb_engine import config

log = logging.getLogger("pb_engine.risk")


class Reason:
    """Stable rejection and halt names. Limits themselves live in config."""

    BAD_EQUITY = "bad_equity"
    BAD_STOP = "bad_stop"
    BAD_MARKET = "bad_market"
    BAD_SIDE = "bad_side"
    BAD_CLUSTER = "bad_cluster"
    BAD_BOOK = "bad_book"
    BAD_WEIGHT = "bad_weight"
    ZERO_WEIGHT = "zero_weight"
    BELOW_MIN = "below_min"
    LEVERAGE_CAP = "leverage_cap"
    NET_EXPOSURE = "net_exposure"
    MAX_POSITIONS = "max_positions"
    ONE_PER_MARKET = "one_per_market"
    CLUSTER_POSITIONS = "cluster_positions"
    CLUSTER_RISK = "cluster_risk"
    TOTAL_RISK = "total_risk"
    DAILY_LOSS_STOP = "daily_loss_stop"
    DRAWDOWN_KILL = "drawdown_kill"
    STOP_COST = "stop_vs_cost"
    FUNDING_EDGE = "funding_edge"
    FUNDING_BLACKOUT = "funding_blackout"
    ENTRY_CAP = "entry_cap"
    LOSS_PAUSE = "loss_pause"
    SESSION = "session"
    EARNINGS = "earnings"
    OIL_ROLL = "oil_roll"
    EXCLUDED = "excluded_market"
    STALE = "stale_data"


@dataclass(frozen=True, slots=True)
class OpenPosition:
    market: str
    notional_usd: float
    side: str
    stop_distance_pct: float
    cluster: str


@dataclass(frozen=True, slots=True)
class SizeDecision:
    accepted: bool
    notional_usd: float
    risk_usd: float
    reason: str | None

    def __post_init__(self) -> None:
        if self.accepted:
            if self.reason is not None or self.notional_usd <= 0 or self.risk_usd <= 0:
                raise ValueError("accepted size is inconsistent")
        elif self.notional_usd != 0 or self.risk_usd != 0 or not self.reason:
            raise ValueError("rejected size must be zero and carry a reason")


@dataclass(frozen=True, slots=True)
class RiskState:
    peak_equity: float
    day_start_equity: float
    day_utc: date
    halted: bool
    halt_reason: str | None
    daily_stopped: bool

    @property
    def must_flatten(self) -> bool:
        """True when the limits say positions should be closed.

        Nothing in this package sends that close.
        """

        return self.halted or self.daily_stopped

    @property
    def entries_allowed(self) -> bool:
        return not self.must_flatten


def initial_state(equity: float, now: datetime) -> RiskState:
    now_utc = _require_utc(now)
    amount = _require_positive(equity, "equity")
    return RiskState(
        peak_equity=amount,
        day_start_equity=amount,
        day_utc=now_utc.date(),
        halted=False,
        halt_reason=None,
        daily_stopped=False,
    )


def note_equity(state: RiskState, equity: float, now: datetime) -> RiskState:
    """Fold one equity observation into the daily stop and the drawdown kill.

    A drawdown halt stays on across later observations, including a new
    UTC day and a full recovery. Only ``resume_from_drawdown_kill`` clears
    it. The daily stop clears itself when the UTC date changes.
    """

    now_utc = _require_utc(now)
    if isinstance(equity, bool) or not isinstance(equity, (int, float)):
        raise TypeError("equity must be a number")
    if not math.isfinite(equity):
        raise ValueError("equity must be finite")

    day = now_utc.date()
    if day != state.day_utc:
        day_start = float(equity) if equity > 0 else state.day_start_equity
        daily_stopped = False
    else:
        day_start = state.day_start_equity
        daily_stopped = state.daily_stopped

    peak = state.peak_equity
    if equity > peak:
        peak = float(equity)

    halted = state.halted
    halt_reason = state.halt_reason
    blown = equity <= 0 or _loss_at_least(peak, equity, config.DRAWDOWN_KILL)
    if blown:
        halted = True
        halt_reason = Reason.DRAWDOWN_KILL

    if equity <= 0 or _loss_at_least(day_start, equity, config.DAILY_LOSS_STOP):
        daily_stopped = True

    return RiskState(
        peak_equity=peak,
        day_start_equity=day_start,
        day_utc=day,
        halted=halted,
        halt_reason=halt_reason,
        daily_stopped=daily_stopped,
    )


def resume_from_drawdown_kill(
    state: RiskState,
    equity: float,
    now: datetime,
    *,
    actor: str,
) -> RiskState:
    """Clear a drawdown halt. This is the manual restart.

    The peak is set to ``equity``, so the next kill is another full
    drawdown from the restart point. The drawdown limit itself does not
    change. A daily stop that belongs to the same UTC day stays on.
    """

    now_utc = _require_utc(now)
    amount = _require_positive(equity, "equity")
    who = _clean_actor(actor)
    if not state.halted or state.halt_reason != Reason.DRAWDOWN_KILL:
        raise ValueError("no drawdown kill to resume")

    day = now_utc.date()
    if day != state.day_utc:
        day_start = amount
        daily_stopped = False
    else:
        day_start = state.day_start_equity
        daily_stopped = state.daily_stopped

    log.info(
        "drawdown kill cleared by %s; peak rebased to current equity; limits unchanged",
        who,
    )
    return RiskState(
        peak_equity=amount,
        day_start_equity=day_start,
        day_utc=day,
        halted=False,
        halt_reason=None,
        daily_stopped=daily_stopped,
    )


def size_position(
    *,
    equity: float,
    stop_distance_pct: float,
    market: str,
    side: str,
    cluster: str,
    open_positions: tuple[OpenPosition, ...] | list[OpenPosition] = (),
    weight: float = 1.0,
    risk_state: RiskState | None = None,
) -> SizeDecision:
    """Size one new entry.

    The notional is the risk budget divided by the stop distance, then
    cut by the per-position equity ceiling. That cut can only reduce
    risk. If the result would still push account gross leverage over
    the cap, the entry is rejected. It is not cut down again to fill
    whatever room is left.
    """

    if risk_state is not None:
        if risk_state.halted:
            return _reject(Reason.DRAWDOWN_KILL)
        if risk_state.daily_stopped:
            return _reject(Reason.DAILY_LOSS_STOP)

    equity_d = _optional_positive(equity)
    if equity_d is None:
        return _reject(Reason.BAD_EQUITY)

    stop_d = _optional_stop(stop_distance_pct)
    if stop_d is None:
        return _reject(Reason.BAD_STOP)

    canonical = _canonical_market(market)
    if canonical is None:
        return _reject(Reason.BAD_MARKET)

    side_name = side.strip().lower() if isinstance(side, str) else ""
    if side_name not in {"long", "short"}:
        return _reject(Reason.BAD_SIDE)

    if cluster not in config.CLUSTERS:
        return _reject(Reason.BAD_CLUSTER)
    mapped = config.MARKET_CLUSTER.get(canonical)
    if mapped is not None and mapped != cluster:
        return _reject(Reason.BAD_CLUSTER)

    book = _validated_book(open_positions, equity_d)
    if isinstance(book, str):
        return _reject(book)

    if len(book) >= config.MAX_POSITIONS:
        return _reject(Reason.MAX_POSITIONS)
    if any(position.market == canonical for position in book):
        return _reject(Reason.ONE_PER_MARKET)
    if cluster == "energy":
        energy_open = sum(1 for position in book if position.cluster == "energy")
        if energy_open >= config.ENERGY_MAX_POSITIONS:
            return _reject(Reason.CLUSTER_POSITIONS)

    weight_d = _optional_weight(weight)
    if weight_d is None:
        return _reject(Reason.BAD_WEIGHT)
    if weight_d == 0:
        return _reject(Reason.ZERO_WEIGHT)

    budget = equity_d * _d(config.RISK_PER_TRADE) * weight_d
    desired = budget / stop_d
    per_position_cap = equity_d * _d(config.MAX_POSITION_NOTIONAL_MULTIPLE)
    sized = min(desired, per_position_cap)
    if sized < _d(config.MIN_ORDER_USD):
        return _reject(Reason.BELOW_MIN)

    existing_gross = sum(
        (_d(position.notional_usd) for position in book),
        start=Decimal(0),
    )
    if existing_gross + sized > equity_d * _d(config.MAX_LEVERAGE):
        return _reject(Reason.LEVERAGE_CAP)

    longs, shorts = _sided_notionals(book)
    if side_name == "long":
        longs += sized
    else:
        shorts += sized
    if abs(longs - shorts) > equity_d * _d(config.MAX_NET_DIRECTIONAL):
        return _reject(Reason.NET_EXPOSURE)

    actual_risk = sized * stop_d
    if _cluster_risk(book, cluster) + actual_risk > equity_d * _d(config.CLUSTER_RISK_CAP):
        return _reject(Reason.CLUSTER_RISK)
    if _total_risk(book) + actual_risk > equity_d * _d(config.TOTAL_RISK_CAP):
        return _reject(Reason.TOTAL_RISK)

    return SizeDecision(
        accepted=True,
        notional_usd=float(sized),
        risk_usd=float(actual_risk),
        reason=None,
    )


def _reject(reason: str) -> SizeDecision:
    return SizeDecision(accepted=False, notional_usd=0.0, risk_usd=0.0, reason=reason)


def _validated_book(
    positions: tuple[OpenPosition, ...] | list[OpenPosition],
    equity: Decimal,
) -> tuple[OpenPosition, ...] | str:
    if not isinstance(positions, (tuple, list)):
        return Reason.BAD_BOOK

    cleaned: list[OpenPosition] = []
    seen: set[str] = set()
    for position in positions:
        if not isinstance(position, OpenPosition):
            return Reason.BAD_BOOK
        market = _canonical_market(position.market)
        notional = _optional_positive(position.notional_usd)
        stop = _optional_stop(position.stop_distance_pct)
        side_name = position.side.strip().lower() if isinstance(position.side, str) else ""
        if (
            market is None
            or notional is None
            or stop is None
            or side_name not in {"long", "short"}
            or position.cluster not in config.CLUSTERS
        ):
            return Reason.BAD_BOOK
        mapped = config.MARKET_CLUSTER.get(market)
        if mapped is not None and mapped != position.cluster:
            return Reason.BAD_BOOK
        if market in seen:
            return Reason.BAD_BOOK
        seen.add(market)
        cleaned.append(
            OpenPosition(
                market=market,
                notional_usd=float(notional),
                side=side_name,
                stop_distance_pct=float(stop),
                cluster=position.cluster,
            )
        )

    book = tuple(cleaned)
    if len(book) > config.MAX_POSITIONS:
        return Reason.BAD_BOOK

    gross = sum((_d(position.notional_usd) for position in book), start=Decimal(0))
    if gross > equity * _d(config.MAX_LEVERAGE):
        return Reason.BAD_BOOK

    longs, shorts = _sided_notionals(book)
    if abs(longs - shorts) > equity * _d(config.MAX_NET_DIRECTIONAL):
        return Reason.BAD_BOOK

    energy_open = sum(1 for position in book if position.cluster == "energy")
    if energy_open > config.ENERGY_MAX_POSITIONS:
        return Reason.BAD_BOOK

    for cluster_name in config.CLUSTERS:
        if _cluster_risk(book, cluster_name) > equity * _d(config.CLUSTER_RISK_CAP):
            return Reason.BAD_BOOK
    if _total_risk(book) > equity * _d(config.TOTAL_RISK_CAP):
        return Reason.BAD_BOOK
    return book


def _cluster_risk(book: tuple[OpenPosition, ...], cluster: str) -> Decimal:
    return sum(
        (
            _d(position.notional_usd) * _d(position.stop_distance_pct)
            for position in book
            if position.cluster == cluster
        ),
        start=Decimal(0),
    )


def _total_risk(book: tuple[OpenPosition, ...]) -> Decimal:
    return sum(
        (
            _d(position.notional_usd) * _d(position.stop_distance_pct)
            for position in book
        ),
        start=Decimal(0),
    )


def _sided_notionals(book: tuple[OpenPosition, ...]) -> tuple[Decimal, Decimal]:
    longs = Decimal(0)
    shorts = Decimal(0)
    for position in book:
        notional = _d(position.notional_usd)
        if position.side == "long":
            longs += notional
        else:
            shorts += notional
    return longs, shorts


def _canonical_market(market: object) -> str | None:
    if not isinstance(market, str):
        return None
    cleaned = market.strip()
    if not cleaned or any(character.isspace() for character in cleaned):
        return None
    upper = cleaned.upper()
    if upper in config.MARKET_CLUSTER:
        return upper
    return cleaned


def _optional_positive(value: object) -> Decimal | None:
    number = _finite_number(value)
    if number is None or number <= 0:
        return None
    return number


def _optional_stop(value: object) -> Decimal | None:
    number = _finite_number(value)
    if number is None or number <= 0 or number > 1:
        return None
    return number


def _optional_weight(value: object) -> Decimal | None:
    number = _finite_number(value)
    if number is None or number < 0 or number > 1:
        return None
    return number


def _finite_number(value: object) -> Decimal | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value):
        return None
    return _d(value)


def _d(value: float | int) -> Decimal:
    return Decimal(str(value))


def _loss_at_least(reference: float, current: float, limit: float) -> bool:
    if reference <= 0:
        return True
    loss = (_d(reference) - _d(current)) / _d(reference)
    return loss >= _d(limit)


def _require_utc(now: datetime) -> datetime:
    if not isinstance(now, datetime) or now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be a timezone-aware datetime")
    return now.astimezone(UTC)


def _require_positive(value: object, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{label} must be a number")
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{label} must be a positive finite number")
    return float(value)


def _clean_actor(actor: str) -> str:
    if not isinstance(actor, str):
        raise TypeError("actor must be a string")
    cleaned = " ".join(actor.split())
    if not cleaned or len(cleaned) > 200:
        raise ValueError("manual restart requires a short actor name")
    return cleaned


def guard_candidate(
    *,
    side: str,
    now: datetime,
    stop_distance_pct: float,
    round_trip_cost: float,
    pred_edge_r: float,
    hold_hours: float,
    funding_rate: float,
    entries_today: int,
    consecutive_losses: int,
    last_loss_at: datetime | None,
    pace: bool = True,
) -> str | None:
    """Stop, funding, daily entry count, and the six-loss pause.

    Session rules live next to the calendar. Sizing is still
    ``size_position``. A ``None`` return means these checks passed.
    """

    now_utc = _require_utc(now)
    if side not in {"long", "short"}:
        return Reason.BAD_SIDE
    _count("entries_today", entries_today)
    _count("consecutive_losses", consecutive_losses)
    stop = _stop_cost(stop_distance_pct, round_trip_cost)
    if stop is not None:
        return stop
    funding = _funding(
        side=side,
        now=now_utc,
        stop_distance_pct=stop_distance_pct,
        pred_edge_r=pred_edge_r,
        hold_hours=hold_hours,
        funding_rate=funding_rate,
    )
    if funding is not None:
        return funding
    if not pace:
        return None
    if entries_today >= config.MAX_ENTRIES_PER_DAY:
        return Reason.ENTRY_CAP
    return _loss_pause(consecutive_losses, last_loss_at, now_utc)


def _stop_cost(stop_distance_pct: float, round_trip_cost: float) -> str | None:
    stop = _optional_stop(stop_distance_pct)
    cost = _finite_number(round_trip_cost)
    if stop is None or cost is None or cost < 0:
        return Reason.BAD_STOP
    if stop < _d(config.STOP_COST_MULTIPLE) * cost:
        return Reason.STOP_COST
    return None


def _funding(
    *,
    side: str,
    now: datetime,
    stop_distance_pct: float,
    pred_edge_r: float,
    hold_hours: float,
    funding_rate: float,
) -> str | None:
    edge = _finite_number(pred_edge_r)
    hours = _finite_number(hold_hours)
    rate = _finite_number(funding_rate)
    if edge is None or hours is None or rate is None or hours <= 0:
        return Reason.BAD_STOP
    if side == "long":
        paid = rate if rate > 0 else 0
    else:
        paid = -rate if rate < 0 else 0
    if edge > 0 and stop_distance_pct > 0:
        cost_r = (paid * hours) / _d(stop_distance_pct)
        if cost_r > _d(config.FUNDING_OF_EDGE) * edge:
            return Reason.FUNDING_EDGE
    seconds_until_tick = (60 - now.minute) * 60 - now.second
    window = config.FUNDING_BLACKOUT_MINUTES * 60
    if 0 < seconds_until_tick <= window:
        against_long = side == "long" and rate > _d(config.FUNDING_AGAINST_PER_HOUR)
        against_short = side == "short" and rate < -_d(config.FUNDING_AGAINST_PER_HOUR)
        if against_long or against_short:
            return Reason.FUNDING_BLACKOUT
    return None


def _loss_pause(
    consecutive_losses: int,
    last_loss_at: datetime | None,
    now: datetime,
) -> str | None:
    if consecutive_losses < config.LOSS_STREAK:
        return None
    if last_loss_at is None:
        return Reason.LOSS_PAUSE
    last = _require_utc(last_loss_at)
    if now < last + timedelta(hours=config.LOSS_PAUSE_HOURS):
        return Reason.LOSS_PAUSE
    return None


def _count(label: str, value: object) -> None:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{label} must be an int")
    if value < 0:
        raise ValueError(f"{label} must be >= 0")
