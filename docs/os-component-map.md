# `/os` component map — productize-ready

**Status:** inventory + proposal · docs-first  
**North star:** `docs/OS_VISUAL_NORTH_STAR.md` · **Moodboard:** `docs/os-moodboard.md`  
**As of:** 2026-09-07 (Melbourne)

## Inventory — `components/os/` (today)

| Component | Role today | Keep / rename / extend |
|-----------|------------|------------------------|
| `OsShell.tsx` | Private OS chrome: logo, Private OS + Paper pills, nav, title block, radial wash | **Keep** · craft: quieter active nav glow, optional weather slot |
| `OsCard.tsx` | Home command tiles (href, label, status, meta) | **Keep** · ensure Sense vs Act accent rules stay stamped |
| `StatStrip.tsx` | 2×2 / 4-up metric strip | **Keep** · candidate for Home weather strip composition |
| `EmptyState.tsx` | Premium empty + `signal` / `sources` skeletons | **Keep** · extend skeletons for conviction/book/risk if needed |
| `ScoreBar.tsx` | Show score bar + tabular num | **Keep** · Show-only; never on Sense stance |
| `WeightBar.tsx` | Act weight bar + `%` | **Keep** · Act/Book-only; never on Show or Signal |
| `ThemeBars.tsx` | Theme exposure vs cap | **Keep** · Book / Home Act context only |

**Not yet components (inline in pages):** Show≠Act banners, stance badges, dense tables, Risk tone pills, Sources figure buckets, Signal theme cards / falsifiers / implications.

---

## Proposed additions (name → purpose)

| Proposed | Purpose | Surfaces |
|----------|---------|----------|
| `WeatherStrip` | Regime / GATE / falsifier count / Show vs Act counts — Glassnode-style | Home (primary), optional Signal header |
| `ShowActStamp` | Shared banner + copy for Show ≠ Act | Conviction, Home Conviction card |
| `SenseStanceBadge` | OW / N / UW with “Sense stance” label — never rank | Signal, Sources |
| `OsTable` | Shared dense table chrome (header, row hover, tabular nums) | Conviction, Book, Sources, Risk |
| `CitationChip` / `OpenSourcesLink` | Cite-first entry to `/os/sources` | Signal hits, Conviction Why, Book rows (when linked) |
| `ProvenanceGroup` | Tegus-style figure / pack grouping | Sources |
| `RiskCeilingRow` | Ceiling key / label / tone pill | Risk (extract from page) |
| `Pane` / `SplitDesk` | Koyfin-style primary + secondary panes | Home, Book |

Rename guidance: prefer **descriptive OS names** over generic (`WeatherStrip` not `AlertBar`). Do not rename existing files until a craft PR; this map is the rename backlog.

---

## Surface maps

### 1. Home / Command (`app/os/page.tsx`)

| | |
|--|--|
| **Purpose** | Desk overview: paper book vitals, top Show lines, theme vs cap, deep links into Sense / Decide / Act / Risk / Sources. |
| **Density** | Artemis-calm. Sparse above the fold; cards breathe. No DefiLlama density here except future weather micro-stats. |
| **Primary components (existing)** | `OsShell`, `StatStrip`, `ScoreBar`, `ThemeBars`, `OsCard` |
| **Primary components (proposed)** | `WeatherStrip`, `SplitDesk` / `Pane`, `ShowActStamp` (on Conviction card meta), `OpenSourcesLink` |
| **Empty-state tone** | Rare (data usually present). If packs missing, Sense cards show Waiting — premium, not broken. |
| **Show ≠ Act** | Conviction card meta: `N Show · M book`. Never put `WeightBar` on top-conviction list. |
| **Sense ≠ ranks** | Signal card is Sense / Live|Waiting — no OW badges as ranks on Home. |
| **Citation entry** | Sources `OsCard` + future cite chips from weather falsifiers. |

---

### 2. Signal (`app/os/signal/page.tsx`)

| | |
|--|--|
| **Purpose** | Sense inbox: adopted weekly pack — GATE, regime, theme **stances**, falsifiers, Sense implications, recent cited hits. **Never sizes the book.** |
| **Density** | Messari hybrid: narrative sections + calm cards. Tables only for hit lists if needed. |
| **Primary (existing)** | `OsShell`, `StatStrip`, `EmptyState` (`skeleton="signal"`), inline theme cards / stance badges / implications |
| **Primary (proposed)** | `SenseStanceBadge`, `WeatherStrip` (optional compact), `CitationChip`, extract `ThemeStanceCard`, `FalsifierList`, `SenseImplications` |
| **Empty-state tone** | Premium waiting on Sam Signal — skeleton density matches other OS empties. |
| **Show ≠ Act** | No weights, no book scores. Implications labeled **Sense implications**. |
| **Sense ≠ ranks** | Stance badge + “Sense stance”; never rank / tier / weight copy. |
| **Citation entry** | Every hit / theme citation → Sources (deep link + count). |

---

### 3. Sources (`app/os/sources/page.tsx`)

| | |
|--|--|
| **Purpose** | Citation drawer / provenance for every investable claim. Sense ≠ Decide. |
| **Density** | DefiLlama-table density for citation grids; Tegus grouping by figure. |
| **Primary (existing)** | `OsShell`, `StatStrip`, `EmptyState` (`skeleton="sources"`), inline figure buckets + brief-citation table |
| **Primary (proposed)** | `OsTable`, `ProvenanceGroup`, `SenseStanceBadge` (stance column only), `CitationChip` |
| **Empty-state tone** | “Citation drawer standing by” — intentional corpus wait. |
| **Show ≠ Act** | No paper weights. Stance column = Sense stance, not Decide tier. |
| **Sense ≠ ranks** | Explicit on brief-citation table. |
| **Citation entry** | This *is* the entry point — bidirectional links from Signal / Conviction. |

---

### 4. Conviction Show (`app/os/conviction/page.tsx`)

| | |
|--|--|
| **Purpose** | Vera **line-signed** Show desk (TOP100) + separate scarce **book-signed** Act lines. Write-ups / Why. **Show never Act.** |
| **Density** | DefiLlama table for Show rows; calmer Act subsection (fewer rows, WeightBar allowed only there). |
| **Primary (existing)** | `OsShell`, `StatStrip`, `ScoreBar` (Show), `WeightBar` (book section only), inline tier/decision pills, Show≠Act copy |
| **Primary (proposed)** | `ShowActStamp`, `OsTable`, `OpenSourcesLink` on Why / flags, optional detail `Pane` |
| **Empty-state tone** | Should not empty if ledger present; if INSUFFICIENT mass, designed mute tiers (already). |
| **Show ≠ Act** | Banner + copy “Vera line-signed Show · not Act”; separate book section; no WeightBar on Show. |
| **Sense ≠ ranks** | Show tiers / Vera decisions are Decide language — not Sense OW/N/UW. Keep Sense badges off this page. |
| **Citation entry** | Why / retraction / flags → Sources; INSUFFICIENT_EVIDENCE as designed state. |

---

### 5. Book / Act (`app/os/book/page.tsx`)

| | |
|--|--|
| **Purpose** | Scarce Vera **book-signed** paper weights only. Live Act blocked until venue rail. |
| **Density** | Token Terminal + Koyfin: dense position table + theme exposure pane. |
| **Primary (existing)** | `OsShell`, `StatStrip`, `WeightBar`, `ThemeBars`, inline positions table |
| **Primary (proposed)** | `OsTable`, `SplitDesk`, `ShowActStamp` (inverse: “Act · not Show”), `OpenSourcesLink` when line cites exist |
| **Empty-state tone** | If no book lines: premium “awaiting Vera book-sign” (add EmptyState variant if needed). |
| **Show ≠ Act** | Only book-signed rows; `book_eligible` ≠ book-signed (QA). No Show TOP100 dump. |
| **Sense ≠ ranks** | No theme OW/N/UW. Theme bucket is exposure label only. |
| **Citation entry** | Optional per-line Sources; Risk ceilings cross-link. |

---

### 6. Risk (brief) (`app/os/risk/page.tsx`)

| | |
|--|--|
| **Purpose** | Paper ceilings, attestations, kill switch — Vera-signed envelope for unsupervised paper Act. |
| **Density** | Sparse, serious (Glassnode). Few rows; tone pills load-bearing. |
| **Primary (existing)** | `OsShell`, `StatStrip`, inline ceiling table + signed banner |
| **Primary (proposed)** | `RiskCeilingRow`, `OsTable`, attestation strip component |
| **Empty-state tone** | N/A when ceilings locked; if unsigned, explicit unsigned state (do not look like Live). |
| **Show ≠ Act** | Act-adjacent policy only — never Show scores. |
| **Sense ≠ ranks** | N/A — no Sense stances. |
| **Citation entry** | Link to book-sign attestation / methodology docs; not Sense cites. |

---

## Stamp checklist (every surface)

| Stamp | Home | Signal | Sources | Conviction | Book | Risk |
|-------|------|--------|---------|------------|------|------|
| Show ≠ Act chrome | ✓ card meta | ✓ no weights | ✓ no weights | ✓ banner | ✓ Act-only | ✓ Act policy |
| Sense stances ≠ ranks | ✓ | ✓ | ✓ | n/a (Decide) | ✓ | n/a |
| Cite-first entry | Sources card | hits / themes | self | Why / flags | optional | attestation |
| Premium empty | Waiting cards | EmptyState | EmptyState | mute INSUFFICIENT | future | unsigned |

## Implementation order (see craft plan)
1. Tokens / type / spacing docs (this PR)  
2. Chrome (`OsShell`, stamps, weather)  
3. Shared `OsTable`  
4. `WeatherStrip` on Home  
5. Extract Sense / Sources primitives without behavior change  
