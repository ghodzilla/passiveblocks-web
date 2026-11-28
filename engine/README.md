# pb-engine

**NOT VALIDATED. Simulation scaffold only. No real funds, no API keys, no orders.**

This is Stage 1 of a Hyperliquid perps engine. It lives in this folder so the
passiveblocks website (Next.js, on Vercel) stays a separate app. The website
does not import this package.

This change runs one simulated cycle on a recorded mainnet book, on top
of the local store and the hard risk limits. It does not send a Telegram
message or place an order. The signal gate and the closer are not in
this build. Nothing here is evidence that a strategy has an edge.

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

`pb-engine status` prints the limits. `pb-engine run-once --replay
fixtures/mainnet` runs one cycle and prints `taken=0`. It does not send
an order.

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
it. `load_tape` reads the snapshot. `pb-engine run-once --replay` uses
that snapshot as the whole cycle. The clock is the capture time, not
the wall clock, so the recorded book is still inside the 5 second window.

A book older than 5 seconds is stale. A live stream with no message for
more than 10 seconds is silent. Either one blocks new entries. A replay
ignores stream silence, because there is no live socket. The cycle does
apply the book check: pass a later `now` and the new shadow entries stop.

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

## One simulated cycle

`pb-engine run-once --replay fixtures/mainnet` loads the snapshot, asks
the strategies for candidates, screens them, walks the recorded book,
and writes a local SQLite file. `--db` chooses the file. The default
is `var/pb-engine.sqlite3`. `--live-data` is refused. This command does
not open a socket.

The cycle writes a heartbeat, an equity row at the starting 1,000 USDC,
one strategy row per idea that fired, a skip signal, and an ungated
shadow trade when the book can fill. It writes no gate decision, no
trade plan, no close, and no order row. `taken` in the output is 0.
Equity does not move, because nothing is closed. The funding number on
a shadow trade is the expected cost of the planned hold, not a payment
that has settled.

At the start there is no 30-trade history. Every strategy is stored as
`shadow`. The ranker skip is `no_proven_edge`. A live rank would still
not be taken: there is no gate yet, and the label would be `no_gate`.
`pred_win_prob` is 0.5 because nothing has calibrated it. The stored
`pred_edge_r` is the strategy's planned R, not a proven edge.
`edge_lcb_r` is 0 until there is history.

Baselines `btc_hold_1x` and `random_entry` are walked for a $11 research
size and never join the open book. `random_entry` uses a seeded
generator, so the same seed replays the same side. On this snapshot the
4h momentum rule fires; the other four rules do not, because the tape
is short of their warmup (the 4h EMA needs 51 bars, and funding fade
needs 720 hourly prints). Hand-built series in the tests cover the
fire and the no-fire case for each rule.

## Shadow fills

A buy walks asks and a sell walks bids, best price first. Filling stops
at the slip cap: 0.1% for crypto and single stocks, 0.05% for index
perps and for gold, silver, and oil. The rest of the size is cancelled.
The fee is the published tier-0 taker rate. Core is 0.045% even if a
growth flag is set. A HIP-3 name is 0.009% in growth mode and 0.09%
otherwise, times `deployerFeeScale` when the meta row has one. There is
no account fee lookup. Entries are IOC, so the maker rates are recorded
and not charged. Funding uses the asset context's current hourly rate
when the tape has one, otherwise the latest hourly print. A positive
rate is paid by longs, on oracle notional.

## Guards beyond the leverage cap

These sit in front of a new shadow entry. They do not change the rule
that an entry over 2x is rejected rather than cut down.

| Check | Rule |
| --- | --- |
| Stop versus cost | Stop distance at least 3× the round-trip taker fee |
| Funding versus edge | Expected funding over the hold above 25% of the strategy's planned edge skips the entry. A planned edge of 0 does not use this comparison |
| Funding clock | No new entry in the 2 minutes before the hour when funding is against the side and the hourly rate is past 0.01% |
| Entries | 30 per UTC day. This cycle starts at 0 |
| Losses | 6 in a row pauses new strategy entries for 6 hours. This cycle has no loss history, so the pause is idle |
| Stale book | Older than 5 seconds versus the cycle clock blocks the entry |

Stocks (`xyz:NVDA` and any name that is not in the cluster map) are flat
from Friday 19:30 ET through Sunday 20:05 ET, on Thanksgiving 2026, 25
December 2026, and 1 January 2027, and from 12:30 ET on 24 and 31
December 2026. They are also flat on an earnings date and on the
weekday before it. Pass the earnings date in; this build does not fetch
one. The Saturday snapshot blocks `xyz:NVDA` and still allows BTC.

Gold, silver, oil, and the index names `XYZ100` and `SP500` are flat
from Friday 16:30 ET through Sunday 18:00 ET, and on 25 December 2026
and 1 January 2027. The Monday–Thursday 17:00 ET break is not applied
yet. Oil and Brent (`CL`, `WTI`, `BRENTOIL`, with or without the `xyz:`
prefix) are not held across 17:30 ET on the 5th through 10th weekday of
the month. In October 2026 that is 7 October through 14 October. Those
weekdays do not yet skip a futures holiday, except the two full closures
above. `SOXL`, `SOXS`, `KORU`, `MSTR`, and `COIN` are refused.

The momentum threshold that is not numeric in the spec is frozen as
one 4h ATR divided by price. The Donchian trail and the other exit
rules are stored on the candidate. This cycle does not move a stop.

## Not in this build

The signal gate, the closer, Telegram, systemd, health, report, and
alert-test. Also not in this build: the commodity daily-break state
machine, a full exchange holiday calendar, and a live socket inside
`run-once`. No testnet. No mainnet orders. No keys. Do not commit an
env file, a token, or a wallet address; the repo is public.
