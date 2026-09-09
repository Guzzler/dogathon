# design-consistency.md — DC-10, archived verbatim 2026-09-08

Snapshot taken in DC-10's own PR, the run it shipped, because that run's edits carried the
working doc to 473 lines. Two things are kept here: the design answer that had to be
settled before DC-10 could be built, and DC-10's original queue spec. Both are now the
longer of two tellings — the shipped code and the Ledger row are the shorter — which is the
README's 2026-09-02 rule. **Archives are append-only.** If something below turns out to be
wrong, correct `design-consistency.md` and say so there; one thing already was, and the
Ledger row for DC-10 names it (the dead-class count in the spec is over-reported by five).

---

## Settled — deleting dead CSS is not a repaint, and a harness cannot prove it (2026-09-08)

The design question this run opened, because DC-10 cannot be built without it: **the parked
list forbids a repaint, and this doc has twice recorded that moving rules costs new tokens
(DC-7 needed three). Is deleting a rule that resolves to a color a repaint? And how would you
prove a deletion changed nothing?**

**Deleting is not a repaint, and the distinction is not "does the line contain a hex".** A
repaint changes what a *rendered pixel* resolves to. Deleting a rule no element matches changes
nothing that resolves, so the parked list does not reach it — that list exists so a palette
change is a decision somebody made on purpose, not so dead bytes are immortal. DC-7 already
established the precedent by deleting 627 lines of `App.css` under the same parked list. The
design-token guard is consistent with this by construction: it flags *added* lines only, so a
pure deletion passes and should.

**Two rules make the difference between that and an accidental repaint**, and both come out of
DC-7's own experience:
1. **Delete whole rules, never edit surviving ones.** The moment a value moves, it is DC-7's
   case, the guard fires on the added line, and the fix is a token in `theme.css` — recorded as
   a finding, not done silently.
2. **`.pw-page` and `.pw-textarea` are defined in both `pawthway.css` and `theme.css`** at
   equal specificity, resolving by load order. They are live and they are not part of the
   documented `.btn` base layer. Do not touch either while deleting around them.

**Proving it: not with a harness.** DC-8's failure above is the reason. The proof that works is
DC-7's and it is entirely static — **diff the built stylesheet's selector set against a
baseline build of `main`, and require that every removed selector matches no `className` in
`web/src`.** No viewport, no iframe, no hand-written markup that can silently disagree with the
app. Two orderings matter and are easy to get backwards:

- **Remove the orphan modules first, in the same PR, then re-measure.** A component nothing
  imports keeps its CSS looking live. `Tips.tsx`, `Journal.tsx` and `hooks/useSwipe.ts` have
  zero importers, so every class only they render is currently counted as used.
- **Grep for constructed class names before believing any count.** `cp-plan-chip__kind--${row.kind}`
  and `shelter__row${" is-on"}` are live classes that no literal-string scan finds — the
  measurement for DC-10 below over-reported by this exact mechanism until it was corrected,
  which is DC-7's `app`/`badge` trap in a new costume.

---

## DC-10's original queue entry

- **DC-10's original spec (2026-09-08) — delete the dead half of the two stylesheets DC-7 left
  alone, and the three modules nothing imports.** This is the cleanup DC-7 explicitly deferred
  ("what is still dead and deliberately untouched: `pawthway.css`'s own unused rules"), plus
  what re-measuring on 2026-09-08 found in `carePlan.css`. Read the settled section above
  first — it is the spec for *how*, and both its orderings are load-bearing.
  - **Measured, prefix-aware, on 2026-09-08** (the script must count
    `` `cp-plan-chip__kind--${row.kind}` ``-style constructed names as live, or it over-reports):
    `pawthway.css` **41 of 61 classes dead**, `carePlan.css` **67 of 204**, `theme.css` **19 of
    221** — and the `theme.css` figure is mostly false positives (`is-on`, `is-active`,
    `has-error`, `leaflet-*`), so treat that file as **out of scope** and verify anything you
    do touch there one class at a time.
  - **`pawthway.css`'s dead set is one coherent generation, not scattered drift**: an older
    markup era superseded by `theme.css` — `agent-panel*` (6), `swipe-card*` (5),
    `care-log-*` (7), `checklist*` (5), `onboarding-*` (5), `pw-nav*` (8), plus `pw-grid`,
    `pw-hint`, `pw-main`, `badge--soft`, `hub-step--active`. The live twenty are what the
    `.pw-page` screens and the `.btn` base layer still need. **Do not touch `.btn`,
    `.btn--primary`, `.btn--ghost` or the 520px `.btn{width:100%}` rule** — they are the
    documented base layer DC-7 moved here on purpose, and `.pw-page`/`.pw-textarea` are the
    cross-file pair the settled section says to leave alone.
  - **`carePlan.css`'s dead set is whole subsystems**, which is what makes it worth a `[large]`
    run rather than a nibble: `cp-schedule*` (~20), `cp-event*` (11), `cp-log-item*` (8),
    `cp-plan-chip` box variants, `cp-topbar*`, `cp-tabs*`, `cp-avatar`, `cp-hub__row`,
    `cp-demo-panel`/`cp-demo-hint`, `cp-emergency-banner*`, `cp-check*`, `cp-select`,
    `cp-week--current`/`--dim`/`--passed`. **Five of these carry the 1024px media-query blocks
    DC-8 re-homed a day earlier** (`cp-topbar`, `cp-topbar__title`, `cp-avatar`, `cp-tabs`,
    `cp-schedule-block`); delete the blocks with the rules and say so in the ledger row rather
    than quietly reverting a day-old PR.
  - **Three orphan modules, deleted first so the re-measure is honest**:
    `web/src/phases/careplan/Tips.tsx` (103), `web/src/phases/careplan/Journal.tsx` (103),
    `web/src/hooks/useSwipe.ts` (37) — zero importers each, checked against every `.ts`/`.tsx`
    under `web/src`. `Timeline.tsx` stays: `Hub.tsx` imports `WeightChart` from it. Its
    second export, `Timeline`, is unused — removing just that export is in scope, deleting the
    file is not. Re-run the class measurement **after** these three are gone; expect the dead
    count to rise, and use the new number.
  - **Verify the way DC-7 did, not the way DC-8 did.** Build this branch and a baseline build
    of `main`, diff the built stylesheet's selector sets, and require **N selectors removed, 0
    added**, with every removed selector matching no `className` anywhere in `web/src` after
    the orphan deletions. Record the built-CSS size before and after. No harness, no iframes —
    the settled section says why. `build` / `test` / `lint` green with no new warnings.
  - Out of scope, deliberately: retokenising `carePlan.css`'s 115 color literals (parked), any
    value change to a surviving rule, and `theme.css` beyond the one-at-a-time check above.
