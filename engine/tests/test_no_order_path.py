"""Fail if an order path, an account query, or signing code appears."""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"

ALLOWED_URLS = {
    "https://api.hyperliquid.xyz/info",
    "wss://api.hyperliquid.xyz/ws",
}

BANNED_SNIPPETS = (
    "/exchange",
    "hyperliquid-testnet",
    "private_key",
    "secret_key",
    "HL_AGENT",
    "place_order",
    "update_leverage",
    "updateLeverage",
    "approve_agent",
    "approveAgent",
    "send_asset",
    "sendAsset",
    "eth_account",
    "clearinghouseState",
    "spotClearinghouseState",
    "openOrders",
    "frontendOpenOrders",
    "userFills",
    "userFunding",
    "userFees",
    "orderStatus",
    "orderUpdates",
    "userEvents",
    "cancelByCloid",
    "scheduleCancel",
    "updateIsolatedMargin",
    "sign_l1_action",
    "sign_user_signed_action",
)

BANNED_IMPORT_ROOTS = {
    "aiohttp",
    "coincurve",
    "ecdsa",
    "eth_account",
    "eth_keys",
    "eth_utils",
    "httpx",
    "hyperliquid",
    "nacl",
    "requests",
    "socket",
}

BANNED_DEF_NAMES = {
    "approve_agent",
    "cancel_order",
    "place_order",
    "send_asset",
    "sign_l1_action",
    "sign_user_signed_action",
    "update_leverage",
    "withdraw",
}

IMPORT_ONLY_IN = {
    "urllib": "http.py",
    "websockets": "ws_live.py",
}


def test_source_has_no_order_endpoint_or_signing() -> None:
    files = list(SRC.rglob("*.py"))
    assert files, "package source is missing"
    for path in files:
        text = path.read_text(encoding="utf-8")
        for snippet in BANNED_SNIPPETS:
            assert snippet not in text, f"{path.name} contains {snippet}"
        assert re.search(r"0x[0-9a-fA-F]{6,}", text) is None, path.name
        tree = ast.parse(text)
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                lowered = node.value.lower()
                is_url = "://" in node.value and node.value != "://"
                hosted = is_url or "api.hyperliquid" in lowered
                if hosted and node.value not in ALLOWED_URLS:
                    pytest.fail(f"{path.name} has a non-public url")
            if isinstance(node, ast.Import):
                roots = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                roots = [node.module.split(".")[0]] if node.module else []
            else:
                roots = []
            for root in roots:
                if root in BANNED_IMPORT_ROOTS:
                    pytest.fail(f"{path.name} imports {root}")
                only = IMPORT_ONLY_IN.get(root)
                if only is not None and path.name != only:
                    pytest.fail(f"{path.name} imports {root}")
            defined = isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            if defined and node.name in BANNED_DEF_NAMES:
                pytest.fail(f"{path.name} defines {node.name}")
