"""Daily universe snapshot. Spec §6.4, using the public tape we already have.

BTC, ETH and SOL on the core dex are eligible. Other names are recorded
with the reason they failed. A passing stock or commodity still is not
proposed by the Stage 1 strategies. Those stay on the three crypto names.
One day of notional stands in until a seven-day median is stored.
"""

from __future__ import annotations

from datetime import date

from pb_engine import config
from pb_engine.market_data.replay import Tape
from pb_engine.market_data.types import PerpCtx, PerpMeta
from pb_engine.models import MarketSnapshot
from pb_engine.session import session_kind
from pb_engine.store import Store

MIN_DAY_NOTIONAL = 20_000_000.0
MIN_OPEN_INTEREST = 20_000_000.0
MAX_SPREAD_BPS = 3.0
MAX_STOCKS = 8
MAX_COMMODITIES = 4
_CORE = frozenset({"BTC", "ETH", "SOL"})


def record_universe(store: Store, tape: Tape, day: date) -> int:
    existing = store.read(
        "SELECT market FROM hl_market WHERE as_of = ?",
        (day.isoformat(),),
    )
    have = {str(row["market"]) for row in existing}
    written = 0
    for row in filter_markets(tape, day):
        if row.market in have:
            continue
        store.add(row)
        written += 1
    return written


def filter_markets(tape: Tape, day: date) -> list[MarketSnapshot]:
    ctxs = {row.name: row for row in tape.ctxs}
    drafts = [_one(meta, ctxs.get(meta.name), day) for meta in tape.meta]
    stocks = [row for row in drafts if row.eligible and row.asset_class == "stock"]
    commodities = [row for row in drafts if row.eligible and row.asset_class == "commodity"]
    stocks.sort(key=lambda row: -(row.volume_7d_median or 0.0))
    commodities.sort(key=lambda row: -(row.volume_7d_median or 0.0))
    capped = {row.market for row in stocks[MAX_STOCKS:]}
    capped.update(row.market for row in commodities[MAX_COMMODITIES:])
    if not capped:
        return drafts
    kept: list[MarketSnapshot] = []
    for row in drafts:
        if row.market not in capped:
            kept.append(row)
            continue
        kept.append(
            MarketSnapshot(
                as_of=row.as_of,
                market=row.market,
                dex=row.dex,
                asset_class=row.asset_class,
                eligible=False,
                volume_7d_median=row.volume_7d_median,
                open_interest=row.open_interest,
                impact_spread_bps=row.impact_spread_bps,
                taker_fee=row.taker_fee,
                maker_fee=row.maker_fee,
                growth_mode=row.growth_mode,
                max_leverage=row.max_leverage,
                session_type=row.session_type,
                reason="over the daily name cap",
            )
        )
    return kept


def _one(meta: PerpMeta, ctx: PerpCtx | None, day: date) -> MarketSnapshot:
    kind = session_kind(meta.name)
    asset = _asset_class(kind)
    volume, oi, spread = _stats(ctx)
    base = {
        "as_of": day,
        "market": meta.name,
        "dex": meta.dex,
        "asset_class": asset,
        "volume_7d_median": volume,
        "open_interest": oi,
        "impact_spread_bps": spread,
        "taker_fee": _taker(meta),
        "maker_fee": _maker(meta),
        "growth_mode": meta.growth_mode,
        "max_leverage": meta.venue_max_leverage,
        "session_type": kind,
    }
    if meta.dex == "" and meta.name in _CORE:
        return MarketSnapshot(**base, eligible=True, reason=None)
    if meta.dex == "":
        return MarketSnapshot(
            **base,
            eligible=False,
            reason="stage 1 crypto universe is BTC, ETH and SOL",
        )
    if meta.dex != "xyz":
        return MarketSnapshot(**base, eligible=False, reason="deployer is not xyz")
    root = meta.name.split(":")[-1]
    if root in config.EXCLUDED_ROOTS:
        return MarketSnapshot(**base, eligible=False, reason="excluded name")
    approved = root in config.MARKET_CLUSTER or root in config.INDEX_ROOTS
    if not approved or kind == "crypto":
        return MarketSnapshot(
            **base,
            eligible=False,
            reason="not an approved stock or commodity name",
        )
    failed = _size_reason(volume, oi, spread, stock=asset == "stock", growth=meta.growth_mode)
    if failed is not None:
        return MarketSnapshot(**base, eligible=False, reason=failed)
    return MarketSnapshot(
        **base,
        eligible=True,
        reason="eligible on today's notional; seven-day median is not stored yet",
    )


def _size_reason(
    volume: float | None,
    oi: float | None,
    spread: float | None,
    *,
    stock: bool,
    growth: bool,
) -> str | None:
    if volume is None or volume < MIN_DAY_NOTIONAL:
        return "day notional is under $20M"
    if oi is None or oi < MIN_OPEN_INTEREST:
        return "open interest notional is under $20M"
    if spread is None:
        return "impact spread is missing"
    if spread > MAX_SPREAD_BPS:
        return "impact spread is wider than 3bp"
    if stock and not growth:
        return "stock is not in growth mode"
    return None


def _stats(ctx: PerpCtx | None) -> tuple[float | None, float | None, float | None]:
    if ctx is None:
        return None, None, None
    volume = ctx.day_notional_volume
    mark = ctx.mark_px or ctx.mid_px
    oi = None
    if ctx.open_interest is not None and mark is not None and mark > 0:
        oi = ctx.open_interest * mark
    spread = None
    mid = ctx.mid_px or mark
    if ctx.impact_bid is not None and ctx.impact_ask is not None and mid is not None and mid > 0:
        spread = abs(ctx.impact_ask - ctx.impact_bid) / mid * 10_000
    return volume, oi, spread


def _asset_class(kind: str) -> str:
    if kind in {"metals", "energy"}:
        return "commodity"
    if kind == "crypto":
        return "crypto"
    return "stock"


def _taker(meta: PerpMeta) -> float:
    if meta.growth_mode:
        return config.TAKER_FEE_GROWTH
    if meta.dex == "":
        return config.TAKER_FEE_CORE
    return config.TAKER_FEE_HIP3


def _maker(meta: PerpMeta) -> float | None:
    if meta.growth_mode:
        return config.MAKER_FEE_GROWTH
    if meta.dex == "":
        return config.MAKER_FEE_CORE
    return None
