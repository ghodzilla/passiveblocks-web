"""The one environment read in the package.

It returns HL_DATABASE_URL or nothing. It does not read a leverage
setting, a key, or a config file, and it does not open the env file.
"""

from __future__ import annotations

import os

_KEY = "HL_DATABASE_URL"
_SCHEMES = frozenset({"postgres", "postgresql"})


def database_url() -> str | None:
    raw = os.environ.get(_KEY)
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    _require_postgres(text)
    return text


def redact(text: str) -> str:
    """Hide a postgres URL if one landed in an error string."""

    hidden = text
    for scheme in sorted(_SCHEMES, key=len, reverse=True):
        marker = scheme + "://"
        start = hidden.find(marker)
        while start != -1:
            end = start + len(marker)
            while end < len(hidden) and not hidden[end].isspace():
                end += 1
            hidden = hidden[:start] + scheme + "://" + "redacted" + hidden[end:]
            start = hidden.find(marker, start + len(scheme) + 3)
    return hidden


def _require_postgres(text: str) -> None:
    scheme, sep, rest = text.partition("://")
    if sep != "://" or scheme not in _SCHEMES or not rest:
        raise ValueError("HL_DATABASE_URL must be a postgres url")
