# Macro Regime Engine (phase 1)

Owner-only page at `/private/regime`. It scores liquidity, policy path, credit, the US−AU growth differential, and CFTC positioning, then maps the regime to a risk budget. It is an educational research tool, not financial advice, and it is not linked from the public nav, the OS nav, or the sitemap.

The access gate reuses the existing Supabase magic-link session and the deny-by-default middleware used by `/os` and `/drafts`. The allowlists are separate, so an email that can open the OS does not automatically open this page.

## Required environment variables

Set these in Vercel (Production and Preview). Do not commit values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `REGIME_OWNER_EMAILS` | Yes, for sign-in access | Comma-separated owner emails. Only these signed-in Supabase users can open the page. Example shape: `you@example.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes, for sign-in access | Already used by the site. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes, for sign-in access | Already used by the site. |
| `FRED_API_KEY` | Yes, for live scores | Free key from https://fred.stlouisfed.org/docs/api/api_key.html |
| `CRON_SECRET` | Yes, for the scheduled refresh | Long random string. Vercel sends it as `Authorization: Bearer $CRON_SECRET` on the cron request. |
| `REGIME_ALLOWED_IPS` | No | Optional comma-separated IPs that can open the page without a session. This is **not** `ALLOWED_IPS`. Leave it unset to require the owner email. |

If `REGIME_OWNER_EMAILS` is empty and `REGIME_ALLOWED_IPS` does not match, every request is a 404. That is the default.

## Scheduled refresh

`vercel.json` registers a daily cron at 13:15 UTC:

`GET /api/regime/refresh`

The route is denied unless the caller is an owner or presents `CRON_SECRET`. The snapshot is cached for one hour (`regime-snapshot` tag). The cron drops that tag and rebuilds. FRED and CFTC calls themselves are not cached.

Hobby Vercel accounts only allow a cron that runs once per day. This schedule is once per day so it can be deployed without a plan change. This repo does not change the Vercel project settings.

## Verify it is inaccessible when signed out

Against a deployed environment where `REGIME_OWNER_EMAILS` is set:

```bash
# Signed out. Expect a redirect (307) to /login?next=%2Fprivate%2Fregime
# The body must not contain scores. A signed-in email that is not on
# REGIME_OWNER_EMAILS gets 404 instead of the redirect.
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

A signed-in account that is not in `REGIME_OWNER_EMAILS` receives 404, not the dashboard.

Locally, with the dev server:

```bash
REGIME_OWNER_EMAILS=owner@example.com \
REGIME_ALLOWED_IPS=203.0.113.8 \
CRON_SECRET=local-only \
FRED_API_KEY=... \
npm run dev
```

```bash
curl -sI http://localhost:3000/private/regime
# 302

curl -sI -H 'x-forwarded-for: 203.0.113.8' http://localhost:3000/private/regime
# 200

curl -sI http://localhost:3000/api/regime/refresh
# 404

curl -sI -H 'Authorization: Bearer local-only' http://localhost:3000/api/regime/refresh
# 200
```

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
