"""Turn public info payloads into the market-data types."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pb_engine.market_data.types import (
    Book,
    BookLevel,
    Candle,
    FundingPrint,
    PerpCtx,
    PerpMeta,
    Trade,
    asset_id,
)


def parse_mids(payload: Mapping[str, Any]) -> dict[str, float]:
    return {str(name): float(px) for name, px in payload.items()}


def parse_book(payload: Mapping[str, Any]) -> Book:
    levels = payload.get("levels")
    if not isinstance(levels, list) or len(levels) != 2:
        raise ValueError("book levels must be bids and asks")
    return Book(
        coin=str(payload["coin"]),
        time_ms=int(payload["time"]),
        bids=tuple(_level(row) for row in levels[0]),
        asks=tuple(_level(row) for row in levels[1]),
    )


def parse_candles(payload: list[Any]) -> tuple[Candle, ...]:
    return tuple(parse_candle(row) for row in payload)


def parse_candle(payload: Mapping[str, Any]) -> Candle:
    return Candle(
        coin=str(payload["s"]),
        interval=str(payload["i"]),
        open_time_ms=int(payload["t"]),
        close_time_ms=int(payload["T"]),
        open=float(payload["o"]),
        high=float(payload["h"]),
        low=float(payload["l"]),
        close=float(payload["c"]),
        volume=float(payload["v"]),
        trades=int(payload["n"]),
    )


def parse_funding(payload: list[Any]) -> tuple[FundingPrint, ...]:
    rows = []
    for item in payload:
        premium = item.get("premium")
        rows.append(
            FundingPrint(
                coin=str(item["coin"]),
                time_ms=int(item["time"]),
                rate=float(item["fundingRate"]),
                premium=None if premium is None else float(premium),
            )
        )
    return tuple(rows)


def parse_trade(payload: Mapping[str, Any]) -> Trade:
    """Keep the print. Drop hash and account fields if the wire sent them."""

    side = payload.get("side")
    if side == "B":
        name = "buy"
    elif side == "A":
        name = "sell"
    else:
        raise ValueError("unknown trade side")
    return Trade(
        coin=str(payload["coin"]),
        side=name,
        px=float(payload["px"]),
        sz=float(payload["sz"]),
        time_ms=int(payload["time"]),
    )


def parse_meta(
    payload: Mapping[str, Any],
    *,
    dex: str = "",
    dex_index: int | None = None,
) -> tuple[PerpMeta, ...]:
    universe = payload.get("universe")
    if not isinstance(universe, list):
        raise ValueError("meta universe is missing")
    if dex and dex_index is None:
        raise ValueError("hip-3 meta needs the dex index")
    assets: list[PerpMeta] = []
    for index, item in enumerate(universe):
        raw_name = str(item["name"])
        name = raw_name if not dex or raw_name.startswith(f"{dex}:") else f"{dex}:{raw_name}"
        scale = item.get("deployerFeeScale")
        assets.append(
            PerpMeta(
                name=name,
                dex=dex,
                index=index,
                asset_id=asset_id(index, dex_index if dex else None),
                sz_decimals=int(item["szDecimals"]),
                venue_max_leverage=int(item["maxLeverage"]),
                growth_mode=item.get("growthMode") == "enabled",
                deployer_fee_scale=None if scale is None else float(scale),
            )
        )
    return tuple(assets)


def parse_ctx_record(name: str, payload: Mapping[str, Any]) -> PerpCtx:
    bid, ask = _impact(payload.get("impactPxs"))
    return PerpCtx(
        name=name,
        mark_px=_opt_float(payload.get("markPx")),
        mid_px=_opt_float(payload.get("midPx")),
        oracle_px=_opt_float(payload.get("oraclePx")),
        funding=_opt_float(payload.get("funding")),
        open_interest=_opt_float(payload.get("openInterest")),
        day_notional_volume=_opt_float(payload.get("dayNtlVlm")),
        premium=_opt_float(payload.get("premium")),
        impact_bid=bid,
        impact_ask=ask,
    )


def parse_asset_ctxs(
    payload: list[Any],
    *,
    dex: str = "",
    dex_index: int | None = None,
) -> tuple[PerpCtx, ...]:
    if len(payload) != 2:
        raise ValueError("asset contexts must be meta plus rows")
    meta = parse_meta(payload[0], dex=dex, dex_index=dex_index)
    rows = payload[1]
    if len(meta) != len(rows):
        raise ValueError("meta and context length differ")
    return tuple(parse_ctx_record(asset.name, row) for asset, row in zip(meta, rows, strict=True))


def parse_active_ctx(payload: Mapping[str, Any]) -> PerpCtx:
    ctx = payload.get("ctx")
    if not isinstance(ctx, Mapping):
        raise ValueError("active asset context is missing")
    return parse_ctx_record(str(payload["coin"]), ctx)


def parse_dex_indexes(payload: list[Any]) -> dict[str, int]:
    """Map a dex name to its list position. Extra fields are ignored."""

    found: dict[str, int] = {}
    for index, item in enumerate(payload):
        if not isinstance(item, Mapping):
            continue
        name = item.get("name")
        if isinstance(name, str) and name:
            found[name] = index
    return found


def _level(payload: Mapping[str, Any]) -> BookLevel:
    return BookLevel(px=float(payload["px"]), sz=float(payload["sz"]), n=int(payload["n"]))


def _impact(value: object) -> tuple[float | None, float | None]:
    if value is None:
        return None, None
    if not isinstance(value, list) or len(value) < 2:
        raise ValueError("impact prices must be a bid and an ask")
    return float(value[0]), float(value[1])


def _opt_float(value: object) -> float | None:
    if value is None or value == "":
        return None
    return float(value)
