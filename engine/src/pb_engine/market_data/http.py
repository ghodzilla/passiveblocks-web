"""The only REST call in the package.

It posts to the public info URL from config. Tests pass their own
poster so this function does not run.
"""

from __future__ import annotations

import json
import urllib.request
from collections.abc import Mapping
from typing import Any

from pb_engine.config import INFO_URL


def post_json(url: str, body: Mapping[str, Any], timeout: float = 10.0) -> Any:
    if url != INFO_URL:
        raise ValueError("public info url only")
    payload = json.dumps(dict(body), separators=(",", ":")).encode()
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
    return json.loads(raw.decode())
