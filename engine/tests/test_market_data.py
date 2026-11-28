"""Offline public market data. No network in this module except the marked test."""

from __future__ import annotations

import inspect
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from pb_engine import config
from pb_engine.market_data.freshness import assess
from pb_engine.market_data.http import post_json
from pb_engine.market_data.info import PUBLIC_INFO_TYPES, InfoClient
from pb_engine.market_data.parse import parse_trade
from pb_engine.market_data.replay import load_tape
from pb_engine.market_data.types import PUBLIC_CHANNELS, asset_id
from pb_engine.market_data.ws import Disconnect, PublicStream, SocketTimeout, subscription_messages

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"
NOW = datetime(2026, 11, 28, 8, 28, 44, tzinfo=UTC)


def test_fixtures_have_no_account_address() -> None:
    blob = "".join(path.read_text(encoding="utf-8") for path in FIXTURES.glob("*.json"))
    assert re.search(r"0x[0-9a-fA-F]{6,}", blob) is None
    assert "private_key" not in blob


def test_replay_tape_is_offline(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("network")

    monkeypatch.setattr("pb_engine.market_data.http.post_json", boom)
    tape = load_tape(FIXTURES)
    assert tape.captured_at == NOW
    assert tape.dex_index["xyz"] == 1
    assert {book.coin for book in tape.books} >= {
        "BTC",
        "ETH",
        "SOL",
        "xyz:GOLD",
        "xyz:NVDA",
        "xyz:CL",
    }
    btc_intervals = {row.interval for row in tape.candles if row.coin == "BTC"}
    assert btc_intervals == {"15m", "1h", "4h"}
    assert any(row.coin == "xyz:GOLD" and row.interval == "1h" for row in tape.candles)
    assert any(row.coin == "xyz:GOLD" for row in tape.funding)
    assert tape.mids["BTC"] > 0
    assert tape.mids["xyz:GOLD"] > 0
    btc = next(row for row in tape.ctxs if row.name == "BTC")
    assert btc.open_interest is not None
    assert btc.open_interest > 0
    gold = next(row for row in tape.meta if row.name == "xyz:GOLD")
    assert gold.asset_id == asset_id(gold.index, tape.dex_index["xyz"])
    assert gold.venue_max_leverage != config.MAX_LEVERAGE
    assert config.MAX_LEVERAGE == 2
    assert any(row.growth_mode for row in tape.meta if row.dex == "xyz")


def test_info_client_reads_a_recorded_book() -> None:
    doc = _doc("l2_BTC.json")
    book = InfoClient(post=_poster(doc)).book("BTC")
    assert book.coin == "BTC"
    assert book.bids[0].px >= book.bids[-1].px
    assert book.asks[0].px <= book.asks[-1].px
    assert book.bids[0].px < book.asks[0].px


def test_info_client_reads_recorded_candles_and_funding() -> None:
    candles = _doc("candles_BTC_15m.json")
    req = candles["request"]["req"]
    rows = InfoClient(post=_poster(candles)).candles(req["coin"], req["interval"], req["startTime"])
    assert len(rows) == len(candles["response"])
    assert rows[0].high >= rows[0].low
    funding = _doc("funding_xyz_GOLD.json")
    prints = InfoClient(post=_poster(funding)).funding(
        funding["request"]["coin"],
        funding["request"]["startTime"],
    )
    assert prints[0].coin == "xyz:GOLD"
    assert prints[0].time_ms <= prints[-1].time_ms


def test_xyz_meta_uses_the_dex_list() -> None:
    meta = _doc("meta_xyz.json")
    dexs = _doc("perp_dexs.json")
    sent: list[dict[str, object]] = []

    def post(url: str, body: dict[str, object]) -> object:
        assert url == config.INFO_URL
        sent.append(dict(body))
        if body["type"] == "perpDexs":
            return dexs["response"]
        assert body == meta["request"]
        return meta["response"]

    assets = InfoClient(post=post).meta(dex="xyz")
    assert sent[0]["type"] == "meta"
    assert sent[1]["type"] == "perpDexs"
    gold = next(row for row in assets if row.name == "xyz:GOLD")
    raw = next(item for item in meta["response"]["universe"] if item["name"] == "xyz:GOLD")
    assert gold.venue_max_leverage == raw["maxLeverage"]
    xyz_index = next(i for i, item in enumerate(dexs["response"]) if item and item["name"] == "xyz")
    assert gold.asset_id == asset_id(gold.index, xyz_index)
    assert "xyz" not in inspect.getsource(asset_id)


def test_open_interest_and_mids() -> None:
    ctx = _doc("ctx_core.json")
    rows = InfoClient(post=_poster(ctx)).asset_ctxs()
    btc = next(row for row in rows if row.name == "BTC")
    assert btc.open_interest is not None
    assert btc.open_interest > 0
    assert btc.impact_bid is not None
    assert btc.impact_ask is not None
    mids = _doc("mids_xyz.json")
    parsed = InfoClient(post=_poster(mids)).mids(dex="xyz")
    assert parsed["xyz:NVDA"] > 0


def test_client_refuses_anything_except_public_info() -> None:
    def post(_url: str, _body: object) -> object:
        raise AssertionError("posted")

    client = InfoClient(post=post)
    with pytest.raises(ValueError, match="public market data"):
        client.query({"type": "not-a-public-type"})
    with pytest.raises(ValueError, match="account"):
        client.query({"type": "meta", "user": "redacted"})
    with pytest.raises(ValueError, match="account"):
        client.query({"type": "candleSnapshot", "req": {"user": "redacted"}})
    with pytest.raises(ValueError, match="public info url only"):
        InfoClient(url="https://example.invalid/info")
    with pytest.raises(ValueError, match="public info url only"):
        post_json("https://example.invalid/info", {"type": "allMids"})
    assert "perpDexs" in PUBLIC_INFO_TYPES
    assert "l2Book" in PUBLIC_INFO_TYPES


def test_trade_print_drops_account_fields() -> None:
    trade = parse_trade(
        {
            "coin": "BTC",
            "side": "B",
            "px": "10",
            "sz": "1",
            "time": 5,
            "hash": "redacted",
            "users": ["redacted", "redacted"],
        }
    )
    assert trade.side == "buy"
    assert not hasattr(trade, "users")
    sold = parse_trade({"coin": "ETH", "side": "A", "px": "2", "sz": "3", "time": 6})
    assert sold.side == "sell"


def test_stale_book_and_silent_stream(monkeypatch: pytest.MonkeyPatch) -> None:
    assert config.BOOK_STALE_SECONDS == 5
    assert config.STREAM_SILENT_SECONDS == 10
    fresh = assess(book_time=NOW, stream_time=NOW, now=NOW, require_stream=True)
    assert fresh.blocks_new_entries is False
    at_book_limit = NOW + timedelta(seconds=config.BOOK_STALE_SECONDS)
    held = assess(book_time=NOW, stream_time=at_book_limit, now=at_book_limit, require_stream=True)
    assert held.book_stale is False
    just_over = at_book_limit + timedelta(milliseconds=1)
    stale_book = assess(book_time=NOW, stream_time=just_over, now=just_over, require_stream=True)
    assert stale_book.book_stale is True
    assert stale_book.blocks_new_entries is True
    at_stream_limit = NOW + timedelta(seconds=config.STREAM_SILENT_SECONDS)
    assert assess(
        book_time=at_stream_limit,
        stream_time=NOW,
        now=at_stream_limit,
        require_stream=True,
    ).stream_silent is False
    silent = assess(
        book_time=at_stream_limit + timedelta(milliseconds=1),
        stream_time=NOW,
        now=at_stream_limit + timedelta(milliseconds=1),
        require_stream=True,
    )
    assert silent.stream_silent is True
    assert silent.blocks_new_entries is True
    replay = assess(book_time=NOW, stream_time=None, now=NOW, require_stream=False)
    assert replay.stream_silent is False
    missing = assess(book_time=None, stream_time=NOW, now=NOW, require_stream=False)
    assert missing.book_stale is True
    with pytest.raises(ValueError, match="timezone-aware"):
        assess(book_time=NOW, stream_time=NOW, now=datetime(2026, 11, 28), require_stream=False)
    monkeypatch.setattr(config, "BOOK_STALE_SECONDS", 30)
    wider = assess(
        book_time=NOW,
        stream_time=NOW,
        now=NOW + timedelta(seconds=6),
        require_stream=False,
    )
    assert wider.book_stale is False


def test_stream_reconnects_and_resubscribes() -> None:
    raw = json.dumps(
        {
            "channel": "l2Book",
            "data": {
                "coin": "BTC",
                "time": int(NOW.timestamp() * 1000),
                "levels": [
                    [{"px": "10", "sz": "1", "n": 2}],
                    [{"px": "11", "sz": "1", "n": 1}],
                ],
            },
        }
    )
    first = _Script([None])
    second = _Script([raw])
    pool = [first, second]
    stream = PublicStream(connect=lambda: pool.pop(0), coins=("BTC", "xyz:GOLD"))
    stream.open()
    assert stream.reconnects == 0
    stream.pump(NOW)
    assert stream.reconnects == 1
    assert stream.books == {}
    stream.pump(NOW)
    assert stream.books["BTC"].bids[0].px == 10
    assert len(first.sent) == len(PUBLIC_CHANNELS) * 2
    assert first.sent == second.sent
    coins = {json.loads(line)["subscription"]["coin"] for line in first.sent}
    assert coins == {"BTC", "xyz:GOLD"}
    kinds = {json.loads(line)["subscription"]["type"] for line in first.sent}
    assert kinds == set(PUBLIC_CHANNELS)
    fresh = stream.freshness("BTC", NOW)
    assert fresh.blocks_new_entries is False
    assert stream.freshness("BTC", NOW + timedelta(seconds=6)).book_stale is True


def test_stream_parses_prints_without_keeping_accounts() -> None:
    stream = PublicStream(connect=lambda: _Script([]), coins=("BTC",))
    stream.open()
    stream.handle(
        json.dumps(
            {
                "channel": "trades",
                "data": [
                    {
                        "coin": "BTC",
                        "side": "A",
                        "px": "11",
                        "sz": "0.5",
                        "time": 5,
                        "users": ["redacted"],
                    }
                ],
            }
        ),
        NOW,
    )
    assert stream.trades[-1].side == "sell"
    assert not hasattr(stream.trades[-1], "users")
    stream.handle(
        json.dumps(
            {
                "channel": "activeAssetCtx",
                "data": {"coin": "xyz:GOLD", "ctx": {"openInterest": "4.5", "midPx": "10"}},
            }
        ),
        NOW,
    )
    assert stream.ctxs["xyz:GOLD"].open_interest == 4.5
    stream.handle(json.dumps({"channel": "not-used", "data": {}}), NOW)
    assert "not-used" not in stream.books


def test_subscriptions_are_the_public_channels_only() -> None:
    messages = subscription_messages(("SOL",))
    assert len(messages) == len(PUBLIC_CHANNELS)
    assert {row["subscription"]["type"] for row in messages} == set(PUBLIC_CHANNELS)
    candle = next(row for row in messages if row["subscription"]["type"] == "candle")
    assert candle["subscription"]["interval"] == "1m"


def test_timeout_does_not_reconnect() -> None:
    socket = _Script([])

    def timed_out() -> str:
        raise SocketTimeout()

    socket.recv = timed_out  # type: ignore[method-assign]
    stream = PublicStream(connect=lambda: socket, coins=("BTC",))
    stream.open()
    stream.pump(NOW)
    assert stream.reconnects == 0


@pytest.mark.network
def test_live_public_mids_include_btc() -> None:
    mids = InfoClient().mids()
    assert mids["BTC"] > 0


class _Script:
    def __init__(self, inbox: list[str | None]) -> None:
        self.inbox = list(inbox)
        self.sent: list[str] = []

    def send(self, text: str) -> None:
        self.sent.append(text)

    def recv(self) -> str:
        if not self.inbox:
            raise Disconnect()
        item = self.inbox.pop(0)
        if item is None:
            raise Disconnect()
        return item


def _doc(name: str) -> dict[str, object]:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _poster(doc: dict[str, object]):
    def post(url: str, body: dict[str, object]) -> object:
        assert url == config.INFO_URL
        assert dict(body) == doc["request"]
        return doc["response"]

    return post
