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

# Spec §5.7. A book older than this blocks new entries.
BOOK_STALE_SECONDS: int = 5

# Spec §5.7. A silent mainnet stream longer than this blocks new entries.
STREAM_SILENT_SECONDS: int = 10

# Public mainnet market data. Not a signing endpoint, and not configurable.
INFO_URL: str = "https://api.hyperliquid.xyz/info"
WS_URL: str = "wss://api.hyperliquid.xyz/ws"

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

# Spec §5.2. A stop closer than this many round trips is rejected.
STOP_COST_MULTIPLE: int = 3

# Entry and exit are both taker. This is not the leverage cap.
TAKER_LEGS: int = 2

# Spec §2.4 tier-0 published rates. An account fee query is not used.
TAKER_FEE_CORE: float = 0.00045
MAKER_FEE_CORE: float = 0.00015
TAKER_FEE_HIP3: float = 0.0009
TAKER_FEE_GROWTH: float = 0.00009
MAKER_FEE_GROWTH: float = 0.00003

# Spec §5.6. IOC entries do not cross past this fraction of the touch.
SLIP_CAP_CRYPTO: float = 0.001
SLIP_CAP_INDEX: float = 0.0005
SLIP_CAP_STOCK: float = 0.001
SLIP_CAP_COMMODITY: float = 0.0005

# Spec §5.3 and §5.8.
MAX_ENTRIES_PER_DAY: int = 30
LOSS_STREAK: int = 6
LOSS_PAUSE_HOURS: int = 6
FUNDING_OF_EDGE: float = 0.25
FUNDING_AGAINST_PER_HOUR: float = 0.0001
FUNDING_BLACKOUT_MINUTES: int = 2

# Spec §7.2. At n=0 every strategy is shadow.
RANK_MIN_N: int = 30
RANK_SHRINK_N: int = 30
LCB_Z: float = 1.0
MIN_PRED_EDGE_R: float = 0.05

# 30 days of hourly prints. The funding-fade rule does not fire on less.
FUNDING_LOOKBACK_HOURS: int = 720

# Names the stock session treats as closed all day. Not a full exchange calendar.
US_STOCK_HOLIDAYS: tuple[str, ...] = (
    "2026-11-26",
    "2026-12-25",
    "2027-01-01",
)

# NYSE-style early closes. Flat from 13:00 ET. Commodities are not this list.
US_STOCK_EARLY_CLOSES: tuple[tuple[str, int, int], ...] = (
    ("2026-12-24", 13, 0),
    ("2026-12-31", 13, 0),
)

# Futures-style full closures used for gold, silver, oil, and the index names.
COMMODITY_CLOSED: tuple[str, ...] = (
    "2026-12-25",
    "2027-01-01",
)

STOCK_CLOSE_HOUR: int = 20
STOCK_CLOSE_MINUTE: int = 0
STOCK_REOPEN_HOUR: int = 20
STOCK_REOPEN_MINUTE: int = 5
STOCK_PRECLOSE_MINUTES: int = 30

COMMODITY_CLOSE_HOUR: int = 17
COMMODITY_CLOSE_MINUTE: int = 0
COMMODITY_FLAT_MINUTES: int = 30
COMMODITY_REOPEN_HOUR: int = 18
COMMODITY_REOPEN_MINUTE: int = 0

OIL_ROLL_HOUR: int = 17
OIL_ROLL_MINUTE: int = 30
OIL_ROLL_FIRST: int = 5
OIL_ROLL_LAST: int = 10

# Index perps use the slip cap and the futures clock, not the stock 24/5 clock.
INDEX_ROOTS: tuple[str, ...] = ("XYZ100", "SP500")

# Spec §5.1.4 and §6.4. Leveraged products and crypto proxies.
EXCLUDED_ROOTS: tuple[str, ...] = ("SOXL", "SOXS", "KORU", "MSTR", "COIN")
