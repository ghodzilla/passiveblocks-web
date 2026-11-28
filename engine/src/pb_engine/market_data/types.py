"""Public market-data values. These types do not open a connection."""

from __future__ import annotations

from dataclasses import dataclass

# Stage 1's live loop is these three. HIP-3 names can still be read.
CORE_COINS: tuple[str, ...] = ("BTC", "ETH", "SOL")

# trade[XYZ]. The dex index comes from the public dex list, not from here.
HIP3_DEX: str = "xyz"

PUBLIC_CHANNELS: tuple[str, ...] = ("l2Book", "trades", "candle", "activeAssetCtx")

CANDLE_INTERVALS: frozenset[str] = frozenset({"1m", "5m", "15m", "1h", "4h", "1d"})


@dataclass(frozen=True, slots=True)
class BookLevel:
    px: float
    sz: float
    n: int


@dataclass(frozen=True, slots=True)
class Book:
    coin: str
    time_ms: int
    bids: tuple[BookLevel, ...]
    asks: tuple[BookLevel, ...]


@dataclass(frozen=True, slots=True)
class Candle:
    coin: str
    interval: str
    open_time_ms: int
    close_time_ms: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    trades: int


@dataclass(frozen=True, slots=True)
class FundingPrint:
    coin: str
    time_ms: int
    rate: float
    premium: float | None


@dataclass(frozen=True, slots=True)
class Trade:
    """A public print. Account addresses from the wire are not kept."""

    coin: str
    side: str
    px: float
    sz: float
    time_ms: int


@dataclass(frozen=True, slots=True)
class PerpMeta:
    """One market from meta.

    ``venue_max_leverage`` is the venue's published maximum. It is not
    the engine cap.
    """

    name: str
    dex: str
    index: int
    asset_id: int
    sz_decimals: int
    venue_max_leverage: int
    growth_mode: bool
    deployer_fee_scale: float | None


@dataclass(frozen=True, slots=True)
class PerpCtx:
    name: str
    mark_px: float | None
    mid_px: float | None
    oracle_px: float | None
    funding: float | None
    open_interest: float | None
    day_notional_volume: float | None
    premium: float | None
    impact_bid: float | None
    impact_ask: float | None


def asset_id(index: int, dex_index: int | None) -> int:
    """Core perps use their meta position. HIP-3 adds the dex position.

    The dex position is an argument. This function does not know which
    deployer sits at which position.
    """

    if index < 0:
        raise ValueError("asset index must be >= 0")
    if dex_index is None:
        return index
    if dex_index < 0:
        raise ValueError("dex index must be >= 0")
    return 100_000 + dex_index * 10_000 + index
