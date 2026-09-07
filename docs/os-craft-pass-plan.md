# `/os` first craft pass plan — calm institutional

**Status:** proposal · docs-first (no production CSS rewrite in this PR)  
**Tokens stub:** `docs/os-tokens-proposal.css` (proposal-only)  
**North star:** `docs/OS_VISUAL_NORTH_STAR.md`  
**As of:** 2026-09-07 (Melbourne)

## Goal
Move `/os` from “solid private desk” to **productize-ready now**: same chrome we would ship publicly — Artemis composure, cite-first, Show ≠ Act, Sense stances ≠ ranks.

## Current token baseline (`app/globals.css`)
Present but **sparse for a desk system**:

- Core: `--background`, `--foreground`, `--muted`, `--border`, `--surface`, accent + status
- Radius: sm/md/lg/xl (8–20px)
- Type scale vars declared; body uses system / Inter stack
- **Missing for craft:** spacing scale, elevation, hairline/strong border roles, tabular-num utility, OS-specific semantic stamps (show/act/sense), weather strip tokens, table density tokens

Tailwind maps a subset via `tailwind.config.ts` (`background`, `foreground`, `muted`, `border`, `surface`, `accent.*`, `status.*`, `rounded-os`).

---

## Design tokens (proposal)

### Color
| Token | Role | Direction |
|-------|------|-----------|
| `--background` | Canvas | Keep near `#08080f` (studio black) |
| `--surface` / `--surface-hover` | Panels | Keep translucent white; avoid flat admin grey |
| `--border` / `--border-strong` | Hairlines | Prefer hairline over heavy fills |
| `--foreground` / `--muted` / `--muted-foreground` | Type hierarchy | Typography-first; mute labels harder |
| `--accent` / `--accent-soft` / `--accent-muted` | Single brand accent | Minimal use — active nav, links, focus |
| `--status-ok\|warn\|danger\|neutral` | Risk / GATE / kill | Semantic only — never decorative rainbow |
| **New** `--os-show` / `--os-act` / `--os-sense` | Stamp colors | Quiet distinct hues or shared accent + stamp *language* (prefer language-first, color second) |
| **New** `--os-weather-bg` | Weather strip wash | Subtle, Glassnode-quiet |

### Type scale
| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Display (page H1) | 1.875–2.25rem | 800 | Tracking tight; already in `OsShell` |
| Section | 0.75rem | 700 | Uppercase + wide tracking (existing pattern) |
| Body | 0.875–1rem | 400–500 | Relaxed leading on narrative |
| Meta / stamp | 0.625–0.6875rem | 700 | Uppercase pills |
| **Tabular nums** | inherit | 600–700 | `font-variant-numeric: tabular-nums` + mono for scores/weights |

**Rules:** Display for page titles only. Section labels never shout color. Numbers in tables always tabular. No display font carnival.

### Spacing rhythm — **4px base / 8px major**
**Pick:** **4px base grid** with **8px major steps** (8, 16, 24, 32, 40, 48).

**Justify:** Existing padding already clusters on `p-5` (20), `py-3.5` (14), `gap-3`/`gap-4` (12/16). A 4px base lets us tighten table row density (DefiLlama) without breaking Artemis card breath (multiples of 8). Document as `--space-1`…`--space-12` → 4px increments.

### Radius
Keep current ladder; prefer `--radius-lg` (16) for panes, `--radius-md` (12) for table shells, `--radius-sm` (8) for chips. Avoid mixing xl everywhere — xl for empty states / hero cards only.

### Borders & elevation
| Level | Treatment |
|-------|-----------|
| 0 | Flat on canvas |
| 1 | `border` + `--surface` (default card) |
| 2 | `border-strong` + soft shadow `0 20px 50px rgba(0,0,0,.35)` on hover only |
| Weather | Hairline + slight wash; no heavy shadow |

No neon glow on idle chrome (active nav glow is a craft debt to soften in Phase 2).

---

## Typography rules (desk)
1. **Display** — page title in `OsShell` only.  
2. **Section** — uppercase micro labels for every panel.  
3. **Tabular nums** — scores, weights, %, GATE codes.  
4. **Narrative** — Signal regime / Conviction Why: proportional sans, muted, max-width ~42rem.  
5. **Stamps** — Show / Act / Sense / Paper / Vera-signed: language first, color second.

---

## Phased PR plan

### Phase 0 — Docs lock (this PR)
**Ship:** moodboard, component map, craft plan, QA bar, north star pointer, tokens proposal file.  
**Acceptance**
- [ ] North star one-liner + comp KEEP/DROP/STEAL present
- [ ] Component inventory matches `components/os/`
- [ ] QA includes productize-ready bar
- [ ] No production CSS rewrite required

**Hard laws:** Docs themselves encode Show≠Act, Sense≠ranks, cite-first, no meme/admin-grey.

---

### Phase 1 — Tokens first
**Ship:** Additive CSS vars from `docs/os-tokens-proposal.css` into `globals.css` + Tailwind extend (spacing, elevation, tabular utility). **No layout redesign.**  
**Acceptance**
- [ ] New vars unused or only additive utilities — zero visual regression on marketing site
- [ ] `/os` pages still compile; screenshots diff ≤ hairline
- [ ] Tabular-nums utility available for tables

**Hard laws checklist**
- [ ] Palette stays dark institutional (no meme neon)
- [ ] Status colors remain semantic-only
- [ ] No admin flat-grey surfaces introduced

---

### Phase 2 — Chrome
**Ship:** `OsShell` craft (quieter active nav, optional weather slot), `ShowActStamp`, Sense/Act/Paper pills consistency, soften radial wash if it feels SaaS.  
**Acceptance**
- [ ] Private OS still clearly private — but chrome looks public-grade
- [ ] Show≠Act stamp reusable on Conviction + Home meta
- [ ] Empty states unchanged or improved, never shabbier

**Hard laws checklist**
- [ ] Show ≠ Act visually (banner + stamp language)
- [ ] Sense OW/N/UW never styled like portfolio ranks
- [ ] No meme crypto aesthetics

---

### Phase 3 — Tables
**Ship:** Shared `OsTable` used by Conviction / Book / Sources / Risk; density tokens; sticky header optional.  
**Acceptance**
- [ ] Row hover + header micro-labels consistent
- [ ] Tabular nums on all numeric columns
- [ ] WeightBar only on Act tables; ScoreBar only on Show
- [ ] Sources stance column still labeled Sense stance

**Hard laws checklist**
- [ ] Show ≠ Act density/stamp preserved across tables
- [ ] Sense stances ≠ ranks in Sources/Signal tables
- [ ] Cite-first: claim cells can open Sources

---

### Phase 4 — Weather strip
**Ship:** `WeatherStrip` on Home (regime / GATE / falsifiers / Show vs Act counts); optional compact variant on Signal.  
**Acceptance**
- [ ] Above-the-fold weather without metric soup
- [ ] Falsifiers narrative-only (no sizing language)
- [ ] Counts distinguish Show vs Act
- [ ] Links into Signal / Sources / Conviction

**Hard laws checklist**
- [ ] Cite-first from weather claims
- [ ] Sense content does not imply Act weights
- [ ] Empty/missing pack → premium waiting, not broken strip

---

## Definition of done (first craft arc)
Productize-ready bar in `docs/os-visual-qa.md` fully checkable on staging `/os` without a redesign when public packaging lands.

## Non-goals (this arc)
- Marketing site redesign  
- Live trading UI  
- Cloning DefiLlama IA  
- Rewriting production CSS in the docs PR  
