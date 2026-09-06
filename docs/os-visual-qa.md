# OS visual QA (Sense vs Act)

Tiny checklist before shipping OS Signal / Sources / Act surfaces.

## Signed-only Act surfaces

- [ ] Conviction, Book, and Risk show **Vera-signed** book lines only — no Sense theme OW/N/UW as investable ranks.
- [ ] Paper book weights / scores never appear on Signal or Sources.
- [ ] Home Command cards for Act stay Signed / Paper; Sense cards may be Live when a pack is present.

## Sense narrative (Signal + Sources)

- [ ] Theme badges read as **Sense stance** (OW / N / UW) — copy must not say “rank”, “tier”, or “weight”.
- [ ] Implications section is labeled **Sense implications** (not Act / orders / fills).
- [ ] Regime card and falsifiers are narrative-only; no sizing language.

## Empty-state density

- [ ] Signal and Sources empty only when `!hasSignalStatus` — skeleton density matches other OS empties.
- [ ] When pack is present, StatStrip + sections replace EmptyState; no double empty chrome.

## No theme-label ranks

- [ ] Theme cards: stance badge + “Sense stance” label; citation count is provenance, not a score.
- [ ] Sources brief-citation table: stance column is Sense stance, not a Decide tier.
