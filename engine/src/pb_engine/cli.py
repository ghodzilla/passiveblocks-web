"""Command line for the Stage 1 scaffold.

``status`` prints the hard limits. Every other command exits with an
error. Nothing in this module reads the network or a secret.
"""

from __future__ import annotations

import argparse
import sys

from pb_engine import __version__, config

_UNBUILT = ("run-once", "health", "report", "alert-test")


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

    for name in _UNBUILT:
        command = commands.add_parser(name, help="Not in this build.")
        command.set_defaults(func=lambda _args, command_name=name: _not_built(command_name))

    args = parser.parse_args(argv)
    return int(args.func(args))
