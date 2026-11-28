"""Command line for the Stage 1 simulation.

``status`` prints the hard limits. ``run-once --replay`` walks one
recorded cycle and does not send an order. The other commands are
not in this build. Nothing here reads a secret.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pb_engine import __version__, config

_UNBUILT = ("health", "report", "alert-test")


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


def _not_built(name: str) -> int:
    print(
        f"{name} is not in this build. "
        "This package is a simulation scaffold: it does not read the "
        "exchange and it does not send orders.",
        file=sys.stderr,
    )
    return 2


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

    for name in _UNBUILT:
        command = commands.add_parser(name, help="Not in this build.")
        command.set_defaults(func=lambda _args, command_name=name: _not_built(command_name))

    args = parser.parse_args(argv)
    return int(args.func(args))
