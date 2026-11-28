"""Public stream protocol.

The socket is injected. A dropped connection is opened again and the
same subscriptions are sent. This module does not start a thread.
"""

from __future__ import annotations

import json
from collections import deque
from collections.abc import Callable
from datetime import datetime
from typing import Any, Protocol

from pb_engine.market_data.freshness import Freshness, assess, book_time
from pb_engine.market_data.info import check_coin
from pb_engine.market_data.parse import parse_active_ctx, parse_book, parse_candle, parse_trade
from pb_engine.market_data.types import PUBLIC_CHANNELS, Book, Candle, PerpCtx, Trade

_KNOWN = frozenset({*PUBLIC_CHANNELS, "subscriptionResponse", "pong"})


class Disconnect(Exception):
    """The public stream socket closed."""


class SocketTimeout(Exception):
    """No frame arrived before the read wait ended."""


class Transport(Protocol):
    def send(self, text: str) -> None: ...

    def recv(self) -> str: ...


Connect = Callable[[], Transport]


class PublicStream:
    def __init__(
        self,
        connect: Connect,
        coins: tuple[str, ...] = ("BTC", "ETH", "SOL"),
        interval: str = "1m",
    ) -> None:
        if not coins:
            raise ValueError("stream needs at least one coin")
        self._connect = connect
        self.coins = tuple(coins)
        self.interval = interval
        self.transport: Transport | None = None
        self.reconnects = 0
        self.last_received_at: datetime | None = None
        self.books: dict[str, Book] = {}
        self.ctxs: dict[str, PerpCtx] = {}
        self.candles: dict[tuple[str, str], Candle] = {}
        self.trades: deque[Trade] = deque(maxlen=100)

    def open(self) -> None:
        reconnecting = self.transport is not None
        self.transport = self._connect()
        if reconnecting:
            self.reconnects += 1
        for message in subscription_messages(self.coins, self.interval):
            self.transport.send(json.dumps(message, separators=(",", ":")))

    def ping(self) -> None:
        if self.transport is None:
            raise ValueError("stream is not open")
        self.transport.send(json.dumps({"method": "ping"}, separators=(",", ":")))

    def pump(self, now: datetime) -> None:
        if self.transport is None:
            raise ValueError("stream is not open")
        try:
            raw = self.transport.recv()
        except SocketTimeout:
            return
        except Disconnect:
            self.open()
            return
        self.handle(raw, now)

    def handle(self, raw: str, now: datetime) -> None:
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("now must be timezone-aware")
        self.last_received_at = now
        payload = json.loads(raw)
        channel = payload.get("channel")
        if channel not in _KNOWN:
            return
        data = payload.get("data")
        if channel == "l2Book":
            book = parse_book(data)
            self.books[book.coin] = book
        elif channel == "trades" and isinstance(data, list):
            for item in data:
                self.trades.append(parse_trade(item))
        elif channel == "candle" and isinstance(data, dict):
            candle = parse_candle(data)
            self.candles[(candle.coin, candle.interval)] = candle
        elif channel == "activeAssetCtx" and isinstance(data, dict):
            ctx = parse_active_ctx(data)
            self.ctxs[ctx.name] = ctx

    def freshness(self, coin: str, now: datetime, *, require_stream: bool = True) -> Freshness:
        book = self.books.get(coin)
        return assess(
            book_time=None if book is None else book_time(book),
            stream_time=self.last_received_at,
            now=now,
            require_stream=require_stream,
        )


def subscription_messages(
    coins: tuple[str, ...],
    interval: str = "1m",
) -> tuple[dict[str, Any], ...]:
    messages: list[dict[str, Any]] = []
    for coin in coins:
        check_coin(coin)
        for channel in PUBLIC_CHANNELS:
            subscription: dict[str, Any] = {"type": channel, "coin": coin}
            if channel == "candle":
                subscription["interval"] = interval
            messages.append({"method": "subscribe", "subscription": subscription})
    return tuple(messages)
