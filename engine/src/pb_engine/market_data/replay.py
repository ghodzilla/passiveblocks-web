"""Load the committed public snapshots. This does not open a connection."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from pb_engine.market_data.parse import (
    parse_asset_ctxs,
    parse_book,
    parse_candles,
    parse_dex_indexes,
    parse_funding,
    parse_meta,
    parse_mids,
)
from pb_engine.market_data.types import Book, Candle, FundingPrint, PerpCtx, PerpMeta


@dataclass(frozen=True, slots=True)
class Tape:
    captured_at: datetime
    dex_index: dict[str, int]
    meta: tuple[PerpMeta, ...]
    ctxs: tuple[PerpCtx, ...]
    mids: dict[str, float]
    books: tuple[Book, ...]
    candles: tuple[Candle, ...]
    funding: tuple[FundingPrint, ...]


def load_tape(path: str | Path) -> Tape:
    root = Path(path)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    captured_at = datetime.fromisoformat(str(manifest["captured_at"]))
    if captured_at.tzinfo is None or captured_at.utcoffset() is None:
        raise ValueError("fixture capture time must be timezone-aware")
    docs = [
        json.loads(file.read_text(encoding="utf-8"))
        for file in sorted(root.glob("*.json"))
        if file.name != "manifest.json"
    ]
    dex_index: dict[str, int] = {}
    for doc in docs:
        if _kind(doc) == "perpDexs":
            dex_index.update(parse_dex_indexes(doc["response"]))
    meta: list[PerpMeta] = []
    ctxs: list[PerpCtx] = []
    mids: dict[str, float] = {}
    books: list[Book] = []
    candles: list[Candle] = []
    funding: list[FundingPrint] = []
    for doc in docs:
        kind = _kind(doc)
        dex = str(doc["request"].get("dex") or "")
        index = dex_index[dex] if dex else None
        response = doc["response"]
        if kind == "perpDexs":
            continue
        if kind == "meta":
            meta.extend(parse_meta(response, dex=dex, dex_index=index))
        elif kind == "metaAndAssetCtxs":
            ctxs.extend(parse_asset_ctxs(response, dex=dex, dex_index=index))
        elif kind == "allMids":
            mids.update(parse_mids(response))
        elif kind == "l2Book":
            books.append(parse_book(response))
        elif kind == "candleSnapshot":
            candles.extend(parse_candles(response))
        elif kind == "fundingHistory":
            funding.extend(parse_funding(response))
        else:
            raise ValueError("fixture request is not public market data")
    candles.sort(key=lambda row: (row.coin, row.interval, row.open_time_ms))
    funding.sort(key=lambda row: (row.coin, row.time_ms))
    return Tape(
        captured_at=captured_at,
        dex_index=dex_index,
        meta=tuple(meta),
        ctxs=tuple(ctxs),
        mids=mids,
        books=tuple(books),
        candles=tuple(candles),
        funding=tuple(funding),
    )


def _kind(doc: dict[str, Any]) -> str:
    request = doc.get("request")
    if not isinstance(request, dict) or "type" not in request:
        raise ValueError("fixture request is missing")
    return str(request["type"])
