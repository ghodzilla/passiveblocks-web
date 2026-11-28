# pb-engine

**NOT VALIDATED. Simulation scaffold only. No real funds, no API keys, no orders.**

This is Stage 1 of a Hyperliquid perps engine. It lives in this folder so the
passiveblocks website (Next.js, on Vercel) stays a separate app. The website
does not import this package.

This change is the schema file and the local SQLite store, on top of the
hard risk limits. It does not read the market, send a Telegram message, or
place an order. Later changes add those pieces. Nothing here is evidence
that a strategy has an edge.

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

Market data, shadow fills, strategies, the signal gate, Telegram, and
systemd. Also not in this build: the stale-data halt, the
stop-versus-cost filter, the funding guard, the 30-entries-a-day cap, and
the pause after six losses. No testnet. No mainnet orders. No keys. Do not
commit an env file, a token, or a wallet address; the repo is public.
