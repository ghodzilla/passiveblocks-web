"""Live paper mode stays on public data and on the local database."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from pb_engine.cli import main
from pb_engine.database_url import database_url, redact
from pb_engine.market_data.info import InfoClient
from pb_engine.market_data.replay import Tape
from pb_engine.market_data.types import PerpCtx, PerpMeta
from pb_engine.market_data.ws import SocketTimeout
from pb_engine.models import Strategy
from pb_engine.neon_sync import MirrorError, mirror
from pb_engine.store import Store
from pb_engine.universe import filter_markets

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"
NOW = datetime(2026, 11, 28, 8, 28, 44, tzinfo=UTC)
INFO_URL = "https://api.hyperliquid.xyz/info"


def test_universe_keeps_core_coins_and_rejects_a_thin_name() -> None:
    btc = _meta("BTC", "")
    doge = _meta("DOGE", "")
    gold = _meta("xyz:GOLD", "xyz", growth=False)
    tape = Tape(
        captured_at=NOW,
        dex_index={"": 0, "xyz": 1},
        meta=(btc, doge, gold),
        ctxs=(
            PerpCtx(
                "xyz:GOLD",
                2000.0,
                2000.0,
                2000.0,
                0.0,
                100.0,
                1_000_000.0,
                0.0,
                1999.0,
                2001.0,
            ),
        ),
        mids={"BTC": 100.0},
        books=(),
        candles=(),
        funding=(),
    )
    rows = {row.market: row for row in filter_markets(tape, date(2026, 11, 28))}
    assert rows["BTC"].eligible is True
    assert rows["BTC"].asset_class == "crypto"
    assert rows["DOGE"].eligible is False
    assert "BTC, ETH and SOL" in str(rows["DOGE"].reason)
    assert rows["xyz:GOLD"].eligible is False
    assert "20M" in str(rows["xyz:GOLD"].reason)


def test_live_cycle_is_offline_and_can_repeat(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.delenv("HL_DATABASE_URL", raising=False)
    db = tmp_path / "paper.sqlite3"
    monkeypatch.setattr("pb_engine.live.InfoClient", _client)
    monkeypatch.setattr("pb_engine.live.connect_mainnet", _down)
    assert main(["run-once", "--live-data", "--db", str(db)]) == 0
    out = capsys.readouterr().out
    assert "NOT VALIDATED" in out
    assert "stage=simulation" in out
    assert "orders=none" in out
    assert "keys=none" in out
    assert "nothing was sent" in out
    assert "live-data=public-mainnet" in out
    with Store(db) as store:
        first_signals = store.read("SELECT COUNT(*) AS n FROM hl_signal")[0]["n"]
        names = store.read("SELECT COUNT(*) AS n FROM hl_strategy")[0]["n"]
        stale = store.read(
            "SELECT COUNT(*) AS n FROM hl_risk_event WHERE kind = 'stale_data'"
        )[0]["n"]
        btc = store.read(
            "SELECT eligible FROM hl_market WHERE market = 'BTC' ORDER BY id DESC LIMIT 1"
        )
        assert int(stale) >= 1
        assert btc and int(btc[0]["eligible"]) == 1
    assert main(["run-once", "--live-data", "--db", str(db)]) == 0
    capsys.readouterr()
    with Store(db) as store:
        again = store.read("SELECT COUNT(*) AS n FROM hl_signal")[0]["n"]
        strategies = store.read("SELECT COUNT(*) AS n FROM hl_strategy")[0]["n"]
    assert again == first_signals
    assert strategies == names


def test_a_live_frame_does_not_open_an_order_path(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.delenv("HL_DATABASE_URL", raising=False)
    from pb_engine.live import run_live_cycle

    db = tmp_path / "frame.sqlite3"
    run_live_cycle(str(db), now=NOW, client=_client(), connect=_socket)
    with Store(db) as store:
        orders = store.read("SELECT COUNT(*) AS n FROM hl_order")[0]["n"]
        heartbeats = store.read("SELECT COUNT(*) AS n FROM hl_heartbeat")[0]["n"]
    assert orders == 0
    assert heartbeats == 1


def test_database_url_is_optional_and_redacted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HL_DATABASE_URL", raising=False)
    assert database_url() is None
    monkeypatch.setenv("HL_DATABASE_URL", "   ")
    assert database_url() is None
    monkeypatch.setenv("HL_DATABASE_URL", "postgres://role@example.invalid/regime")
    assert database_url() == "postgres://role@example.invalid/regime"
    shown = redact("down postgres://role:secret@example.invalid/regime now")
    assert "secret" not in shown
    assert "example.invalid" not in shown
    assert "redacted" in shown
    monkeypatch.setenv("HL_DATABASE_URL", "https://example.invalid")
    with pytest.raises(ValueError):
        database_url()


def test_mirror_copies_without_printing_the_url(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.delenv("HL_DATABASE_URL", raising=False)
    db = tmp_path / "mirror.sqlite3"
    store = Store(db)
    store.add(
        Strategy(
            name="tsmom_4h",
            version="1",
            asset_class="crypto",
            params={"hold_hours": 72},
            params_hash="abc",
            status="shadow",
            weight=1.0,
        )
    )
    sink = _Sink()
    url = "postgresql://role:secret@example.invalid/regime"
    assert mirror(store, url, connect=lambda _url: sink) == 2
    joined = " ".join(sql for sql, _params in sink.calls)
    assert "hl.hl_strategy" in joined
    assert "hl.hl_control" in joined
    assert "secret" not in joined
    assert "example.invalid" not in joined
    with pytest.raises(MirrorError) as raised:
        mirror(store, url, connect=_explode)
    assert "secret" not in str(raised.value)
    assert "example.invalid" not in str(raised.value)


def _meta(name: str, dex: str, *, growth: bool = False) -> PerpMeta:
    return PerpMeta(
        name=name,
        dex=dex,
        index=0,
        asset_id=0,
        sz_decimals=4,
        venue_max_leverage=40,
        growth_mode=growth,
        deployer_fee_scale=None,
    )


def _client() -> InfoClient:
    docs = []
    for file in sorted(FIXTURES.glob("*.json")):
        if file.name == "manifest.json":
            continue
        docs.append(json.loads(file.read_text(encoding="utf-8")))

    def post(url: str, body: dict[str, object]) -> object:
        if url != INFO_URL:
            raise AssertionError(url)
        kind = body.get("type")
        for doc in docs:
            req = doc["request"]
            if req.get("type") != kind:
                continue
            if kind == "l2Book" and req.get("coin") != body.get("coin"):
                continue
            if kind == "fundingHistory" and req.get("coin") != body.get("coin"):
                continue
            if kind in {"meta", "metaAndAssetCtxs", "allMids", "perpDexs"}:
                if (req.get("dex") or "") != (body.get("dex") or ""):
                    continue
            if kind == "candleSnapshot":
                want = body.get("req") if isinstance(body.get("req"), dict) else {}
                got = req.get("req") if isinstance(req.get("req"), dict) else {}
                same_coin = got.get("coin") == want.get("coin")
                same_interval = got.get("interval") == want.get("interval")
                if not same_coin or not same_interval:
                    continue
            return doc["response"]
        raise AssertionError(f"no fixture for {kind}")

    return InfoClient(post=post)


def _down() -> None:
    raise ConnectionError("stream down")


class _Frame:
    def __init__(self) -> None:
        self._sent = False

    def send(self, text: str) -> None:
        del text

    def recv(self) -> str:
        if self._sent:
            raise SocketTimeout()
        self._sent = True
        payload = json.loads((FIXTURES / "l2_BTC.json").read_text(encoding="utf-8"))
        return json.dumps({"channel": "l2Book", "data": payload["response"]})


def _socket() -> _Frame:
    return _Frame()


class _Sink:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []
        self._next = 1

    def execute(self, sql: str, params: object = None) -> _Sink:
        self.calls.append((sql, params))
        self._row = (self._next,) if "RETURNING" in sql else None
        if "RETURNING" in sql:
            self._next += 1
        return self

    def fetchone(self) -> tuple[int] | None:
        return self._row

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None

    def close(self) -> None:
        return None


def _explode(url: str) -> None:
    raise ConnectionError(url)
