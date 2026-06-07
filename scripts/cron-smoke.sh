#!/bin/bash
# Hourly PassiveBlocks-web smoke test (Estait parity). Alerts Telegram on failure.
set -a
source /opt/abbi-labs/.env 2>/dev/null
set +a
cd /opt/passiveblocks-web && /usr/bin/python3 scripts/smoke_test.py
