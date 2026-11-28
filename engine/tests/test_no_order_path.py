"""This build has no exchange client and no order function."""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"

BANNED_SNIPPETS = (
    "api.hyperliquid",
    "/exchange",
    "private_key",
    "secret_key",
    "HL_AGENT",
    "place_order",
    "update_leverage",
    "approve_agent",
    "send_asset",
    "eth_account",
)

BANNED_IMPORT_ROOTS = {
    "httpx",
    "requests",
    "aiohttp",
    "websockets",
    "urllib",
    "socket",
    "hyperliquid",
    "eth_account",
}

BANNED_DEF_NAMES = {
    "place_order",
    "cancel_order",
    "update_leverage",
    "approve_agent",
    "withdraw",
    "send_asset",
}


def test_source_has_no_order_client_or_secret() -> None:
    files = list(SRC.rglob("*.py"))
    assert files, "package source is missing"
    for path in files:
        text = path.read_text(encoding="utf-8")
        for snippet in BANNED_SNIPPETS:
            assert snippet not in text, f"{path.name} contains {snippet}"
        assert re.search(r"0x[0-9a-fA-F]{6,}", text) is None, path.name
        tree = ast.parse(text)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                roots = [node.module.split(".")[0]] if node.module else []
            else:
                roots = []
            for root in roots:
                if root in BANNED_IMPORT_ROOTS:
                    pytest.fail(f"{path.name} imports {root}")
            defined = isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            if defined and node.name in BANNED_DEF_NAMES:
                pytest.fail(f"{path.name} defines {node.name}")
