"""Local SQLite store. No network and no server database."""

from __future__ import annotations

import ast
import json
import re
import sqlite3
import types
from dataclasses import fields
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Union, get_args, get_origin, get_type_hints

import pytest

from pb_engine.models import (
    INSERTABLE,
    AlertOutbox,
    Calibration,
    CloseEvent,
    Control,
    DailyScore,
    DeskHealth,
    Equity,
    Fill,
    Funding,
    GateDecision,
    Heartbeat,
    MarketBlacklist,
    MarketSnapshot,
    OrderRow,
    PositionSnapshot,
    RiskEvent,
    ShadowTrade,
    Signal,
    Strategy,
    TradePlan,
    Window,
)
from pb_engine.store import _READ_TABLE, SQLITE_DDL, Store

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "db" / "hl" / "001_init.sql"
NOW = datetime(2026, 11, 28, 12, 0, tzinfo=UTC)
DAY = date(2026, 11, 28)
_SKIP_TOKENS = {"PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "CONSTRAINT", "OR", "AND"}


def test_default_path_stays_uncreated() -> None:
    assert Store.default_path == Path("var") / "pb-engine.sqlite3"
    assert not Store.default_path.exists()


def test_server_urls_are_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="local sqlite"):
        Store("postgres://example.invalid/hl")
    with pytest.raises(ValueError, match="local sqlite"):
        Store("file:///tmp/book.sqlite3")
    with pytest.raises(ValueError, match="directory"):
        Store(tmp_path)
    assert not (tmp_path / "pb-engine.sqlite3").exists()


def test_database_url_is_not_read(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://example.invalid/hl")
    path = tmp_path / "local.sqlite3"
    with Store(path) as store:
        assert store.path == str(path)
        assert store.schema_version() == 1
        assert store.get_control().id == 1
    assert path.is_file()


def test_tables_and_columns_match_the_migration(tmp_path: Path) -> None:
    postgres = _postgres_columns(MIGRATION.read_text(encoding="utf-8"))
    assert set(postgres) == set(_READ_TABLE.values())
    assert set(_READ_TABLE) == {*INSERTABLE, Control}
    with Store(tmp_path / "book.sqlite3") as store:
        assert store.table_names() == set(postgres)
        assert store.schema_version() == 1
        foreign_keys = store._conn.execute("PRAGMA foreign_keys").fetchone()
        assert foreign_keys is not None
        assert foreign_keys[0] == 1
        for kind, table in _READ_TABLE.items():
            model_columns = {field.name for field in fields(kind)}
            assert set(store.column_names(table)) == model_columns
            assert postgres[table] == model_columns
            types_by_name = store.column_types(table)
            hints = _hints(kind)
            for field in fields(kind):
                inner = _unwrap(hints[field.name])
                origin = get_origin(inner)
                if origin in {dict, list} or inner in {datetime, date, str}:
                    assert types_by_name[field.name] == "TEXT"
                if inner is bool:
                    assert types_by_name[field.name] == "INTEGER"


def test_round_trip(tmp_path: Path) -> None:
    with Store(tmp_path / "book.sqlite3") as store:
        strategy = _save(store,
            Strategy(
                name="orb",
                version="1",
                asset_class="commodity",
                params={"lookback": 4, "nested": {"on": True}},
                params_hash="hash-1",
                status="practice",
                weight=0.5,
                frozen_at=NOW,
            )
        )
        market = _save(store,
            MarketSnapshot(
                as_of=DAY,
                market="GOLD",
                dex="xyz",
                asset_class="commodity",
                eligible=False,
                volume_7d_median=12.5,
                open_interest=3.0,
                impact_spread_bps=1.5,
                taker_fee=0.00045,
                maker_fee=0.00015,
                growth_mode=False,
                max_leverage=50,
                session_type="rth",
                reason="listed",
            )
        )
        signal = _save(store,
            Signal(
                ts=NOW,
                strategy_id=strategy.id or 0,
                market="GOLD",
                side="short",
                entry_px=100.0,
                stop_px=101.0,
                target_px=98.0,
                pred_edge_r=1.2,
                pred_win_prob=0.55,
                pred_fee_bps=2.0,
                pred_slippage_bps=1.0,
                pred_funding_bps=0.25,
                edge_lcb_r=0.4,
                weight=1.0,
                decision="skip",
                features={"spread": 1.5, "tags": ["a", "b"]},
                skip_reason="cost",
                session_state="rth",
                git_sha="abc1234",
            )
        )
        gate = _save(store,
            GateDecision(
                signal_id=signal.id or 0,
                verdict="reject",
                probability=0.2,
                reasons=["too wide"],
                features={"spread": 1.5},
                created_at=NOW,
                strategy_id=strategy.id,
                git_sha="abc1234",
            )
        )
        plan = _save(store,
            TradePlan(
                signal_id=signal.id or 0,
                market="GOLD",
                side="short",
                entry_px=100.0,
                stop_px=101.0,
                target_px=98.0,
                size=0.25,
                created_at=NOW,
                gate_decision_id=gate.id,
                entry_cloid="entry-1",
                stop_cloid="stop-1",
                target_cloid="target-1",
            )
        )
        close = _save(store,
            CloseEvent(
                plan_id=plan.id or 0,
                outcome="closed_as_planned",
                legs=[{"px": 98.0, "qty": 0.25}],
                unverified_gaps=[],
                created_at=NOW,
            )
        )
        blacklist = _save(store,
            MarketBlacklist(
                market="GOLD",
                actor="desk",
                reason="manual",
                created_at=NOW,
                cleared_at=NOW,
            )
        )
        health = _save(store,
            DeskHealth(
                as_of=NOW,
                signal_escapes=0,
                false_closes=1,
                unnecessary_interruptions=2,
                created_at=NOW,
                routing_accuracy=0.9,
                recovery={"restarted": False},
            )
        )
        shadow = _save(store,
            ShadowTrade(
                signal_id=signal.id or 0,
                source="shadow",
                book="ungated",
                entry_px=100.0,
                exit_px=98.0,
                fees=0.1,
                slippage=0.2,
                funding=0.0,
                realised_r=1.5,
                mae=0.4,
                mfe=1.6,
                hold_seconds=90,
                exit_reason="target",
            )
        )
        order = _save(store,
            OrderRow(
                market="GOLD",
                side="short",
                created_at=NOW,
                plan_id=plan.id,
                cloid="entry-1",
                oid=1001,
                order_type="limit",
                limit_px=100.0,
                size=0.25,
                status="recorded",
                raw={"note": "not sent"},
            )
        )
        fill = _save(store,
            Fill(
                source="shadow",
                px=100.0,
                size=0.25,
                ts=NOW,
                order_id=order.id,
                fee=0.01,
                closed_pnl=0.0,
                raw={"book": "gated"},
            )
        )
        position = _save(store,
            PositionSnapshot(
                ts=NOW,
                market="GOLD",
                size=-0.25,
                has_stop=True,
                entry_px=100.0,
                leverage=1.0,
                liq_px=180.0,
                upnl=-1.5,
            )
        )
        equity = _save(store, Equity(ts=NOW, shadow_equity=1000.0, testnet_equity=1000.0))
        funding = _save(store,
            Funding(ts=NOW, market="GOLD", rate=0.0001, payment=-0.02, position_size=-0.25)
        )
        risk = _save(store,
            RiskEvent(
                ts=NOW,
                kind="daily_stop",
                severity="WARN",
                detail="latched",
                payload={"day": "2026-11-28"},
            )
        )
        heartbeat = _save(store,
            Heartbeat(ts=NOW, version="0.1.0", network="sim-mainnet-data", ws_ages={"l2": 1})
        )
        calibration = _save(store,
            Calibration(
                week_start=DAY,
                kind="strategy",
                strategy_id=strategy.id,
                slope=1.0,
                intercept=0.0,
                brier=0.2,
                cost_model_error=0.1,
                drift_stat=0.0,
                action="keep",
            )
        )
        engine_calibration = _save(store,
            Calibration(week_start=DAY, kind="engine", action="observe")
        )
        window = _save(store,
            Window(
                started_at=NOW,
                manifest_hash="manifest-1",
                strategies=["orb"],
                ended_at=NOW,
                verdict="EXTEND",
            )
        )
        score = _save(store,
            DailyScore(
                day=DAY,
                kind="strategy",
                n_trades=3,
                strategy_id=strategy.id,
                mean_r=0.4,
                pnl=12.0,
            )
        )
        total = _save(store, DailyScore(day=DAY, kind="total", n_trades=3, mean_r=0.4, pnl=12.0))
        alert = _save(store,
            AlertOutbox(
                severity="INFO",
                dedup_key="daily-stop",
                body="latched",
                created_at=NOW,
                sent_at=None,
                acked_at=None,
            )
        )
        saved = (
            strategy,
            market,
            signal,
            gate,
            plan,
            close,
            blacklist,
            health,
            shadow,
            order,
            fill,
            position,
            equity,
            funding,
            risk,
            heartbeat,
            calibration,
            engine_calibration,
            window,
            score,
            total,
            alert,
        )
        for row in saved:
            assert row.id is not None
            loaded = store.get(type(row), row.id)
            assert loaded == row
        assert market.max_leverage == 50
        assert market.eligible is False
        assert type(market.eligible) is bool
        assert type(market.growth_mode) is bool
        assert type(position.has_stop) is bool
        assert json.loads(json.dumps(signal.features, sort_keys=True)) == signal.features
        assert engine_calibration.strategy_id is None
        assert total.strategy_id is None
        assert alert.sent_at is None


def test_control_is_a_single_row(tmp_path: Path) -> None:
    path = tmp_path / "book.sqlite3"
    with Store(path) as store:
        first = store.get_control()
        assert first.id == 1
        assert first.halt is False
        assert first.flatten_requested is False
        assert first.drain is False
        assert first.pause_new_entries is False
        assert type(first.halt) is bool
        assert first.updated_at.tzinfo is not None
        untouched = store.update_control()
        assert untouched == first
        changed = store.update_control(halt=True, pause_new_entries=True)
        assert changed.halt is True
        assert changed.pause_new_entries is True
        assert changed.flatten_requested is False
        assert changed.drain is False
        assert changed.updated_at >= first.updated_at
        with pytest.raises(TypeError, match="update_control"):
            _save(store,
                Control(
                    halt=True,
                    flatten_requested=False,
                    drain=False,
                    pause_new_entries=False,
                    updated_at=NOW,
                )
            )
        with pytest.raises(sqlite3.IntegrityError):
            store._conn.execute(
                """
                INSERT INTO hl_control (
                    id, halt, flatten_requested, drain, pause_new_entries, updated_at
                ) VALUES (2, 0, 0, 0, 0, ?)
                """,
                (NOW.isoformat(),),
            )
    with Store(path) as reopened:
        again = reopened.get_control()
        assert again == changed
        count = reopened._conn.execute("SELECT COUNT(*) FROM hl_control").fetchone()
        assert count is not None
        assert count[0] == 1


def test_bad_rows_are_rejected(tmp_path: Path) -> None:
    with Store(tmp_path / "book.sqlite3") as store:
        with pytest.raises(ValueError, match="timezone-aware"):
            _save(store,
                Strategy(
                    name="orb",
                    version="1",
                    asset_class="crypto",
                    params={},
                    params_hash="hash-1",
                    status="practice",
                    weight=1.0,
                    frozen_at=datetime(2026, 11, 28),
                )
            )
        with pytest.raises(sqlite3.IntegrityError):
            _save(store,
                Strategy(
                    name="orb",
                    version="1",
                    asset_class="fx",
                    params={},
                    params_hash="hash-1",
                    status="practice",
                    weight=1.0,
                )
            )
        strategy = _save(store,
            Strategy(
                name="orb",
                version="1",
                asset_class="crypto",
                params={},
                params_hash="hash-1",
                status="practice",
                weight=1.0,
            )
        )
        with pytest.raises(sqlite3.IntegrityError):
            _save(store,
                Strategy(
                    name="wide",
                    version="2",
                    asset_class="crypto",
                    params={},
                    params_hash="hash-2",
                    status="practice",
                    weight=1.5,
                )
            )
        with pytest.raises(sqlite3.IntegrityError):
            _save(store, _signal(strategy_id=999))
        signal = _save(store, _signal(strategy_id=strategy.id or 0))
        with pytest.raises(sqlite3.IntegrityError):
            _save(store,
                GateDecision(
                    signal_id=signal.id or 0,
                    verdict="maybe",
                    probability=0.5,
                    reasons=[],
                    features={},
                    created_at=NOW,
                )
            )
        with pytest.raises(sqlite3.IntegrityError):
            _save(store,
                Calibration(week_start=DAY, kind="engine", strategy_id=strategy.id)
            )
        _save(store, Calibration(week_start=DAY, kind="engine"))
        with pytest.raises(sqlite3.IntegrityError):
            _save(store, Calibration(week_start=DAY, kind="engine"))
        with pytest.raises(sqlite3.IntegrityError):
            _save(store,
                DailyScore(day=DAY, kind="total", n_trades=1, strategy_id=strategy.id)
            )


def test_memory_store_is_separate() -> None:
    with Store(":memory:") as store:
        assert store.path == ":memory:"
        assert store.get_control().halt is False
        assert "CREATE SCHEMA" not in SQLITE_DDL


def test_only_the_store_imports_sqlite() -> None:
    src = ROOT / "src"
    found = False
    for path in src.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                names = [node.module.split(".")[0]]
            else:
                continue
            if "sqlite3" in names:
                assert path.name == "store.py"
                found = True
    assert found


def _signal(*, strategy_id: int) -> Signal:
    return Signal(
        ts=NOW,
        strategy_id=strategy_id,
        market="BTC",
        side="long",
        entry_px=1.0,
        stop_px=0.99,
        target_px=1.02,
        pred_edge_r=1.0,
        pred_win_prob=0.5,
        pred_fee_bps=1.0,
        pred_slippage_bps=1.0,
        pred_funding_bps=0.0,
        edge_lcb_r=0.2,
        weight=1.0,
        decision="hold",
        features={},
    )


def _postgres_columns(sql: str) -> dict[str, set[str]]:
    pattern = re.compile(
        r"CREATE TABLE IF NOT EXISTS hl\.(hl_[a-z0-9_]+) \((.*?)\n\);",
        re.DOTALL,
    )
    found: dict[str, set[str]] = {}
    for match in pattern.finditer(sql):
        columns: set[str] = set()
        for line in match.group(2).splitlines():
            stripped = line.strip().rstrip(",")
            if not stripped or stripped.startswith("--") or stripped.startswith("("):
                continue
            token = stripped.split()[0]
            if token.upper() in _SKIP_TOKENS:
                continue
            if re.fullmatch(r"[a-z_][a-z0-9_]*", token):
                columns.add(token)
        found[match.group(1)] = columns
    return found


def _hints(kind: type[Any]) -> dict[str, Any]:
    return get_type_hints(kind)


def _same(saved: Any, original: Any) -> None:
    assert type(saved) is type(original)
    for field in fields(original):
        got = getattr(saved, field.name)
        want = getattr(original, field.name)
        if field.name == "id" and want is None:
            assert isinstance(got, int)
            continue
        if isinstance(want, float):
            assert got == pytest.approx(want)
            continue
        assert got == want
        if isinstance(want, bool):
            assert type(got) is bool


def _save(store: Store, row: Any) -> Any:
    saved = store.add(row)
    _same(saved, row)
    return saved


def _unwrap(hint: Any) -> Any:
    origin = get_origin(hint)
    if origin is Union or origin is types.UnionType:
        args = [arg for arg in get_args(hint) if arg is not type(None)]
        if len(args) == 1:
            return args[0]
    return hint
