"""Read-only desk view. Spec §9.3.

The functions here only read. They do not change a row, a limit, or an
order. A future desk bot may call them. It cannot go further.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from pb_engine import __version__, config
from pb_engine.autonomy import describe
from pb_engine.ranker import rank_history
from pb_engine.session import cluster_name, session_block
from pb_engine.store import Store

_FEE = 0.00045
_SYDNEY = ZoneInfo("Australia/Sydney")


def get_status(store: Store) -> dict[str, object]:
    heartbeats = store.read(
        "select ts, version, network, ws_ages from hl_heartbeat order by id desc limit 1"
    )
    control = store.read(
        "select halt, drain, pause_new_entries, flatten_requested, updated_at "
        "from hl_control where id = 1"
    )
    flags = control[0] if control else {}
    beat = heartbeats[0] if heartbeats else {}
    ages = _json_obj(beat.get("ws_ages"))
    raw_age = ages.get("btc_book_s")
    book_age = _age_seconds(raw_age)
    fresh = book_age is not None and book_age <= config.BOOK_STALE_SECONDS
    return {
        "mode": "SIMULATION",
        "validated": False,
        "version": beat.get("version") or __version__,
        "network": beat.get("network") or config.HL_NETWORK,
        "heartbeat_at": beat.get("ts"),
        "book_age_s": book_age,
        "fresh": fresh,
        "halt": bool(flags.get("halt")),
        "drain": bool(flags.get("drain")),
        "pause_new_entries": bool(flags.get("pause_new_entries")),
        "flatten_requested": bool(flags.get("flatten_requested")),
        "window_day": 0,
        "window_days": 28,
        "orders": "none",
        "keys": "none",
    }


def get_positions(store: Store) -> list[dict[str, object]]:
    return [_position(row) for row in _joined(store) if row.get("exit_px") in {None, ""}]


def get_pnl(store: Store) -> dict[str, object]:
    equity = _equity(store)
    start = float(config.SIM_STARTING_EQUITY_USDC)
    change = equity - start
    return {
        "start_usdc": start,
        "shadow_equity_usdc": equity,
        "shadow_pnl_usdc": change,
        "shadow_pnl_pct": change / start if start else 0.0,
        "gated_mean_r": _mean_r(store, "gated"),
        "ungated_mean_r": _mean_r(store, "ungated"),
        "note": "Closed shadow round trips only. An open take is not in this P&L.",
    }


def get_balance(store: Store) -> dict[str, object]:
    """Paper equity only. No account address and no margin from an exchange."""

    pnl = get_pnl(store)
    return {
        "equity_usdc": pnl["shadow_equity_usdc"],
        "currency": "USDC",
        "source": "simulation",
    }


def get_whitelist(store: Store) -> dict[str, object]:
    blocked = store.read(
        "select market, reason, created_at from hl_market_blacklist "
        "where cleared_at is null order by id"
    )
    return {
        "eligible": ["BTC", "ETH", "SOL"],
        "blocked": blocked,
        "stocks_and_commodities": _session_note(_clock(store)),
    }


def get_gate_decisions(store: Store) -> list[dict[str, object]]:
    rows = store.read(
        """
        select g.verdict, g.probability, g.reasons, g.created_at,
               s.market, s.side, s.decision, s.skip_reason, st.name as strategy
        from hl_gate_decision g
        join hl_signal s on s.id = g.signal_id
        join hl_strategy st on st.id = s.strategy_id
        order by g.id
        """
    )
    return [
        {
            "strategy": row["strategy"],
            "market": row["market"],
            "side": row["side"],
            "decision": row["decision"],
            "skip_reason": row["skip_reason"],
            "verdict": row["verdict"],
            "confidence": row["probability"],
            "reasons": _json_list(row.get("reasons")),
            "at": row["created_at"],
        }
        for row in rows
    ]


def get_open_plans(store: Store) -> list[dict[str, object]]:
    return [plan for plan in _plans(store) if plan["outcome"] != "closed_as_planned"]


def get_close_events(store: Store) -> list[dict[str, object]]:
    return _plans(store)


def get_desk_health(store: Store) -> dict[str, object]:
    signals = store.read("select count(*) as n from hl_signal")
    gates = store.read("select count(*) as n from hl_gate_decision")
    signal_n = int(signals[0]["n"]) if signals else 0
    gate_n = int(gates[0]["n"]) if gates else 0
    routing = (gate_n / signal_n) if signal_n else 1.0
    escapes = store.read(
        "select count(*) as n from hl_risk_event where kind = ?",
        ("signal_escape",),
    )
    stale = store.read(
        "select count(*) as n from hl_risk_event where kind = ?",
        ("stale_data",),
    )
    mix = _counts(
        store,
        "select verdict as key, count(*) as n from hl_gate_decision group by verdict",
    )
    closes = _counts(
        store,
        "select outcome as key, count(*) as n from hl_close_event group by outcome",
    )
    false_closes = _false_closes(store)
    equity = _equity(store)
    start = float(config.SIM_STARTING_EQUITY_USDC)
    drawdown = max(0.0, (start - equity) / start) if start else 0.0
    risk = _open_risk(store, equity)
    return {
        "routing_accuracy": routing,
        "signal_escapes": int(escapes[0]["n"]) if escapes else 0,
        "false_closes": false_closes,
        "unnecessary_interruptions": 0,
        "stale_blocks": int(stale[0]["n"]) if stale else 0,
        "gate_mix": mix,
        "close_mix": closes,
        "open_risk": risk,
        "equity_usdc": equity,
        "drawdown": drawdown,
        "limits": {
            "max_leverage": config.MAX_LEVERAGE,
            "daily_loss_stop": config.DAILY_LOSS_STOP,
            "drawdown_kill": config.DRAWDOWN_KILL,
            "max_positions": config.MAX_POSITIONS,
            "cluster_risk_cap": config.CLUSTER_RISK_CAP,
            "total_risk_cap": config.TOTAL_RISK_CAP,
        },
    }


def get_autonomy_cap(store: Store) -> dict[str, object]:
    state = describe(store)
    return {
        "exercised": state.exercised,
        "cap": state.cap,
        "name": state.name,
        "promotion": "manual confirm flag only",
    }


def snapshot(store: Store) -> dict[str, object]:
    """One plain record the private page can render without a database."""

    status = get_status(store)
    pnl = get_pnl(store)
    health = get_desk_health(store)
    strategies = _league(store)
    captured = status.get("heartbeat_at")
    points, baseline = _curves(store, float(pnl["shadow_equity_usdc"]), captured)
    shadow_names = [row["name"] for row in strategies]
    pnl_pct = float(pnl["shadow_pnl_pct"])
    headline = (
        f"Day {status['window_day']} of {status['window_days']} · SIMULATION · NOT VALIDATED · "
        f"{len(shadow_names)} strategies shadow · shadow P&L {pnl_pct * 100:+.1f}%"
    )
    return {
        "headline": headline,
        "source": "Recorded simulation from the public mainnet snapshot. Not a live book.",
        "as_of": captured,
        "as_of_sydney": _sydney(captured),
        "status": status,
        "pnl": pnl,
        "balance": get_balance(store),
        "whitelist": get_whitelist(store),
        "health": health,
        "autonomy": get_autonomy_cap(store),
        "equity_curve": points,
        "baseline_curve": baseline,
        "strategies": strategies,
        "positions": get_positions(store),
        "signals": _signal_log(store),
        "skip_pnl": _skip_pnl(store),
        "plans": get_close_events(store),
        "events": _events(store),
        "scorecard": _scorecard(health, pnl),
        "notices": [
            "No server is attached. Reboot and disk notices appear "
            "when the engine runs on its own machine.",
        ],
    }


def _joined(store: Store) -> list[dict[str, object]]:
    return store.read(
        """
        select s.id as signal_id, s.ts, s.market, s.side, s.decision, s.skip_reason,
               s.entry_px as plan_entry, s.stop_px, s.target_px, s.pred_edge_r,
               st.name as strategy, st.status as strategy_status, st.asset_class, st.weight,
               g.verdict, g.probability, g.reasons,
               t.book, t.entry_px, t.exit_px, t.fees, t.funding, t.realised_r,
               t.exit_reason, t.hold_seconds
        from hl_signal s
        join hl_strategy st on st.id = s.strategy_id
        left join hl_gate_decision g on g.signal_id = s.id
        left join hl_shadow_trade t on t.signal_id = s.id
        order by s.id, t.book
        """
    )


def _position(row: dict[str, object]) -> dict[str, object]:
    entry = _num(row.get("entry_px"))
    fees = _num(row.get("fees"))
    notional = (fees / _FEE) if fees and _FEE else 0.0
    return {
        "strategy": row.get("strategy"),
        "market": row.get("market"),
        "side": row.get("side"),
        "book": row.get("book"),
        "entry": entry,
        "stop": _num(row.get("stop_px")),
        "target": _num(row.get("target_px")),
        "notional_usdc": round(notional, 2),
        "funding_usdc": _num(row.get("funding")),
        "counts_toward_limits": row.get("book") == "gated",
        "stop_in_plan": _num(row.get("stop_px")) > 0,
        "stop_note": "The stop is in the simulation. It is not an order on an exchange.",
        "opened": row.get("ts"),
    }


def _plans(store: Store) -> list[dict[str, object]]:
    rows = store.read(
        """
        select p.id, p.market, p.side, p.entry_px, p.stop_px, p.target_px, p.size,
               c.outcome, c.legs, c.unverified_gaps, g.verdict, st.name as strategy
        from hl_trade_plan p
        left join hl_close_event c on c.plan_id = p.id
        left join hl_gate_decision g on g.id = p.gate_decision_id
        left join hl_signal s on s.id = p.signal_id
        left join hl_strategy st on st.id = s.strategy_id
        order by p.id
        """
    )
    found = []
    for row in rows:
        legs = _json_list(row.get("legs"))
        found.append(
            {
                "id": row["id"],
                "strategy": row.get("strategy"),
                "market": row["market"],
                "side": row["side"],
                "entry": row["entry_px"],
                "stop": row["stop_px"],
                "target": row["target_px"],
                "size": row["size"],
                "verdict": row.get("verdict"),
                "outcome": row.get("outcome"),
                "legs": legs,
                "gaps": _json_list(row.get("unverified_gaps")),
            }
        )
    return found


def _league(store: Store) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, object]]] = {}
    meta: dict[str, dict[str, object]] = {}
    for row in _joined(store):
        name = str(row.get("strategy") or "")
        meta[name] = row
        if row.get("exit_px") not in {None, ""} and row.get("realised_r") is not None:
            grouped.setdefault(name, []).append(row)
    table = []
    for name, sample in meta.items():
        closed = grouped.get(name, [])
        values = [
            float(item["realised_r"])
            for item in closed
            if item.get("realised_r") is not None
        ]
        n = len(values)
        mean = sum(values) / n if n else 0.0
        std = 0.0
        if n > 1:
            var = sum((item - mean) ** 2 for item in values) / (n - 1)
            std = math.sqrt(var)
        ranked = rank_history(mean_r=mean, n=n, std_r=std, weight=1.0)
        wins = sum(1 for item in values if item > 0)
        pnl = sum(_usd(item) for item in closed)
        table.append(
            {
                "name": name,
                "asset_class": sample.get("asset_class"),
                "status": sample.get("strategy_status"),
                "weight": sample.get("weight"),
                "n": n,
                "mean_r": mean,
                "shrunk_edge": ranked.edge,
                "lcb": ranked.lcb,
                "calibration_slope": None,
                "win_rate": (wins / n) if n else None,
                "pnl_usdc": pnl,
            }
        )
    return sorted(table, key=lambda item: str(item["name"]))


def _curves(
    store: Store,
    official: float,
    captured: object,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    start = float(config.SIM_STARTING_EQUITY_USDC)
    rows = [
        row
        for row in _joined(store)
        if row.get("exit_px") not in {None, ""} and row.get("book") == "ungated"
    ]
    rows.sort(key=lambda row: str(row.get("ts") or ""))
    if not rows:
        beat = store.read("select ts from hl_equity order by id desc limit 1")
        stamp = beat[0]["ts"] if beat else None
        flat = [{"t": stamp, "equity": start}, {"t": stamp, "equity": _equity(store)}]
        return flat, [{"t": stamp, "equity": start}, {"t": stamp, "equity": start}]
    equity = start
    base = start
    stamp = rows[0].get("ts")
    points: list[dict[str, object]] = [{"t": stamp, "equity": start}]
    baseline: list[dict[str, object]] = [{"t": stamp, "equity": start}]
    for row in rows:
        equity += _usd(row)
        points.append({"t": row.get("ts"), "equity": round(equity, 2)})
        if row.get("strategy") in {"btc_hold_1x", "random_entry"}:
            base += _usd(row)
        baseline.append({"t": row.get("ts"), "equity": round(base, 2)})
    points.append({"t": captured, "equity": round(official, 2)})
    baseline.append({"t": captured, "equity": round(base, 2)})
    return points, baseline


def _signal_log(store: Store) -> list[dict[str, object]]:
    seen: set[object] = set()
    log = []
    for row in _joined(store):
        key = row.get("signal_id")
        if key in seen:
            continue
        seen.add(key)
        log.append(
            {
                "strategy": row.get("strategy"),
                "market": row.get("market"),
                "side": row.get("side"),
                "decision": row.get("decision"),
                "skip_reason": row.get("skip_reason"),
                "verdict": row.get("verdict"),
                "confidence": row.get("probability"),
                "at": row.get("ts"),
            }
        )
    return log


def _skip_pnl(store: Store) -> list[dict[str, object]]:
    buckets: dict[str, list[float]] = {}
    for row in _joined(store):
        if row.get("decision") == "trade":
            continue
        if row.get("realised_r") is None or row.get("book") != "ungated":
            continue
        reason = str(row.get("skip_reason") or "unlabelled")
        buckets.setdefault(reason, []).append(float(row["realised_r"]))
    return [
        {"reason": reason, "n": len(values), "mean_r": sum(values) / len(values)}
        for reason, values in sorted(buckets.items())
    ]


def _events(store: Store) -> list[dict[str, object]]:
    rows = store.read(
        "select ts, kind, severity, detail from hl_risk_event order by id desc limit 12"
    )
    alerts = store.read(
        "select severity, dedup_key, body, created_at, sent_at "
        "from hl_alert_outbox order by id desc limit 12"
    )
    return [
        {"kind": "risk", "at": row["ts"], "severity": row["severity"], "text": row["detail"]}
        for row in rows
    ] + [
        {
            "kind": "outbox",
            "at": row["created_at"],
            "severity": row["severity"],
            "text": row["body"],
            "sent": row["sent_at"] is not None,
        }
        for row in alerts
    ]


def _scorecard(health: dict[str, object], pnl: dict[str, object]) -> dict[str, object]:
    escapes = int(health["signal_escapes"])
    false_closes = int(health["false_closes"])
    items = [
        {
            "name": "Signal escapes",
            "pass": escapes == 0,
            "detail": f"{escapes} setups reached a take without an accept.",
        },
        {
            "name": "False closes",
            "pass": false_closes == 0,
            "detail": f"{false_closes} closes claimed done without matching fills.",
        },
        {
            "name": "Desk reads only",
            "pass": True,
            "detail": "The desk view has no order or write tools.",
        },
        {
            "name": "Alerts delivered",
            "pass": False,
            "detail": "Nothing is sent. The outbox stays on this machine.",
        },
        {
            "name": "Uptime and stops on an exchange",
            "pass": False,
            "detail": "There is no server and no exchange stop yet.",
        },
        {
            "name": "Edge sample",
            "pass": False,
            "detail": "A go-live call needs a full window of taken trades. This is day 0.",
        },
        {
            "name": "Gate versus ungated",
            "pass": False,
            "detail": (
                "Gated trades from this replay are still open, "
                "so the comparison is not ready."
            ),
        },
    ]
    return {
        "verdict": "NO-GO",
        "plain": "Not ready for real money. This recording is a simulation on day 0 of 28.",
        "shadow_pnl_pct": pnl["shadow_pnl_pct"],
        "items": items,
    }


def _session_note(now: datetime | None) -> dict[str, object]:
    reopen = _next_stock_open(now) if now is not None else None
    commodity = None
    if now is not None:
        commodity = _next_session_open(
            now,
            hour=config.COMMODITY_REOPEN_HOUR,
            minute=config.COMMODITY_REOPEN_MINUTE,
            market="xyz:GOLD",
        )
    stocks = "US stock perps are flat on this capture."
    if reopen is not None:
        stocks = "US stock perps are closed. Next open is " + _when(reopen) + "."
    commodities = "Gold, silver and oil are not in this replay."
    if commodity is not None:
        commodities += " Their session would reopen " + _when(commodity) + "."
    return {
        "eligible_note": "This replay only simulates BTC, ETH and SOL.",
        "stocks": stocks,
        "commodities": commodities,
        "earnings": "No earnings dates are loaded.",
        "oil_roll": "No oil position is open, so the roll window is not in play.",
        "macro": "No CPI, FOMC or EIA blackout is loaded.",
        "next_stock_open": None if reopen is None else reopen.isoformat(),
    }


def _when(moment: datetime) -> str:
    new_york = moment.astimezone(ZoneInfo("America/New_York"))
    sydney = moment.astimezone(_SYDNEY)
    return (
        f"{new_york.strftime('%A %-I:%M %p')} New York, "
        f"{sydney.strftime('%A %-I:%M %p')} Sydney"
    )


def _next_stock_open(now: datetime) -> datetime | None:
    return _next_session_open(
        now,
        hour=config.STOCK_REOPEN_HOUR,
        minute=config.STOCK_REOPEN_MINUTE,
        market="xyz:NVDA",
    )


def _next_session_open(now: datetime, *, hour: int, minute: int, market: str) -> datetime | None:
    local = now.astimezone(ZoneInfo("America/New_York"))
    for days in range(8):
        day = (local + timedelta(days=days)).date()
        candidate = datetime(
            day.year,
            day.month,
            day.day,
            hour,
            minute,
            tzinfo=ZoneInfo("America/New_York"),
        )
        if candidate <= now:
            continue
        if session_block(market, candidate) is None:
            return candidate
    return None


def _clock(store: Store) -> datetime | None:
    rows = store.read("select ts from hl_heartbeat order by id desc limit 1")
    if not rows or not isinstance(rows[0].get("ts"), str):
        return None
    try:
        parsed = datetime.fromisoformat(str(rows[0]["ts"]))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _open_risk(store: Store, equity: float) -> dict[str, object]:
    positions = [row for row in get_positions(store) if row.get("book") == "gated"]
    gross = sum(float(row["notional_usdc"]) for row in positions)
    leverage = gross / equity if equity else 0.0
    by_cluster = {name: 0.0 for name in config.CLUSTERS}
    for row in positions:
        market = str(row.get("market") or "")
        name = cluster_name(market) or "crypto"
        entry = float(row["entry"] or 0)
        stop = float(row["stop"] or 0)
        notional = float(row["notional_usdc"])
        distance = abs(entry - stop) / entry if entry else 0.0
        by_cluster[name] = by_cluster.get(name, 0.0) + distance * notional
    if equity:
        by_cluster = {name: risk / equity for name, risk in by_cluster.items()}
    total = sum(by_cluster.values())
    return {
        "positions": len(positions),
        "gross_leverage": leverage,
        "cluster_risk": by_cluster,
        "total_risk": total,
        "daily_pnl_pct": (_equity(store) - float(config.SIM_STARTING_EQUITY_USDC))
        / float(config.SIM_STARTING_EQUITY_USDC),
    }


def _false_closes(store: Store) -> int:
    rows = store.read(
        "select outcome, legs from hl_close_event where outcome = ?",
        ("closed_as_planned",),
    )
    bad = 0
    for row in rows:
        legs = _json_list(row.get("legs"))
        fills = [leg for leg in legs if isinstance(leg, dict) and leg.get("fill") == "present"]
        roles = {str(leg.get("role")) for leg in fills if isinstance(leg, dict)}
        if "entry" not in roles or not ({"stop", "target"} & roles):
            bad += 1
    return bad


def _counts(store: Store, sql: str) -> dict[str, int]:
    found = {}
    for row in store.read(sql):
        key = row.get("key")
        if key is None:
            continue
        found[str(key)] = int(row["n"])
    return found


def _mean_r(store: Store, book: str) -> float | None:
    rows = store.read(
        "select realised_r from hl_shadow_trade where book = ? and realised_r is not null",
        (book,),
    )
    values = [float(row["realised_r"]) for row in rows]
    if not values:
        return None
    return sum(values) / len(values)


def _equity(store: Store) -> float:
    rows = store.read("select shadow_equity from hl_equity order by id desc limit 1")
    if not rows or rows[0]["shadow_equity"] is None:
        return float(config.SIM_STARTING_EQUITY_USDC)
    return float(rows[0]["shadow_equity"])


def _usd(row: dict[str, object]) -> float:
    """USDC result implied by the stored R, the stop, and the fee."""

    entry = _num(row.get("entry_px")) or _num(row.get("plan_entry"))
    stop = _num(row.get("stop_px"))
    realised = row.get("realised_r")
    fees = _num(row.get("fees"))
    if entry <= 0 or stop <= 0 or realised is None or fees <= 0:
        return 0.0
    distance = abs(entry - stop) / entry
    if distance <= 0:
        return 0.0
    legs = 2 if row.get("exit_px") not in {None, ""} else 1
    notional = fees / (_FEE * legs)
    return float(realised) * distance * notional


def _age_seconds(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value):
        return None
    return round(max(0.0, float(value)), 3)


def _num(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0.0
    if not math.isfinite(value):
        return 0.0
    return float(value)


def _json_list(value: object) -> list[object]:
    if isinstance(value, list):
        return value
    if not isinstance(value, str) or not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def _json_obj(value: object) -> dict[str, object]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str) or not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _sydney(stamp: object) -> str | None:
    if not isinstance(stamp, str) or not stamp:
        return None
    try:
        parsed = datetime.fromisoformat(stamp)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(_SYDNEY).strftime("%A %-d %b %Y, %-I:%M %p Sydney")
