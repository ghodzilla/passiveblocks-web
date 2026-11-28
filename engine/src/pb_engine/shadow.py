"""Walk a recorded L2 book. This does not send an order.

Buys take asks and sells take bids, best price first, until the size
is filled or the next level is past the slip cap. The remainder is
cancelled. The fee is the published tier-0 taker rate for that market.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from pb_engine import config
from pb_engine.market_data.types import Book, BookLevel
from pb_engine.session import session_kind

_DUST = 1e-12


@dataclass(frozen=True, slots=True)
class Walk:
    filled: float
    average_px: float
    best_px: float
    notional: float
    fee: float
    slippage_usd: float
    slip_fraction: float
    cancelled: float
    complete: bool


def taker_fee(market: str, *, growth_mode: bool, fee_scale: float | None) -> float:
    """Tier-0 taker rate. ``fee_scale`` is the meta row's deployer scale.

    Core names ignore growth mode. There is no account fee lookup.
    """

    if session_kind(market) == "crypto":
        base = config.TAKER_FEE_CORE
    elif growth_mode:
        base = config.TAKER_FEE_GROWTH
    else:
        base = config.TAKER_FEE_HIP3
    scale = 1.0 if fee_scale is None else fee_scale
    if isinstance(scale, bool) or not isinstance(scale, (int, float)):
        raise TypeError("fee scale must be a number")
    if not math.isfinite(scale) or scale < 0:
        raise ValueError("fee scale must be a non-negative finite number")
    return float(base) * float(scale)


def slip_cap(market: str) -> float:
    kind = session_kind(market)
    if kind == "crypto":
        return config.SLIP_CAP_CRYPTO
    if kind == "index":
        return config.SLIP_CAP_INDEX
    if kind in {"metals", "energy"}:
        return config.SLIP_CAP_COMMODITY
    return config.SLIP_CAP_STOCK


def round_trip_cost(fee_rate: float) -> float:
    if isinstance(fee_rate, bool) or not isinstance(fee_rate, (int, float)):
        raise TypeError("fee rate must be a number")
    if not math.isfinite(fee_rate) or fee_rate < 0:
        raise ValueError("fee rate must be a non-negative finite number")
    return float(fee_rate) * config.TAKER_LEGS


def funding_payment(*, notional: float, hourly_rate: float, hours: float, side: str) -> float:
    """Signed USDC over the hold. Positive means the position pays.

    The rate is the published hourly rate. A positive rate is paid by longs.
    """

    if side not in {"long", "short"}:
        raise ValueError("side must be long or short")
    _finite("notional", notional)
    _finite("hourly_rate", hourly_rate)
    _finite("hours", hours)
    if notional < 0 or hours < 0:
        raise ValueError("notional and hours must be >= 0")
    sign = 1.0 if side == "long" else -1.0
    return sign * float(notional) * float(hourly_rate) * float(hours)


def walk_book(
    book: Book,
    *,
    side: str,
    size: float,
    slip_cap: float,
    fee_rate: float,
) -> Walk | None:
    """Fill ``size`` in coin units against one side of the book.

    Returns ``None`` when nothing trades. A partial fill is returned
    with ``complete`` false; the unfilled size is the cancelled part.
    """

    if side not in {"long", "short"}:
        raise ValueError("side must be long or short")
    _finite("size", size)
    _finite("slip_cap", slip_cap)
    _finite("fee_rate", fee_rate)
    if size <= 0 or slip_cap < 0 or fee_rate < 0:
        raise ValueError("size, slip cap, and fee must be non-negative, and size > 0")
    levels = _levels(book, side)
    if not levels:
        return None
    best = levels[0].px
    if best <= 0:
        return None
    limit = best * (1 + slip_cap) if side == "long" else best * (1 - slip_cap)
    filled = 0.0
    notional = 0.0
    for level in levels:
        if level.px <= 0 or level.sz <= 0:
            continue
        if side == "long" and level.px > limit:
            break
        if side == "short" and level.px < limit:
            break
        take = min(level.sz, size - filled)
        if take <= 0:
            break
        filled += take
        notional += take * level.px
        if filled + _DUST >= size:
            filled = size
            break
    if filled <= 0 or notional <= 0:
        return None
    average = notional / filled
    slip = abs(average - best) / best
    return Walk(
        filled=filled,
        average_px=average,
        best_px=best,
        notional=notional,
        fee=notional * fee_rate,
        slippage_usd=abs(average - best) * filled,
        slip_fraction=slip,
        cancelled=max(0.0, size - filled),
        complete=filled + _DUST >= size,
    )


def _levels(book: Book, side: str) -> tuple[BookLevel, ...]:
    if side == "long":
        return tuple(sorted(book.asks, key=lambda level: level.px))
    return tuple(sorted(book.bids, key=lambda level: level.px, reverse=True))


def _finite(label: str, value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{label} must be a number")
    if not math.isfinite(value):
        raise ValueError(f"{label} must be finite")
    return float(value)
