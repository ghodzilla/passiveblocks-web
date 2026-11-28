"""Read-only public info client.

The poster is injected in tests. The default poster is the one REST
function in this package. Nothing here takes an account.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from typing import Any

from pb_engine.config import INFO_URL
from pb_engine.market_data.http import post_json
from pb_engine.market_data.parse import (
    parse_asset_ctxs,
    parse_book,
    parse_candles,
    parse_dex_indexes,
    parse_funding,
    parse_meta,
    parse_mids,
)
from pb_engine.market_data.types import (
    CANDLE_INTERVALS,
    Book,
    Candle,
    FundingPrint,
    PerpCtx,
    PerpMeta,
)

PUBLIC_INFO_TYPES = frozenset(
    {
        "meta",
        "metaAndAssetCtxs",
        "allMids",
        "l2Book",
        "candleSnapshot",
        "fundingHistory",
        "perpDexs",
    }
)

Poster = Callable[[str, Mapping[str, Any]], Any]
_DEX = re.compile(r"[a-z][a-z0-9]{0,15}")
_COIN = re.compile(r"[A-Za-z0-9][A-Za-z0-9:_-]{0,31}")


class InfoClient:
    def __init__(self, post: Poster | None = None, url: str = INFO_URL) -> None:
        if url != INFO_URL:
            raise ValueError("public info url only")
        self._post = post_json if post is None else post
        self._url = url
        self._dexes: dict[str, int] | None = None

    def meta(self, dex: str = "") -> tuple[PerpMeta, ...]:
        payload = self.query(self._typed("meta", dex))
        return parse_meta(payload, dex=dex, dex_index=self._dex_index(dex))

    def asset_ctxs(self, dex: str = "") -> tuple[PerpCtx, ...]:
        payload = self.query(self._typed("metaAndAssetCtxs", dex))
        return parse_asset_ctxs(payload, dex=dex, dex_index=self._dex_index(dex))

    def mids(self, dex: str = "") -> dict[str, float]:
        return parse_mids(self.query(self._typed("allMids", dex)))

    def book(self, coin: str) -> Book:
        return parse_book(self.query({"type": "l2Book", "coin": check_coin(coin)}))

    def candles(
        self,
        coin: str,
        interval: str,
        start_ms: int,
        end_ms: int | None = None,
    ) -> tuple[Candle, ...]:
        if interval not in CANDLE_INTERVALS:
            raise ValueError("candle interval is not supported")
        req: dict[str, Any] = {
            "coin": check_coin(coin),
            "interval": interval,
            "startTime": int(start_ms),
        }
        if end_ms is not None:
            req["endTime"] = int(end_ms)
        payload = self.query({"type": "candleSnapshot", "req": req})
        return parse_candles(payload)

    def funding(
        self,
        coin: str,
        start_ms: int,
        end_ms: int | None = None,
    ) -> tuple[FundingPrint, ...]:
        body: dict[str, Any] = {
            "type": "fundingHistory",
            "coin": check_coin(coin),
            "startTime": int(start_ms),
        }
        if end_ms is not None:
            body["endTime"] = int(end_ms)
        return parse_funding(self.query(body))

    def dex_indexes(self) -> dict[str, int]:
        if self._dexes is not None:
            return self._dexes
        payload = self.query({"type": "perpDexs"})
        if not isinstance(payload, list):
            raise ValueError("dex list is missing")
        self._dexes = parse_dex_indexes(payload)
        return self._dexes

    def query(self, body: Mapping[str, Any]) -> Any:
        kind = body.get("type")
        if kind not in PUBLIC_INFO_TYPES:
            raise ValueError("info type is not public market data")
        if "user" in body or "address" in body:
            raise ValueError("no account query")
        nested = body.get("req")
        if isinstance(nested, Mapping) and ("user" in nested or "address" in nested):
            raise ValueError("no account query")
        return self._post(self._url, body)

    def _typed(self, kind: str, dex: str) -> dict[str, Any]:
        body: dict[str, Any] = {"type": kind}
        checked = _dex(dex)
        if checked:
            body["dex"] = checked
        return body

    def _dex_index(self, dex: str) -> int | None:
        checked = _dex(dex)
        if not checked:
            return None
        indexes = self.dex_indexes()
        try:
            return indexes[checked]
        except KeyError as exc:
            raise ValueError("dex is not in the public dex list") from exc


def check_coin(coin: str) -> str:
    if _COIN.fullmatch(coin) is None:
        raise ValueError("coin name is not a public market")
    return coin


def _dex(dex: str) -> str:
    if dex == "":
        return ""
    if _DEX.fullmatch(dex) is None:
        raise ValueError("dex name is not a public market dex")
    return dex
