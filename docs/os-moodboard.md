# `/os` annotated moodboard — productize-ready

**Status:** craft lock for Nora · docs-first (no production CSS rewrite in this PR)  
**Owner craft:** Nora · **North star:** `docs/OS_VISUAL_NORTH_STAR.md`  
**As of:** 2026-09-07 (Melbourne)

## One-line feel
**Private Messari × Token Terminal × Glassnode weather** — Artemis composure; DefiLlama density only for tables.

Private access · public-grade look. Privacy is an IP/access gate, never an excuse for admin-grey.

## Capture note
Public marketing / studio entry pages were fetched into the craft workspace (outside this git repo):

| Asset | Path (from monorepo root) | Notes |
|-------|---------------------------|-------|
| Artemis OG | `../craft-moodboard/artemis-og.jpg` | Public marketing OG |
| Token Terminal OG | `../craft-moodboard/token-terminal-og.png` | Public marketing OG |
| Glassnode Studio OG | `../craft-moodboard/glassnode-og.jpg` | Studio thumbnail |
| Koyfin OG | `../craft-moodboard/koyfin-og.png` | Marketing screenshot OG |
| HTML dumps | `../craft-moodboard/{artemis,token-terminal,messari,glassnode,defillama,koyfin,tegus}.html` | Structure refs only |
| Headless shot | `../craft-moodboard/artemis.png` | Partial; SPA chrome often login-walled |

**Login walls / SPA shells:** Messari, DefiLlama tables, Glassnode Studio desk, and Tegus library UIs do not yield faithful product screenshots without auth. Comps below are **KEEP / DROP / STEAL in prose** — no invented screenshots, no inventable numbers.

---

## Comp table (match north star)

| Comp | KEEP | DROP | STEAL (summary) |
|------|------|------|-----------------|
| **Artemis** | Calm chrome, comparable metrics, professional restraint, quiet dark | Chain-compare as hero, explorer-first IA | Composure + metric cards → Home / Signal |
| **Token Terminal** | Equity-style fundamentals framing, clean charts, sparse legend | Metric soup, wall of KPIs | Fundamentals frame + chart restraint → Conviction / Book |
| **Messari** | Research + data hybrid, profiles, events as context | Newsletter chrome as product shell | Research desk hybrid → Signal / Sources / Conviction write-ups |
| **Glassnode Studio** | Regime weather strip, serious dark studio, regime language | BTC monoculture, on-chain-only hero | Weather strip + studio gravity → Home Command |
| **DefiLlama** | Fast dense tables, scannable columns, sticky headers | Rainbow TVL explorer vibe, meme accents | Table density only → Conviction Show / Book / Sources |
| **Koyfin** | Portfolio + research split panes, institutional framing | Retail chart carnival, neon overlays | Split panes → Home (Show vs Act), Book + Risk |
| **Tegus** | Transcript → insight → name provenance | Call-library marketplace UX | Cite-first provenance → Sources / Signal hits |

---

## Annotated steals by comp

### 1. Artemis
**Feel:** Institutional calm; metrics that compare without shouting.

**Steal (3–6 concrete patterns)**
1. Quiet top chrome — logo + subtle status pills, not loud tabs.
2. Metric tiles with label / value / soft hint (comparable, not dashboard candy).
3. Generous vertical rhythm; cards breathe; one accent only.
4. Typography-first section headers (small caps / tracking) over icon soup.
5. Hover elevation that is almost invisible (border + 1px lift).
6. Neutral empty surfaces that still feel designed.

**Never-steal:** Chain-compare as the hero journey; multi-chain explorer IA; busy “protocol browser” chrome.

**Map → Passive Blocks:** Home Command StatStrip composure; Signal pack calm; OsShell restraint (tone down pill glow over time).

---

### 2. Token Terminal
**Feel:** Equity terminal for crypto fundamentals — clean, scarce series.

**Steal**
1. One primary chart / one primary table per section — not both fighting.
2. Equity-style column language (score, weight, instrument) over crypto slang.
3. Clean axis / legend treatment; monospace for numbers only.
4. Sparse filter chrome when needed; defaults do the work.
5. Dark panels with hairline borders (`--border`), not heavy cards stacked.

**Never-steal:** Metric soup; twenty sparklines; KPI walls that bury the decision.

**Map →:** Conviction Show score columns; Book weight table; Risk ceiling table.

---

### 3. Messari
**Feel:** Research desk that happens to have data — profiles + narrative + events.

**Steal**
1. Hybrid layout: narrative block beside (or above) structured facts.
2. Entity / theme “profile” framing for themes and names.
3. Event / as-of stamps as first-class chrome (research freshness).
4. Cite links treated as product, not footnotes.
5. Soft separation between editorial voice and desk data.

**Never-steal:** Newsletter masthead, subscribe CTAs, article-list as primary OS shell.

**Map →:** Signal regime + theme cards; Conviction write-up / Why column; Sources drawer tone.

---

### 4. Glassnode Studio
**Feel:** Serious dark studio; regime before noise.

**Steal**
1. **Weather strip** — compact regime / GATE / falsifier row above the fold.
2. Studio gravity: near-black canvas, muted labels, few accents.
3. Time / as-of as part of the weather, not buried in footer.
4. Status language that reads like a desk (GATE, regime) not a SaaS badge farm.
5. Dense-but-quiet secondary panes under the strip.

**Never-steal:** BTC-only monoculture; on-chain metric playground as the product identity.

**Map →:** Home Command weather (proposed); Signal StatStrip GATE / as-of; Risk “armed” banner tone.

---

### 5. DefiLlama
**Feel:** Table speed — scan, sort, move on.

**Steal (tables only)**
1. Dense row height with clear hover row wash.
2. Sticky / strong header row (uppercase micro labels).
3. Tabular nums right-aligned for weights / scores.
4. Minimal cell chrome — no pill-per-cell unless status is load-bearing.
5. Fast horizontal scroll with `min-w` tables (already on Book / Conviction).

**Never-steal:** Rainbow TVL charts; meme category colors; explorer carnival.

**Map →:** Conviction Show TOP100; Book positions; Sources brief-citation table.

---

### 6. Koyfin
**Feel:** Portfolio desk next to research — split, not stacked chaos.

**Steal**
1. Split panes: primary list / secondary context (e.g. Show summary | theme vs cap).
2. Portfolio framing for Act surfaces only (weights, cash, caps).
3. Research pane stays narrative — no accidental weight bars on Sense.
4. Calm toolbar density; institutional, not retail terminal skin.
5. Consistent pane radius + border so splits feel one product.

**Never-steal:** Retail chart carnival; rainbow overlays; watchlist gamification.

**Map →:** Home 3+2 split (Top conviction | Theme vs cap); Book positions | ThemeBars; future Conviction detail drawer.

---

### 7. Tegus
**Feel:** Transcript → insight → name — provenance is the product.

**Steal**
1. Citation as a first-class row type (figure, org, lane, URL, date).
2. Insight that always deep-links to Sources.
3. Grouping by figure / pack before theme noise.
4. Explicit “insufficient evidence” as a designed state (already in Conviction).
5. Stance / theme as labels on cites — never as investable ranks.

**Never-steal:** Marketplace / call-library browse UX; paywall gallery chrome.

**Map →:** Sources by-figure buckets; Signal recent hits → Sources; every investable claim entry point.

---

## Surface → steal cheat sheet

| Surface | Primary steals | Explicit anti-patterns |
|---------|----------------|------------------------|
| **Home / Command** | Glassnode weather + Artemis composure + Koyfin split | Metric soup; Act weights on Sense cards |
| **Signal** | Messari hybrid + Artemis cards + Tegus cite links | Rank / tier / weight language on OW/N/UW |
| **Sources** | Tegus provenance + DefiLlama table density | Marketplace browse; orphan cites |
| **Conviction Show** | Token Terminal framing + DefiLlama density + Messari Why | Looking like Book; weight bars on Show rows |
| **Book / Act** | Koyfin portfolio pane + Token Terminal weights | Sense stances as sizes; live-trading carnival |
| **Risk** | Glassnode seriousness + Artemis restraint | Admin grey forms; alarmist meme red |

---

## Hard laws (moodboard filter)
Apply before any steal ships:

1. **Show ≠ Act** — banner, density, stamp language differ.
2. **Sense OW/N/UW ≠ ranks** — stances, not portfolio tiers.
3. **Cite-first** — investable claim → Sources.
4. **Dark institutional** — minimal accents, type-first.
5. **No meme crypto / no admin-grey** without craft.
6. **Empty states premium** — intentional waiting, not broken UI.

## Non-goals
- Cloning any competitor’s IA.
- Public marketing redesign.
- Live trading UI chrome.
- Inventing screenshots or investable numbers for comps.
