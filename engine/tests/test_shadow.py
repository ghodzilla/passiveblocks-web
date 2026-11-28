"""Known book walks: price, fee, and the slip cap."""

from __future__ import annotations

from pathlib import Path

import pytest

from pb_engine.market_data.replay import load_tape
from pb_engine.market_data.types import Book, BookLevel
from pb_engine.shadow import funding_payment, round_trip_cost, taker_fee, walk_book

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "mainnet"


def _book(
    asks: tuple[tuple[float, float], ...],
    bids: tuple[tuple[float, float], ...] = (),
) -> Book:
    return Book(
        coin="BTC",
        time_ms=0,
        bids=tuple(BookLevel(px, sz, 1) for px, sz in bids),
        asks=tuple(BookLevel(px, sz, 1) for px, sz in asks),
    )


def test_buy_walks_asks_until_the_slip_cap() -> None:
    book = _book(((100.0, 1.0), (100.05, 5.0), (101.0, 10.0)))
    walk = walk_book(book, side="long", size=3, slip_cap=0.001, fee_rate=0.00045)
    assert walk is not None
    assert walk.filled == 3
    assert walk.complete is True
    assert walk.cancelled == 0
    assert walk.average_px == (100.0 + 2 * 100.05) / 3
    assert walk.notional == 100.0 + 200.1
    assert walk.fee == walk.notional * 0.00045
    assert walk.slippage_usd == (walk.average_px - 100.0) * 3

    partial = walk_book(book, side="long", size=20, slip_cap=0.001, fee_rate=0.00045)
    assert partial is not None
    assert partial.filled == 6
    assert partial.complete is False
    assert partial.cancelled == 14
    assert partial.average_px == (100.0 + 5 * 100.05) / 6


def test_sell_walks_bids_and_an_empty_book_fills_nothing() -> None:
    book = _book((), ((100.0, 1.0), (99.95, 5.0), (99.0, 10.0)))
    walk = walk_book(book, side="short", size=3, slip_cap=0.001, fee_rate=0.00045)
    assert walk is not None
    assert walk.filled == 3
    assert walk.average_px == (100.0 + 2 * 99.95) / 3
    assert walk_book(_book(()), side="long", size=1, slip_cap=0.001, fee_rate=0) is None


def test_fee_schedule_follows_growth_mode_not_an_account() -> None:
    assert taker_fee("BTC", growth_mode=True, fee_scale=1) == 0.00045
    assert taker_fee("xyz:GOLD", growth_mode=False, fee_scale=1) == 0.0009
    assert taker_fee("xyz:NVDA", growth_mode=True, fee_scale=1) == 0.00009
    assert taker_fee("xyz:GOLD", growth_mode=False, fee_scale=2) == 0.0018
    assert round_trip_cost(0.00045) == 0.0009


def test_funding_is_signed_hourly_oracle_notional() -> None:
    paid = funding_payment(notional=1000, hourly_rate=0.0001, hours=24, side="long")
    received = funding_payment(notional=1000, hourly_rate=0.0001, hours=24, side="short")
    assert paid == pytest.approx(2.4)
    assert received == pytest.approx(-2.4)


def test_recorded_btc_book_fills_a_small_buy_at_the_touch() -> None:
    tape = load_tape(FIXTURES)
    book = next(item for item in tape.books if item.coin == "BTC")
    best = min(level.px for level in book.asks)
    top = min(book.asks, key=lambda level: level.px)
    assert top.sz * best > 11
    walk = walk_book(book, side="long", size=11 / best, slip_cap=0.001, fee_rate=0.00045)
    assert walk is not None
    assert walk.complete is True
    assert walk.average_px == best
    assert walk.fee == walk.notional * 0.00045
    assert walk.slip_fraction == 0
