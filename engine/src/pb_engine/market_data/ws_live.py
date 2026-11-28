"""Live public stream socket. Tests use a fake socket instead."""

from __future__ import annotations

from typing import Any

from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect

from pb_engine.config import WS_URL
from pb_engine.market_data.ws import Disconnect, SocketTimeout


class LiveSocket:
    def __init__(self, connection: Any) -> None:
        self._connection = connection

    def send(self, text: str) -> None:
        self._connection.send(text)

    def recv(self) -> str:
        try:
            message = self._connection.recv(timeout=10)
        except TimeoutError as exc:
            raise SocketTimeout() from exc
        except ConnectionClosed as exc:
            raise Disconnect() from exc
        if isinstance(message, bytes):
            return message.decode()
        return str(message)

    def close(self) -> None:
        self._connection.close()


def connect_mainnet(timeout: float = 10.0) -> LiveSocket:
    connection = connect(WS_URL, open_timeout=timeout)
    return LiveSocket(connection)
