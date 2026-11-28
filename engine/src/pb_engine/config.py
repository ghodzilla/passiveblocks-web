"""Hard risk limits for the Hyperliquid perps engine.

Every value in this module is a literal. Nothing reads the process
environment or a settings file. There is no function anywhere in this
package that is allowed to assign to these names.

Stage 1 is simulation only. ``HL_NETWORK`` is a label, not a switch
that turns on signing.
"""

from __future__ import annotations

# Spec §5.1. Account-wide cap. Exactly 2. Not configurable.
MAX_LEVERAGE: int = 2

# Spec §5.2. Fraction of equity at risk if the stop is hit. Never above this.
RISK_PER_TRADE: float = 0.005

# Spec §5.2. Per-position notional ceiling, as a multiple of equity.
MAX_POSITION_NOTIONAL_MULTIPLE: float = 1.0

# Spec §2.4 floor is $10. $11 keeps rounding from slipping under it.
MIN_ORDER_USD: int = 11

# Spec §5.3.
MAX_POSITIONS: int = 3
MAX_POSITIONS_PER_MARKET: int = 1
CLUSTER_RISK_CAP: float = 0.015
TOTAL_RISK_CAP: float = 0.02
ENERGY_MAX_POSITIONS: int = 1
MAX_NET_DIRECTIONAL: float = 1.5

# Spec §5.4. Loss from the first equity of the UTC day. Clears next UTC day.
DAILY_LOSS_STOP: float = 0.02

# Spec §5.5. Loss from the peak. Stays on until a person restarts it.
DRAWDOWN_KILL: float = 0.10

# Spec §9.4. Stage 1 simulation cap. This package does not trade.
AUTONOMY_CAP: int = 3

# Paper equity for the simulation. Not real money.
SIM_STARTING_EQUITY_USDC: int = 1000

# Informational label. Must not be used to select a signing endpoint.
HL_NETWORK: str = "sim-mainnet-data"

# Spec §5.3 clusters. Stage 1's loop is BTC, ETH, and SOL only.
# The other names are pinned so they cannot be filed under crypto.
CLUSTERS: tuple[str, ...] = ("crypto", "us_equity", "metals", "energy")

MARKET_CLUSTER: dict[str, str] = {
    "BTC": "crypto",
    "ETH": "crypto",
    "SOL": "crypto",
    "GOLD": "metals",
    "SILVER": "metals",
    "CL": "energy",
    "WTI": "energy",
    "BRENTOIL": "energy",
}
