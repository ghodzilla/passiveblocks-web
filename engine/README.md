# pb-engine

**NOT VALIDATED. Simulation scaffold only. No real funds, no API keys, no orders.**

This is Stage 1 of a Hyperliquid perps engine. It lives in this folder so the
passiveblocks website (Next.js, on Vercel) stays a separate app. The website
does not import this package.

This change reads public mainnet market data, on top of the local store
and the hard risk limits. It does not send a Telegram message or place an
order. Later changes add those pieces. Nothing here is evidence that a
strategy has an edge.

Long and short simulated entries are both allowed. Leverage is not.

## Hard limits

These are literals in `src/pb_engine/config.py`. They are not environment
variables, and there is no settings file. A test fails if `MAX_LEVERAGE` is
not exactly 2, and if the other limits below are not the values in the spec.

| Limit | Value | What the code does |
| --- | --- | --- |
| Account leverage | 2x gross notional / equity | A new entry that would go over 2x is rejected, not cut down to the leftover room |
| Risk per trade | 0.5% of equity at the stop | Weight above 1 is rejected, so this cannot be raised by a caller |
| Per position | at most 1x equity | A tighter stop is cut down to this ceiling, which only reduces risk |
| Minimum order | $11 | Smaller results are rejected |
| Open positions | 3, and only one per market | A fourth, or a second in the same market, is rejected |
| Cluster / total risk at the stops | 1.5% per cluster, 2% total | Including one energy position at most |
| Net long/short | 1.5x equity | A hedge that reduces the net is still allowed |
| Daily loss | −2% from the first equity of the UTC day | Blocks new entries until the next UTC day |
| Drawdown kill | −10% from the peak | Stays on until `resume_from_drawdown_kill` |

Simulated starting equity is 1,000 USDC. That number is not a balance at a
broker. `HL_NETWORK` is the label `sim-mainnet-data`. It does not select a
signing endpoint.

`pb-engine status` prints the limits. `pb-engine run-once` exits with an
error. The simulation cycle is not in this build.

## Local store

Stage 1 writes one SQLite file, `var/pb-engine.sqlite3`, relative to the
working directory. That directory is gitignored. JSON is stored as text.
Timestamps are ISO-8601 text. `src/pb_engine/store.py` is the only module
that opens the file.

`db/hl/001_init.sql` is the Postgres shape of the same tables, under schema
`hl`. It is a file only. Nothing applies it. It does not connect to Neon,
and it does not create the `hl_engine` or `hl_reader` roles. Those roles are
named in comments for a later review. The file has no credentials.

`hl_control` is a single row. It can halt, request a flatten, drain, or
pause new entries. It cannot change a risk limit.

The `max_leverage` column on a market snapshot is the venue's published
maximum. It is not the engine cap. The cap stays the literal 2, and an
entry that would go over 2x is still rejected.

A recorded fill may be labelled `shadow` or `exchange`. Writing that row
does not send an order. Shadow trades are marked `gated` or `ungated`.
Asset class includes `commodity`, so a gold, silver, or oil snapshot uses
the same check as crypto and stock.

## Market data

Public mainnet only: `https://api.hyperliquid.xyz/info` and
`wss://api.hyperliquid.xyz/ws`. There is no signing and no account query.
The info client reads mids, the L2 book, candles, funding, open interest,
and meta. Meta includes trade[XYZ] HIP-3 markets when the request names
dex `xyz`. A HIP-3 asset id is 100000 plus the dex list position times
10000, plus the meta position. That list position is not a constant in
the code.

`fixtures/mainnet/` is a public snapshot from 2026-11-28 08:28 UTC. Books
for BTC, ETH, SOL, `xyz:GOLD`, `xyz:NVDA`, and `xyz:CL`. Candles are 15m
(24h), 1h (3d) and 4h (7d) for BTC, ETH, and SOL, plus 1h for `xyz:GOLD`.
Funding is three days for BTC, ETH, SOL, and `xyz:GOLD`. Deployer
addresses were not stored. Tests read these files and do not call the
network. `pytest -m network` is the only live check, and CI does not run
it. `load_tape` reads the snapshot. `pb-engine run-once` does not use it
yet.

A book older than 5 seconds is stale. A live stream with no message for
more than 10 seconds is silent. Either one blocks new entries. A replay
can ignore stream silence, because there is no live socket. The run-once
loop does not apply this yet.

The public trade stream includes account addresses. The parser drops
those fields. The stream keeps the latest book per coin and the last 100
prints. It does not run in a background thread. The caller pumps it, and
a dropped socket is opened again with the same subscriptions.

The venue maximum stored from meta is not the engine cap. The cap stays
the literal 2.

## Manual restart

`resume_from_drawdown_kill` clears a drawdown halt and sets the peak to the
equity passed in. The next kill is another −10% from that point. The −10%
limit itself does not change, and the call has to name who restarted it.

A −2% daily stop on the same UTC day stays on after that restart. It clears
on its own at the next UTC day. The first equity observed on a UTC date is
that day's starting equity.

`must_flatten` means the limits say positions should be closed. This package
does not close them. There is no order path.

## Tests

From this directory, with nothing on the network and no secrets:

```bash
uv sync
uv run ruff check .
uv run pytest -q
```

CI runs those two commands on Python 3.12 when files under `engine/` change.
It does not build the website.

## Website

TypeScript, ESLint, and the Vercel upload ignore this folder. Website lint,
typecheck, tests, and `next build` do not run this package.

## Not in this build

Shadow fills, strategies, the signal gate, Telegram, and systemd. Also
not in this build: wiring the stale check into the run-once loop, the
stop-versus-cost filter, the funding guard, the 30-entries-a-day cap, and
the pause after six losses. No testnet. No mainnet orders. No keys. Do not
commit an env file, a token, or a wallet address; the repo is public.
