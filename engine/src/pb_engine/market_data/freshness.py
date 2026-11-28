"""Stale public data. Spec §5.7.

A book older than the configured limit, or a live stream that has been
silent longer than its limit, blocks new entries. This module only reports that. The simulated
cycle calls it before a new shadow entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from pb_engine import config
from pb_engine.market_data.types import Book


@dataclass(frozen=True, slots=True)
class Freshness:
    book_age_s: float | None
    stream_age_s: float | None
    book_stale: bool
    stream_silent: bool

    @property
    def blocks_new_entries(self) -> bool:
        return self.book_stale or self.stream_silent


def assess(
    *,
    book_time: datetime | None,
    stream_time: datetime | None,
    now: datetime,
    require_stream: bool,
) -> Freshness:
    _aware("now", now)
    book_age = _age("book_time", book_time, now)
    stream_age = _age("stream_time", stream_time, now)
    book_stale = book_time is None or book_age > config.BOOK_STALE_SECONDS
    if stream_time is None:
        stream_silent = require_stream
    else:
        stream_silent = stream_age > config.STREAM_SILENT_SECONDS
    return Freshness(
        book_age_s=book_age,
        stream_age_s=stream_age,
        book_stale=book_stale,
        stream_silent=stream_silent,
    )


def book_time(book: Book) -> datetime:
    return datetime.fromtimestamp(book.time_ms / 1000, UTC)


def _age(label: str, value: datetime | None, now: datetime) -> float | None:
    if value is None:
        return None
    _aware(label, value)
    return (now - value).total_seconds()


def _aware(label: str, value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must be timezone-aware")
