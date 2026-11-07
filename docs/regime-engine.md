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
| `REGIME_TARGET_CAGR` | No | Aspiration return as a decimal, default `0.66` (66% a year). The panel labels it “Aspiration (Medallion gross ceiling 1988-2018) — not a forecast”. A saved page value wins. It does not change risk limits. |
| `REGIME_DATABASE_URL` | Yes, for a saved desk | Pooled Neon connection string (the hostname contains `-pooler`) for database `regime` on project `dark-credit-39672712`. Server-only. This is not the Supabase `DATABASE_URL`. The app does not set it and does not log it. |

Apply `db/regime/001_durable_state.sql` with the direct connection (hostname without `-pooler`) as `regime_owner` on database `regime`, branch `br-crimson-pine-bbjnrwel`. The file is idempotent and contains no password. After you create a `regime_app` role in the Neon console, run the file again so that role receives row access only. Put the pooled URL for `regime_app` in `REGIME_DATABASE_URL`. The app does not run the migration.

No Blob token and no journal file path are read. Without `REGIME_DATABASE_URL`, the page says so and new buys stay off. Serverless disk is not a fallback. Themes, ATR sizing, and the dip rule do not add another variable. SPY, RSP, SMH, and the crypto pairs come from the same Yahoo chart endpoint. `DFII10` and `DTWEXBGS` use `FRED_API_KEY`. If that key is missing, scarcity stays off and the gap is labeled. IPG3344S is skipped the same way.

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
| Scarcity | GLD, GOLD.AX, SLV, BTC-USD | The 10-year real yield (`DFII10`) is falling, **or** the trade-weighted dollar (`DTWEXBGS`) is weakening. One true leg is enough. Both unknown stays off. |

An equal print is not a rise. A series older than 10 days is unknown. Bitcoin sits in both the crypto basket and the scarcity basket, and it counts toward both 20% theme caps. A name that is already in the playbook (SMH, XLU, GLD, GOLD.AX) keeps one weight. If today’s lean already includes that group, an off theme does not block it. Bonds such as IEF and VAF.AX are not in a theme. The idea note says “No theme” and does not blame a switch.

Every section of the page reads one published view. The ideas table status and weight are copied from the sizing book after the gates, the crowding scale, and the overlap and theme caps. The page then runs the same invariant checks as `lib/regime/consistency.test.ts` and prints “Consistency check: all N rules pass”, or the rules that failed. Snapshot and fetch clocks use Australia/Melbourne. Exchange and FRED as-of values stay session dates. An unmeasured improvement number says “Not enough history yet”.

## Risk size, pyramids, and the dip

Every sized idea uses the same stop: entry minus k times ATR(20). ATR is the simple average of the last 20 true ranges. High and low have to be present. If they are missing, no stop is invented and the weight falls back to the volatility target, with a note.

Quantity is `(capital × risk%) / (entry − stop)`. Risk percent must sit between 0.5% and 1%. The default is 0.75%. A value outside that range is left unsized. Then the existing caps still bind: 20% of capital in one theme, 25% in the AI/megacap/crypto overlap group, 20% in one ETF or crypto line, 2% in one stock, plus the regime gross and net budget and the crowding scale. Cash is not scaled.

Pyramiding adds only after the open paper position is up at least 1R from its original entry. A price at or below that entry is a loser: do not add. The original entry and the original R stay when an add is allowed.

The paper portfolio starts as cash equal to capital (`REGIME_CAPITAL`, default $100,000, or the amount saved by the owner session). The daily refresh marks it. After a 10% drawdown from the peak, no new entries are taken. Adds to winners that are already up 1R can still be considered; a brand-new line is zero. The 66% aspiration does not override the halt. With no marks yet, the halt is not invented.

**Buy the dip — confirmed** is a flag, not an order, and the word “confirmed” is used only when that name is actually sized. Otherwise the line reads “Dip spotted — blocked” and names the first failing check. The price pattern is still Risk-On or Transitional, theme on, 10–20% below the 60-day high, and back above the 20-day average. It does not appear in Tightening/Stress or Crisis, and it does not appear while the drawdown halt is active. A Transitional print is still a sit-tight day, so a spotted dip is blocked until the market score is Risk-On and above +0.35.

The daily refresh at 13:15 UTC runs the same consistency rules and stores the result in the `regime_selfcheck` row. A failed check shows a red banner on the page. `GET /api/regime/selfcheck` returns `{ ok, failures, asOf }` and accepts only `Authorization: Bearer CRON_SECRET`. A session or an allowlisted IP does not unlock it. If Neon cannot be read, that route returns HTTP 500 and does not report the check as passed.

## Improvement loop

Each daily refresh logs the theme calls, dip flags, and risk entries, and fills in the forward 5-, 20-, and 60-day return once those bars exist. Outcomes that do not exist yet are omitted.

The journal is version 1 JSON in the single `regime_journal` row: paper portfolio, signal calls, forward outcomes, and weekly notes. It is not encrypted into a public blob. It is reachable only with the Neon connection string, and the page still requires the owner session. The Supabase database is not used. Password login is unchanged.

`vercel.json` also registers a weekly cron, Sunday 22:00 UTC:

`GET /api/regime/improve`

It is denied unless the caller has a regime session, an allowlisted IP, or presents `CRON_SECRET`. The job walks three out-of-sample folds and reports information coefficient where the signal log has it, plus hit rate, Sharpe, max drawdown, and CAGR for each tunable rule and for the stop system versus SPY and a 60/40 mix of SPY and IEF. A parameter moves only when the candidate improves Sharpe, or ties Sharpe and improves Calmar, on at least 2 of the 3 folds. Full-sample return is not a reason to accept. One parameter change per rule per calendar month. Bounds: ATR k 1.5–4 step 0.5, risk percent 0.5–1% step 0.25%, momentum lookback 189–315 step 21, dip floor 5–15% step 5%, dip ceiling 15–30% step 5%, and the floor stays below the ceiling. Risk percent is scored on the unscaled path. Raising it is leverage, and that does not count as a better rule. The owner sets it. The 10% drawdown halt still blocks new entries whatever the aspiration says.

The Improvement panel shows the target (default 66% a year, labeled “Aspiration (Medallion gross ceiling 1988-2018) — not a forecast”), realised CAGR once the paper curve has 30 daily marks, the last backtested CAGR and max drawdown, the gap to the target, and which rules were promoted, demoted, or retired in the last seven days. A negative out-of-sample Sharpe is labeled demoted and is not given more risk. The target is not an input to the optimizer. Drawdown halt, the 0.5–1% risk band, the caps, and the out-of-sample acceptance rule stay fixed. The job never loosens those bounds to close the gap.

The owner session can save capital and the aspiration on the page (`POST /api/regime/settings`). The cron secret cannot.

## Scheduled refresh

`vercel.json` registers two crons. The daily one is 13:15 UTC:

`GET /api/regime/refresh`

`GET` is the cron. It accepts a regime session, an allowlisted IP, or `CRON_SECRET`. `POST` is the owner **Refresh now** button. The cron secret does not authorize `POST`. The button sends a CSRF token tied to the session cookie, and the route rejects a cross-site origin.

A refresh is saved only in Neon Postgres, in `regime_refresh`, together with the journal and the self-check when the mandatory feeds arrived. The write is one transaction. Attempt metadata goes to `regime_refresh_attempts` without prices, and rows past the newest 45 are deleted in that same transaction. This repo does not create the Neon project and does not put `REGIME_DATABASE_URL` into Vercel. The project `dark-credit-39672712` was provisioned empty. Apply `db/regime/001_durable_state.sql` with the direct connection before expecting a save. Without the variable, or if the tables are missing, or if Neon cannot be read, the page says so and does not fetch providers to fill the screen. Serverless disk and memory are not a snapshot. A file left in `/tmp` from an older deploy is ignored.

The saved record keeps the last attempt time, the last fully successful provider fetch, the last saved snapshot, and each feed’s period, fetch time, and error. Mandatory feeds are the Fed assets, the Treasury account, reverse repo, the 2-year yield, the policy rate, and the high-yield spread. If one of those fails, or is past its stale window, or the 13:15 UTC job is overdue, new buys stay off. Optional feeds can fail and the attempt is marked partial. A full success is every requested feed, saved. Each cron start, end, and failure writes one JSON log line with event `regime_refresh` and no prices or secrets. The weekly review is the Sunday job above.

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

Stale limits: daily series 10 days, weekly series 21 days, monthly CLI and semiconductor production 75 days. A September observation on those monthly series is the month being measured. The component card lists each leg’s period so a blended score is not labelled with only the oldest month. Only stale liquidity, policy, or credit forces the preservation budget.

Positioning is CFTC legacy futures-only non-commercial net / open interest for E-mini S&P (`13874A`), the 10-year note (`043602`), euro FX (`099741`), and WTI (`067651`), sign-flipped so a crowded long is risk-off. If that feed fails, the gap is shown and the weight is redistributed. VIX is not used as a stand-in.
