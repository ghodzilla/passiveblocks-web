"""Command line for the Stage 1 simulation.

``status`` prints the hard limits. ``run-once --replay`` walks one
recorded cycle and does not send an order. ``health``, ``report`` and
``alert-test`` only read or queue a local row. Nothing here reads a secret.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from pb_engine import __version__, config


def status_lines() -> list[str]:
    return [
        "NOT VALIDATED",
        "stage=simulation",
        "orders=none",
        "keys=none",
        f"max_leverage={config.MAX_LEVERAGE}",
        f"risk_per_trade={config.RISK_PER_TRADE:.3f}",
        f"max_positions={config.MAX_POSITIONS}",
        f"max_position_notional={config.MAX_POSITION_NOTIONAL_MULTIPLE:.1f}",
        f"min_order_usd={config.MIN_ORDER_USD}",
        f"cluster_risk_cap={config.CLUSTER_RISK_CAP:.3f}",
        f"total_risk_cap={config.TOTAL_RISK_CAP:.2f}",
        f"max_net_directional={config.MAX_NET_DIRECTIONAL:.1f}",
        f"daily_loss_stop={config.DAILY_LOSS_STOP:.2f}",
        f"drawdown_kill={config.DRAWDOWN_KILL:.2f}",
        f"autonomy_cap={config.AUTONOMY_CAP}",
        f"sim_starting_equity_usdc={config.SIM_STARTING_EQUITY_USDC}",
        f"hl_network={config.HL_NETWORK}",
    ]


def _print_status() -> int:
    sys.stdout.write("\n".join(status_lines()) + "\n")
    return 0


def _run_once(args: argparse.Namespace) -> int:
    if args.live_data:
        print(
            "run-once --live-data is not in this build. "
            "Pass --replay with a fixture directory. "
            "This package does not send orders.",
            file=sys.stderr,
        )
        return 2
    if not args.replay:
        print(
            "run-once needs --replay. "
            "This package does not send orders.",
            file=sys.stderr,
        )
        return 2
    from pb_engine.cycle import run_once_replay

    try:
        result = run_once_replay(Path(args.replay), args.db, seed=args.seed)
    except FileNotFoundError:
        print(
            "run-once could not read --replay. "
            "This package does not send orders.",
            file=sys.stderr,
        )
        return 2
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "stage=simulation",
                "orders=none",
                "keys=none",
                f"signals={result.signals}",
                f"shadow_fills={result.shadow_fills}",
                f"taken={result.taken}",
                f"closed={result.closed}",
                f"shadow_equity={result.equity:.2f}",
                f"ungated_mean_r={_mean_r(result.ungated_mean_r)}",
                f"gated_mean_r={_mean_r(result.gated_mean_r)}",
            ]
        )
        + "\n"
    )
    return 0


def _mean_r(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.4f}"


def _store(path: str | None):
    from pb_engine.store import Store

    return Store(path)


def _health(args: argparse.Namespace) -> int:
    from pb_engine.desk_api import get_desk_health
    from pb_engine.health import record_health

    store = _store(args.db)
    record_health(store, as_of=datetime.now(UTC))
    view = get_desk_health(store)
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "stage=simulation",
                "orders=none",
                "keys=none",
                "nothing was sent",
                f"signal_escapes={view['signal_escapes']}",
                f"false_closes={view['false_closes']}",
                f"stale_blocks={view['stale_blocks']}",
                f"routing_accuracy={float(view['routing_accuracy']):.4f}",
                f"equity_usdc={float(view['equity_usdc']):.2f}",
                f"drawdown={float(view['drawdown']):.4f}",
            ]
        )
        + "\n"
    )
    return 0


def _report(args: argparse.Namespace) -> int:
    from pb_engine.desk_api import snapshot

    view = snapshot(_store(args.db))
    if args.write_snapshot:
        Path(args.write_snapshot).write_text(
            json.dumps(view, indent=2, sort_keys=True, allow_nan=False) + "\n",
            encoding="utf-8",
        )
    pnl = view["pnl"]
    assert isinstance(pnl, dict)
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "stage=simulation",
                "orders=none",
                "keys=none",
                "nothing was sent",
                str(view["headline"]),
                f"ungated_mean_r={_mean_r(pnl.get('ungated_mean_r'))}",
                f"gated_mean_r={_mean_r(pnl.get('gated_mean_r'))}",
            ]
        )
        + "\n"
    )
    return 0


def _sim_state(args: argparse.Namespace) -> int:
    store = _store(args.db)
    rows = store.read("select count(*) as n from hl_equity")
    count = int(rows[0]["n"]) if rows else 0
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "stage=simulation",
                "orders=none",
                "keys=none",
                f"equity_rows={count}",
            ]
        )
        + "\n"
    )
    return 0


def _prune(args: argparse.Namespace) -> int:
    removed = _store(args.db).prune()
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "stage=simulation",
                "orders=none",
                "keys=none",
                "nothing was sent",
                f"db_bytes={removed['db_bytes']}",
                f"trimmed_health={removed['hl_desk_health']}",
                f"trimmed_events={removed['hl_risk_event']}",
                f"trimmed_alerts={removed['hl_alert_outbox']}",
            ]
        )
        + "\n"
    )
    return 0


def _alert_fail(args: argparse.Namespace) -> int:
    from pb_engine.alerts import alert_failure

    try:
        message = alert_failure(_store(args.db), args.unit)
    except ValueError as exc:
        print(f"alert-fail refused: {exc}. This package does not send orders.", file=sys.stderr)
        return 2
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "orders=none",
                "keys=none",
                message,
            ]
        )
        + "\n"
    )
    return 0


def _alert_test(args: argparse.Namespace) -> int:
    from pb_engine.alerts import alert_test

    message = alert_test(_store(args.db))
    sys.stdout.write(
        "\n".join(
            [
                "NOT VALIDATED",
                "orders=none",
                "keys=none",
                message,
            ]
        )
        + "\n"
    )
    return 0


def _autonomy(args: argparse.Namespace) -> int:
    from pb_engine.autonomy import AutonomyRefused, describe, promote

    store = _store(args.db)
    if args.autonomy_command == "show":
        state = describe(store)
        sys.stdout.write(
            "\n".join(
                [
                    "NOT VALIDATED",
                    "orders=none",
                    "keys=none",
                    f"exercised_level={state.exercised}",
                    f"autonomy_cap={state.cap}",
                    f"name={state.name}",
                ]
            )
            + "\n"
        )
        return 0
    try:
        state = promote(
            store,
            args.level,
            confirmed=bool(args.confirm),
            actor=args.actor or "",
            reason=args.reason or "",
        )
    except AutonomyRefused as exc:
        print(
            f"autonomy promote refused: {exc}. This package does not send orders.",
            file=sys.stderr,
        )
        return 2
    sys.stdout.write(
        f"exercised_level={state.exercised}\n"
        f"autonomy_cap={state.cap}\n"
        "orders=none\n"
        "nothing was sent\n"
    )
    return 0


def _control(args: argparse.Namespace) -> int:
    from pb_engine.autonomy import AutonomyRefused
    from pb_engine.controls import pause_entries

    try:
        message = pause_entries(
            _store(args.db),
            actor=args.actor or "",
            reason=args.reason or "",
        )
    except AutonomyRefused as exc:
        print(
            f"control refused: {exc}. This package does not send orders.",
            file=sys.stderr,
        )
        return 2
    sys.stdout.write(message + "\norders=none\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pb-engine",
        description=(
            "Hyperliquid perps engine. NOT VALIDATED. "
            "Stage 1 scaffold: simulation limits only, no keys and no orders."
        ),
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"pb-engine {__version__} (simulation scaffold, no orders)",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    status = commands.add_parser("status", help="Print the hard risk limits.")
    status.set_defaults(func=lambda _args: _print_status())

    run_once = commands.add_parser("run-once", help="Simulate one cycle from a recorded book.")
    run_once.add_argument("--replay", default=None, help="Fixture directory.")
    run_once.add_argument("--live-data", action="store_true", help="Not in this build.")
    run_once.add_argument("--db", default=None, help="SQLite file. Default is the local var file.")
    run_once.add_argument("--seed", type=int, default=1)
    run_once.set_defaults(func=_run_once)

    health = commands.add_parser("health", help="Write a local desk-health row and print it.")
    health.add_argument("--db", default=None)
    health.set_defaults(func=_health)

    report = commands.add_parser("report", help="Print the read-only desk snapshot.")
    report.add_argument("--db", default=None)
    report.add_argument("--write-snapshot", default=None)
    report.set_defaults(func=_report)

    alert = commands.add_parser("alert-test", help="Queue a local test alert. Nothing is sent.")
    alert.add_argument("--db", default=None)
    alert.set_defaults(func=_alert_test)

    failed = commands.add_parser(
        "alert-fail",
        help="Queue a local unit-failure note. Nothing is sent.",
    )
    failed.add_argument("--db", default=None)
    failed.add_argument("--unit", required=True)
    failed.set_defaults(func=_alert_fail)

    state = commands.add_parser("sim-state", help="Say whether a replay is already stored.")
    state.add_argument("--db", default=None)
    state.set_defaults(func=_sim_state)

    prune = commands.add_parser("prune", help="Trim local log rows and vacuum the SQLite file.")
    prune.add_argument("--db", default=None)
    prune.set_defaults(func=_prune)

    autonomy = commands.add_parser("autonomy", help="Show or manually set the exercised level.")
    autonomy.add_argument("--db", default=None)
    autonomy_commands = autonomy.add_subparsers(dest="autonomy_command", required=True)
    show = autonomy_commands.add_parser("show")
    show.set_defaults(func=_autonomy)
    promote = autonomy_commands.add_parser("promote")
    promote.add_argument("--level", type=int, required=True)
    promote.add_argument("--confirm", action="store_true")
    promote.add_argument("--actor", default="")
    promote.add_argument("--reason", default="")
    promote.set_defaults(func=_autonomy)

    control = commands.add_parser("control", help="Human control. Refused below L2.")
    control.add_argument("--db", default=None)
    control_commands = control.add_subparsers(dest="control_command", required=True)
    pause = control_commands.add_parser("pause-entries")
    pause.add_argument("--actor", default="")
    pause.add_argument("--reason", default="")
    pause.set_defaults(func=_control)

    args = parser.parse_args(argv)
    return int(args.func(args))
