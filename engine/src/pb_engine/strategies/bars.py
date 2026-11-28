"""Candles as bars. No network."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from pb_engine.market_data.types import Candle


@dataclass(frozen=True, slots=True)
class Bar:
    open_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


def bars_for(candles: tuple[Candle, ...] | list[Candle], coin: str, interval: str) -> list[Bar]:
    rows = [row for row in candles if row.coin == coin and row.interval == interval]
    return [
        Bar(
            open_time=datetime.fromtimestamp(row.open_time_ms / 1000, UTC),
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
            volume=row.volume,
        )
        for row in rows
    ]
