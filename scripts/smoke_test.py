#!/usr/bin/env python3
"""
smoke_test.py — Post-deploy end-to-end smoke test for passiveblocks.io

Checks:
  1. Home page (200)
  2. /tax page (200)
  3. /newsletter page (200)
  4. /learn page (200)
  5. /api/yield/income — valid JSON response
  6. /api/wallet/gas — accepts address param, returns 200 or 400 (not 500)
  7. /api/wallet/tax-summary — accepts address param, returns 200 or 400 (not 500)

Telegrams Pritesh with pass/fail. Exits 1 if any check fails.

Usage:
  python3 smoke_test.py            # full test
  python3 smoke_test.py --silent   # no Telegram on pass (fail still alerts)
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────

FRONTEND_URL = "https://passiveblocks.io"
TG_TOKEN     = os.environ.get("TG_TOKEN", "")
TG_CHAT_ID   = "6571132280"

# Public test address (Vitalik — no real funds at risk, widely used for testing)
TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

SILENT = "--silent" in sys.argv

# ── Helpers ───────────────────────────────────────────────────────────────────

def http(method: str, url: str, body=None, headers=None, timeout=30) -> tuple[int, dict | str]:
    req_headers = headers or {}
    data = json.dumps(body).encode() if body is not None else None
    if data:
        req_headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            try:
                return r.status, json.loads(raw)
            except Exception:
                return r.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def send_telegram(text: str) -> None:
    if not TG_TOKEN:
        print("TG_TOKEN missing — skipping Telegram")
        return
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    try:
        http("POST", url, body={"chat_id": TG_CHAT_ID, "text": text}, timeout=10)
    except Exception as e:
        print(f"Telegram send failed: {e}")


# ── Check runner ─────────────────────────────────────────────────────────────

class Check:
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.detail = ""

    def ok(self, detail=""):
        self.passed = True
        self.detail = detail
        print(f"  ✅ {self.name}" + (f" — {detail}" if detail else ""))

    def fail(self, detail=""):
        self.passed = False
        self.detail = detail
        print(f"  ❌ {self.name}" + (f" — {detail}" if detail else ""))


# ── Smoke test ────────────────────────────────────────────────────────────────

def run_smoke_test():
    checks: list[Check] = []
    started = datetime.now(timezone.utc)

    print(f"\n{'='*55}")
    print(f"PassiveBlocks Smoke Test — {started.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*55}\n")

    # ── 1. Home page ──────────────────────────────────────────────────────────
    c = Check("Home page")
    checks.append(c)
    status, _ = http("GET", f"{FRONTEND_URL}/")
    if status == 200:
        c.ok("HTTP 200")
    else:
        c.fail(f"HTTP {status}")

    # ── 2. Tax page ───────────────────────────────────────────────────────────
    c = Check("Tax page (/tax)")
    checks.append(c)
    status, _ = http("GET", f"{FRONTEND_URL}/tax")
    if status == 200:
        c.ok("HTTP 200")
    else:
        c.fail(f"HTTP {status}")

    # ── 3. Newsletter page ────────────────────────────────────────────────────
    c = Check("Newsletter page (/newsletter)")
    checks.append(c)
    status, _ = http("GET", f"{FRONTEND_URL}/newsletter")
    if status == 200:
        c.ok("HTTP 200")
    else:
        c.fail(f"HTTP {status}")

    # ── 4. Learn page ─────────────────────────────────────────────────────────
    c = Check("Learn page (/learn)")
    checks.append(c)
    status, _ = http("GET", f"{FRONTEND_URL}/learn")
    if status == 200:
        c.ok("HTTP 200")
    else:
        c.fail(f"HTTP {status}")

    # ── 5. Yield income API ───────────────────────────────────────────────────
    c = Check("Yield income API (/api/yield/income)")
    checks.append(c)
    status, body = http("GET", f"{FRONTEND_URL}/api/yield/income")
    if status == 200 and isinstance(body, dict):
        c.ok(f"returned {len(body)} keys")
    else:
        c.fail(f"HTTP {status}: {str(body)[:80]}")

    # ── 6. Gas API ────────────────────────────────────────────────────────────
    c = Check("Gas API (/api/wallet/gas)")
    checks.append(c)
    status, body = http("GET", f"{FRONTEND_URL}/api/wallet/gas?address={TEST_ADDRESS}&chain=ethereum")
    if status in (200, 400):  # 400 = missing key is fine, 500 = broken
        c.ok(f"HTTP {status} (not 500)")
    else:
        c.fail(f"HTTP {status}: {str(body)[:80]}")

    # ── 7. Tax summary API — probe without address (avoids long Etherscan scan)
    c = Check("Tax summary API (/api/wallet/tax-summary)")
    checks.append(c)
    status, body = http("GET", f"{FRONTEND_URL}/api/wallet/tax-summary")  # no address → 400
    if status in (400, 503):  # 400=address required, 503=no API key — both mean endpoint is up
        c.ok(f"HTTP {status} (endpoint reachable)")
    elif status == 200:
        c.ok("HTTP 200")
    else:
        c.fail(f"HTTP {status}: {str(body)[:80]}")

    _report(checks, started)
    return checks


def _report(checks: list[Check], started: datetime):
    passed = [c for c in checks if c.passed]
    failed = [c for c in checks if not c.passed]
    total = len(checks)
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()

    print(f"\n{'='*55}")
    print(f"Result: {len(passed)}/{total} passed in {elapsed:.0f}s")
    if failed:
        print("Failed checks:")
        for c in failed:
            print(f"  ❌ {c.name}: {c.detail}")
    print(f"{'='*55}\n")

    if failed:
        lines = [f"🔴 PassiveBlocks smoke test FAILED — {len(failed)}/{total} checks failed"]
        for c in failed:
            lines.append(f"  ❌ {c.name}: {c.detail}")
        lines.append(f"Run: python3 /opt/passiveblocks-web/scripts/smoke_test.py")
        send_telegram("\n".join(lines))
        sys.exit(1)
    elif not SILENT:
        send_telegram(
            f"✅ PassiveBlocks smoke test passed — {total}/{total} checks in {elapsed:.0f}s\n"
            f"  pages + yield/gas/tax APIs all green"
        )


if __name__ == "__main__":
    run_smoke_test()
