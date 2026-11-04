# Macro Regime Engine (phase 1)

Owner-only page at `/private/regime`. It scores liquidity, policy path, credit, the US−AU growth differential, CFTC positioning, and an AI capex and concentration gauge, then maps the regime to a risk budget. It is an educational research tool, not financial advice, and it is not linked from the public nav, the OS nav, or the sitemap.

`/private/regime` does not use Supabase. The owner signs in with a password at `/private/login`. `/os` and `/drafts` still use the Supabase magic-link login and `OS_ALLOWED_EMAILS` / `ALLOWED_IPS`. Those lists do not open this page.

## Required environment variables

Set these in Vercel (Production and Preview). Do not commit values. This change does not edit Vercel settings.

| Variable | Required | Purpose |
| --- | --- | --- |
| `REGIME_PASSWORD_HASH` | Yes, for password sign-in | scrypt hash of the owner password. See the command below. |
| `REGIME_SESSION_SECRET` | Yes, for password sign-in | HMAC key for the session cookie. At least 32 characters. `openssl rand -base64 32` |
| `FRED_API_KEY` | Yes, for live scores | Free key from https://fred.stlouisfed.org/docs/api/api_key.html. The same key fetches IPG3344S for the capex leg. |
| `CRON_SECRET` | Yes, for the scheduled refresh | Long random string. Vercel sends it as `Authorization: Bearer $CRON_SECRET` on the cron request. It does not unlock the HTML page. |
| `REGIME_ALLOWED_IPS` | No | Optional comma-separated IPs that can open the page without a password. This is **not** `ALLOWED_IPS`. Leave it unset to require the password. |
| `REGIME_WATCHLIST` | No | Comma-separated stock symbols that replace the default watchlist (US megacaps and a liquid ASX 20 slice). Example: `AAPL,BHP.AX`. Leave unset for the built-in list. An empty value shows no stocks. No price API key is required. |
| `REGIME_CAPITAL` | No | Paper-portfolio capital in dollars. Default `100000`. A value saved on the owner page wins over this. |
| `REGIME_TARGET_CAGR` | No | Aspiration return as a decimal, default `0.30` (30% a year). It is labeled an aspiration, not a forecast. A saved page value wins. |
| `BLOB_READ_WRITE_TOKEN` | No | When set with `REGIME_SESSION_SECRET`, the paper journal is encrypted and stored in Vercel Blob. Without it, the journal stays on the local instance and the page says so. |
| `REGIME_JOURNAL_PATH` | No | Optional file path for the local journal. Default is a temp file. Do not commit it. |

No new environment variable is required for themes, ATR sizing, the dip rule, or the weekly review. The page still runs, and it labels the journal as not durable, when `BLOB_READ_WRITE_TOKEN` is unset. SPY, RSP, SMH, and the crypto pairs come from the same Yahoo chart endpoint. `DFII10` and `DTWEXBGS` use `FRED_API_KEY`. If that key is missing, scarcity stays off and the gap is labeled. IPG3344S is skipped the same way.

`REGIME_OWNER_EMAILS` is no longer read. A Supabase session does not open `/private/regime`.

If `REGIME_PASSWORD_HASH` or `REGIME_SESSION_SECRET` is missing or malformed, and `REGIME_ALLOWED_IPS` does not match, every regime page and API is a 404. The login form is not shown. That is the default.

### Generate the password hash

The hash format is `scrypt$16384$8$1$<salt>$<hash>` (scrypt N=16384, r=8, p=1, 16-byte salt, 32-byte key). The script prints the hash on stdout and does not store the password.

```bash
REGIME_PASSWORD='choose-a-long-password' npm run regime:hash-password
```

The password must be at least 12 characters. Copy the printed line into `REGIME_PASSWORD_HASH`, then unset `REGIME_PASSWORD`.

Generate the session secret separately:

```bash
openssl rand -base64 32
```

Put that value in `REGIME_SESSION_SECRET`.

## Session

A successful login sets `pb_regime_session`. The cookie is `httpOnly`, `Secure`, `SameSite=Strict`, and expires after 12 hours (absolute expiry inside the signed payload). The signature is HMAC-SHA256. Logout is `POST /api/regime/logout`, which clears the cookie.

Failed passwords are counted in memory per IP: 5 failures in 15 minutes locks that IP for 15 minutes, and a correct password during the lock is still rejected. Each serverless instance keeps its own counter.

The snapshot cache is Next.js `unstable_cache` (Vercel runtime cache, tag `regime-snapshot`, one hour). It is not Supabase. FRED and CFTC fetches are `no-store`.

Daily ETF and stock prices use the same tag. The source is the Yahoo chart endpoint (`query1` / `query2`, adjusted close, two-year daily range). It does not need a paid key. Stooq’s CSV is behind a browser check from this host, so it is not used. A symbol that fails is recorded as a gap. Prices are never filled in or invented.

## Macro plays and stock ideas

The owner page adds a playbook for the current regime: preferred and avoid expressions across equity sectors and factors, duration, USD and AUD, gold, and cash. Tickers are liquid US-listed and ASX-listed ETFs (sector SPDRs, TLT/IEF/SHY, GLD, UUP, FXA, VAS/VGS/IOZ, AAA/BILL, and the ASX gold ETF).

Each candidate is marked Confirmed only when this print prefers it and three daily signals agree: 12–1 month momentum above zero, price above the 200-day average, and a 5-session return z-score below 1.5. Otherwise the row is Watch or Avoid. Cash ETFs do not need an uptrend. Suggested max weight is the regime vol target divided by 20-day annualised volatility, capped at 20% for a tactical ETF and 2% for a watchlist stock, then scaled so the book stays inside the gross and net budget. A name that is not Confirmed is not sized. Each row shows the invalidation (200-day break, momentum flip, or regime/action change) and the bar date.

When the regime action is do nothing or reduce risk, that banner is repeated and candidates are limited to defensive and cash expressions. The stock watchlist is stood down.

## AI capex and concentration

Rules version `regime-v2` adds a sixth component, base weight **8%**. The other five keep their previous proportions on the remaining 92% (liquidity 0.276, policy 0.184, credit 0.230, growth 0.138, positioning 0.092). A missing leg is dropped and the rest are renormalised. The gauge is not part of the core: liquidity, policy, and credit still have to exist before a composite is published, and a missing AI print does not block the regime.

The blend is the equal average of whichever legs have a trailing z-score (252 observations, 126 minimum, winsorised at ±3):

| Leg | Series | Sign |
| --- | --- | --- |
| Index concentration | log(SPY / RSP), adjusted close | Sign-flipped. Cap-weight beating equal-weight is fragility, so a high raw z lowers the composite. |
| Semiconductors | log(SMH / SPY) | A rise versus the market is risk-on. |
| Hardware capex proxy | FRED `IPG3344S`, industrial production of semiconductors and other electronic components | A rise is risk-on. Omitted, with a labeled gap, when the fetch fails. |

Dollar hyperscaler capex is not a separate series. Data-center electricity demand is omitted: no free series isolates it, and utilities (XLU) are not used as a stand-in. A price leg older than 10 days is left out of the live print. Capex uses the 75-day monthly stale limit. The history column keeps the point-in-time blend.

Because the weight is 8%, a full ±3 concentration spike on an otherwise flat book stays inside the |composite| < 0.35 no-edge band.

## Crowding, overlap, and signal health

Average pairwise correlation uses the last 60 overlapping daily log returns across the price book (playbook ETFs, the watchlist, and the theme names, including BTC-USD, ETH-USD, and SOL-USD). It is unknown, and weights are not scaled, until at least 8 series produce at least 28 pairs. Dispersion is the cross-sectional standard deviation of 20-day returns. It is shown and does not scale weights a second time.

| Average correlation | Risk-weight scale |
| --- | --- |
| At or below 0.55 | 1 |
| Between 0.55 and 0.70 | Linear from 1 down to 0.50 |
| At or above 0.70 | 0.50 |

Cash is not scaled. The scale is applied after the gross and net budget, and it only reduces weights.

Confirmed ideas in the AI/megacap cluster share one group cap of **25%**: QQQ, XLK, XLC, SMH, NVDA, MSFT, AAPL, AMZN, GOOGL, META, AVGO, TSLA, VGS.AX, BTC-USD, ETH-USD, and SOL-USD. SPY is not in that list. Confirmed pairs with a 60-day correlation of at least 0.80 are grouped the same way. The page shows combined weight before and after the cap. If pairwise correlation cannot be computed, the identity cap still applies and the gap says so.

Signal health is a cross-sectional information coefficient and a sign hit rate on the 20-day forward return. Dates are sampled every 5th observation, up to 120 samples. Fewer than 40 samples stays **unknown**, and the default confirmation rules remain. Momentum uses the 12–1 value, trend is +1/−1 versus the 200-day average, and the reversion signal is the sign-flipped 5-session z.

| Health | Rule |
| --- | --- |
| Healthy | IC ≥ 0 and hit rate ≥ 48% |
| Degraded | IC < 0 or hit rate < 48%, but not both. That signal keeps half of its blend weight and remains a gate. |
| Retired | IC < 0 and hit rate < 48%. It drops out of the blend and is no longer a confirmation gate. |
| Unknown | Not enough pairs. No change. |

If both 12–1 momentum and the 200-day trend are retired, reversion alone cannot confirm a name. The row stays Watch.

## Themes

The Themes panel is a written overlay, not a second opinion model. The list lives in `lib/regime/themes.config.ts` with a version and a change log. A person reviews it once a quarter. The weekly job is not allowed to edit the file or flip a switch.

| Theme | Basket | On when |
| --- | --- | --- |
| AI infrastructure | SMH, XLU (power), EQIX, DLR | The AI capex component z-score is strictly higher than the prior print. Missing prints stay off. |
| Crypto | BTC-USD, ETH-USD, SOL-USD | Bitcoin is above its 200-day average **and** the liquidity z-score is rising. Both are required. |
| Scarcity | GLD, SLV, BTC-USD | The 10-year real yield (`DFII10`) is falling, **or** the trade-weighted dollar (`DTWEXBGS`) is weakening. One true leg is enough. Both unknown stays off. |

An equal print is not a rise. A series older than 10 days is unknown. Bitcoin sits in both the crypto basket and the scarcity basket, and it counts toward both 20% theme caps. A name that is already in the playbook (SMH, XLU, GLD) keeps one weight.

## Risk size, pyramids, and the dip

Every sized idea uses the same stop: entry minus k times ATR(20). ATR is the simple average of the last 20 true ranges. High and low have to be present. If they are missing, no stop is invented and the weight falls back to the volatility target, with a note.

Quantity is `(capital × risk%) / (entry − stop)`. Risk percent must sit between 0.5% and 1%. The default is 0.75%. A value outside that range is left unsized. Then the existing caps still bind: 20% of capital in one theme, 25% in the AI/megacap/crypto overlap group, 20% in one ETF or crypto line, 2% in one stock, plus the regime gross and net budget and the crowding scale. Cash is not scaled.

Pyramiding adds only after the open paper position is up at least 1R from its original entry. A price at or below that entry is a loser: do not add. The original entry and the original R stay when an add is allowed.

The paper portfolio starts as cash equal to capital (`REGIME_CAPITAL`, default $100,000, or the amount saved by the owner session). The daily refresh marks it. After a 10% drawdown from the peak, no new entries are taken. Adds to winners that are already up 1R can still be considered; a brand-new line is zero. The 30% aspiration does not override the halt. With no marks yet, the halt is not invented.

**Buy the dip — confirmed** is a flag, not an order. It appears only when the regime is Risk-On or Transitional, the theme is on, the close is 10–20% below the 60-day high, and the close is back above the 20-day average. It does not appear in Tightening/Stress or Crisis, and it does not appear while the drawdown halt is active.

## Improvement loop

Each daily refresh logs the theme calls, dip flags, and risk entries, and fills in the forward 5-, 20-, and 60-day return once those bars exist. Outcomes that do not exist yet are omitted.

The journal is version 1 JSON. With `BLOB_READ_WRITE_TOKEN` and `REGIME_SESSION_SECRET` it is encrypted (AES-256-GCM, key derived from the session secret) and stored in Vercel Blob at `regime/journal.json`. The blob SDK requires a public blob, so the ciphertext is what gets uploaded. Without the token, the file stays on the instance (or `REGIME_JOURNAL_PATH`) and the page says it is not durable. No Supabase table is used.

`vercel.json` also registers a weekly cron, Sunday 22:00 UTC:

`GET /api/regime/improve`

It is denied unless the caller has a regime session, an allowlisted IP, or presents `CRON_SECRET`. The job walks three out-of-sample folds and reports information coefficient where the signal log has it, plus hit rate, Sharpe, max drawdown, and CAGR for each tunable rule and for the stop system versus SPY and a 60/40 mix of SPY and IEF. A parameter moves only when the candidate improves Sharpe, or ties Sharpe and improves Calmar, on at least 2 of the 3 folds. Full-sample return is not a reason to accept. One parameter change per rule per calendar month. Bounds: ATR k 1.5–4 step 0.5, risk percent 0.5–1% step 0.25%, momentum lookback 189–315 step 21, dip floor 5–15% step 5%, dip ceiling 15–30% step 5%, and the floor stays below the ceiling. Risk percent is scored on the unscaled path. Raising it is leverage, and that does not count as a better rule. The owner sets it. The 10% drawdown halt still blocks new entries whatever the aspiration says.

The Improvement panel shows the target (default 30% a year, explicitly an aspiration), realised CAGR once the paper curve has 30 daily marks, the last backtested CAGR and max drawdown, the gap to the target, and which rules were promoted, demoted, or retired in the last seven days. A negative out-of-sample Sharpe is labeled demoted and is not given more risk. Drawdown limits always win over chasing the target.

The owner session can save capital and the aspiration on the page (`POST /api/regime/settings`). The cron secret cannot.

## Scheduled refresh

`vercel.json` registers two crons. The daily one is 13:15 UTC:

`GET /api/regime/refresh`

The route is denied unless the caller has a regime session, an allowlisted IP, or presents `CRON_SECRET`. The cron drops the `regime-snapshot` tag, rebuilds the regime snapshot and the price book (including crypto and the theme names), and records that day's paper mark. The weekly review is the Sunday job above.

Hobby Vercel accounts only allow a cron that runs at most once per day. Both of these schedules fit that limit. This repo does not change the Vercel project settings. The owner applies `vercel.json` on the next deploy.

## Verify it is inaccessible when signed out

Against a deployed environment where `REGIME_PASSWORD_HASH` and `REGIME_SESSION_SECRET` are set:

```bash
# Signed out. Expect a redirect (307) to /private/login?next=%2Fprivate%2Fregime
# The body must not contain scores.
curl -sI https://www.passiveblocks.io/private/regime

# API never redirects. Expect 404 Not Found.
curl -sI https://www.passiveblocks.io/api/regime
curl -sI https://www.passiveblocks.io/api/regime/refresh
curl -sI https://www.passiveblocks.io/api/regime/improve
curl -sI https://www.passiveblocks.io/api/regime/settings

# Wrong or missing cron secret. Expect 404.
curl -sI -H "Authorization: Bearer wrong" https://www.passiveblocks.io/api/regime/refresh
curl -sI -H "Authorization: Bearer wrong" https://www.passiveblocks.io/api/regime/improve

# Not in the public index.
curl -s https://www.passiveblocks.io/robots.txt | grep private
curl -s https://www.passiveblocks.io/sitemap.xml | grep private || echo "absent from sitemap"
```

`/os` and `/drafts` are unchanged: they still 404 or redirect to `/login` based on `ALLOWED_IPS` and `OS_ALLOWED_EMAILS`.

Locally, with the dev server:

```bash
REGIME_PASSWORD='choose-a-long-password' npm run regime:hash-password
# put the printed hash and a session secret in the environment, then:

REGIME_PASSWORD_HASH='scrypt$16384$8$1$...' \
REGIME_SESSION_SECRET="$(openssl rand -base64 32)" \
REGIME_ALLOWED_IPS=203.0.113.8 \
CRON_SECRET=local-only \
FRED_API_KEY=... \
npm run dev
```

```bash
curl -sI http://localhost:3000/private/regime
# 307 to /private/login

curl -sI -H 'x-forwarded-for: 203.0.113.8' http://localhost:3000/private/regime
# 200

curl -sI http://localhost:3000/api/regime/refresh
# 404

curl -sI -H 'Authorization: Bearer local-only' http://localhost:3000/api/regime/refresh
# 200

curl -sI http://localhost:3000/api/regime/improve
curl -sI http://localhost:3000/api/regime/settings
# 404

curl -sI -H 'Authorization: Bearer local-only' http://localhost:3000/api/regime/improve
# 200
```

The session cookie is `Secure`. `curl` against `http://` may not store it; send the `Cookie` header explicitly when replaying a session. Chrome treats `localhost` as a secure context and will store it.

Without `FRED_API_KEY` the page still renders for an authorised caller and tells them to do nothing / reduce risk. It does not invent market levels.

## Rule summary

Rules version `regime-v2`. Positive z is risk-on. Each component is a trailing z-score, winsorised at ±3. Base weights: liquidity 0.276, policy 0.184, credit 0.230, growth 0.138, positioning 0.092, AI capex and concentration 0.08. Missing components are renormalised. The AI leg is not required for a print.

| Regime | Entry | Vol / max gross / max net |
| --- | --- | --- |
| Risk-On Liquidity Expansion | Composite ≥ 0.65 and liquidity z ≥ 0.10. Holds until composite < 0.25 or liquidity z < −0.25. | 12% / 150% / 100% |
| Transitional | Neither stress nor confirmed risk-on. | 6% / 80% / 50%, and the action is do nothing new |
| Tightening/Stress | Composite ≤ −0.75. Holds until composite > −0.35. | 4% / 40% / 25% |
| Crisis | Composite ≤ −1.75, or credit z ≤ −2 with composite ≤ −1.25. | 3% / 20% / 10% |

`|composite| < 0.35` is the no-edge band: do nothing. Stale or missing liquidity, policy, or credit forces the preservation budget (3% vol, 20% gross, 0 net) and the message “Do nothing / reduce risk”, even if the last label was risk-on.

Stale limits: daily series 10 days, weekly series 21 days, monthly CLI 75 days.

Positioning is CFTC legacy futures-only non-commercial net / open interest for E-mini S&P (`13874A`), the 10-year note (`043602`), euro FX (`099741`), and WTI (`067651`), sign-flipped so a crowded long is risk-off. If that feed fails, the gap is shown and the weight is redistributed. VIX is not used as a stand-in.
