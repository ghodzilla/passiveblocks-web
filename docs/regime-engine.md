# Macro Regime Engine (phase 1)

Owner-only page at `/private/regime`. It scores liquidity, policy path, credit, the US−AU growth differential, and CFTC positioning, then maps the regime to a risk budget. It is an educational research tool, not financial advice, and it is not linked from the public nav, the OS nav, or the sitemap.

`/private/regime` does not use Supabase. The owner signs in with a password at `/private/login`. `/os` and `/drafts` still use the Supabase magic-link login and `OS_ALLOWED_EMAILS` / `ALLOWED_IPS`. Those lists do not open this page.

## Required environment variables

Set these in Vercel (Production and Preview). Do not commit values. This change does not edit Vercel settings.

| Variable | Required | Purpose |
| --- | --- | --- |
| `REGIME_PASSWORD_HASH` | Yes, for password sign-in | scrypt hash of the owner password. See the command below. |
| `REGIME_SESSION_SECRET` | Yes, for password sign-in | HMAC key for the session cookie. At least 32 characters. `openssl rand -base64 32` |
| `FRED_API_KEY` | Yes, for live scores | Free key from https://fred.stlouisfed.org/docs/api/api_key.html |
| `CRON_SECRET` | Yes, for the scheduled refresh | Long random string. Vercel sends it as `Authorization: Bearer $CRON_SECRET` on the cron request. It does not unlock the HTML page. |
| `REGIME_ALLOWED_IPS` | No | Optional comma-separated IPs that can open the page without a password. This is **not** `ALLOWED_IPS`. Leave it unset to require the password. |
| `REGIME_WATCHLIST` | No | Comma-separated stock symbols that replace the default watchlist (US megacaps and a liquid ASX 20 slice). Example: `AAPL,BHP.AX`. Leave unset for the built-in list. An empty value shows no stocks. No price API key is required. |

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

## Scheduled refresh

`vercel.json` registers a daily cron at 13:15 UTC:

`GET /api/regime/refresh`

The route is denied unless the caller has a regime session, an allowlisted IP, or presents `CRON_SECRET`. The cron drops the `regime-snapshot` tag and rebuilds the regime snapshot and the price book.

Hobby Vercel accounts only allow a cron that runs once per day. This schedule is once per day so it can be deployed without a plan change. This repo does not change the Vercel project settings.

## Verify it is inaccessible when signed out

Against a deployed environment where `REGIME_PASSWORD_HASH` and `REGIME_SESSION_SECRET` are set:

```bash
# Signed out. Expect a redirect (307) to /private/login?next=%2Fprivate%2Fregime
# The body must not contain scores.
curl -sI https://www.passiveblocks.io/private/regime

# API never redirects. Expect 404 Not Found.
curl -sI https://www.passiveblocks.io/api/regime
curl -sI https://www.passiveblocks.io/api/regime/refresh

# Wrong or missing cron secret. Expect 404.
curl -sI -H "Authorization: Bearer wrong" https://www.passiveblocks.io/api/regime/refresh

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
```

The session cookie is `Secure`. `curl` against `http://` may not store it; send the `Cookie` header explicitly when replaying a session. Chrome treats `localhost` as a secure context and will store it.

Without `FRED_API_KEY` the page still renders for an authorised caller and tells them to do nothing / reduce risk. It does not invent market levels.

## Rule summary

Rules version `regime-v1`. Positive z is risk-on. Each component is a trailing z-score, winsorised at ±3. Base weights: liquidity 0.30, policy 0.20, credit 0.25, growth 0.15, positioning 0.10. Missing components are renormalised.

| Regime | Entry | Vol / max gross / max net |
| --- | --- | --- |
| Risk-On Liquidity Expansion | Composite ≥ 0.65 and liquidity z ≥ 0.10. Holds until composite < 0.25 or liquidity z < −0.25. | 12% / 150% / 100% |
| Transitional | Neither stress nor confirmed risk-on. | 6% / 80% / 50%, and the action is do nothing new |
| Tightening/Stress | Composite ≤ −0.75. Holds until composite > −0.35. | 4% / 40% / 25% |
| Crisis | Composite ≤ −1.75, or credit z ≤ −2 with composite ≤ −1.25. | 3% / 20% / 10% |

`|composite| < 0.35` is the no-edge band: do nothing. Stale or missing liquidity, policy, or credit forces the preservation budget (3% vol, 20% gross, 0 net) and the message “Do nothing / reduce risk”, even if the last label was risk-on.

Stale limits: daily series 10 days, weekly series 21 days, monthly CLI 75 days.

Positioning is CFTC legacy futures-only non-commercial net / open interest for E-mini S&P (`13874A`), the 10-year note (`043602`), euro FX (`099741`), and WTI (`067651`), sign-flipped so a crowded long is risk-off. If that feed fails, the gap is shown and the weight is redistributed. VIX is not used as a stand-in.
