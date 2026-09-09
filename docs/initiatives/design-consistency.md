# Design consistency

This doc exists because of a specific incident, not a hypothetical one.

## The precedent

PR #11 (2026-08-23, `eesha-color-scheme` → `main`) repainted the entire
palette — `theme.css`'s `:root` tokens, `brand.ts`'s `pawthwayTheme.palette`,
plus every place a color had been hardcoded as a literal instead of a
`var()` reference (`App.css`, `pawthway.css`, `carePlan.css`, one chip class
that "ignored the palette entirely") — from cream/coral to a charcoal-blue
/verdigris/tuscan-sun scheme, bundled into the same PR as an unrelated
feature (the demo-mode intro screen). The very next commit,
`90f2449 Revert color scheme changes`, undid all five files' worth of it and
kept only the intro screen. Nobody's fault — the author caught it herself —
but nothing in CI or the repo would have caught it if she hadn't, because
there is no automated signal that a PR touched the token files at all, let
alone changed what they resolve to. CI (PR #8) checks build/typecheck/lint/
tests; none of those know what a "correct" color is.

**The goal here is not zero visual changes.** It's that a repaint is a
decision someone made on purpose and can see in the diff, not a side effect
of one PR that also happened to be doing something else — and that a
contributor mid-feature gets told *before* merge, not after, that they've
touched the token surface.

## What's actually canonical right now

- **`web/src/theme.css`** `:root` — cream/coral/sage/butter palette,
  Fraunces + Nunito. Loads after `App.css`/`pawthway.css`, so its tokens
  win (`CLAUDE.md`, "Mobile shell and design system").
- **`web/src/brand.ts`** `pawthwayTheme` — the only theme object actually
  wired in (`Layout.tsx` calls `themeVars(pawthwayTheme)`). `brand.ts` also
  exports a second theme, `sidekickTheme` (leftover from the project's name
  before it was Pawthway) — **unused, and a trap**: it's the kind of thing
  a "let's try a new look" pass could get pointed at by mistake since it's
  sitting right next to the real one with a full matching shape.
- **The frame is a token, not a constant — since DC-5 (2026-09-05, PR #65).**
  `.shell > .phone` with a bottom tab bar (`Layout.tsx`) still centres the
  journey and still becomes a rounded floating phone over a gradient at
  `min-width:640px`, but its width now comes from `:root`'s `--frame-w` /
  `--content-w` / `--gutter` (`theme.css:24-26`), which step to 760/560 at
  1024px and 960/620 at 1440px (`theme.css:874-891`). **Change a width there,
  not in a rule.** The reading column is centred by
  `padding-inline: max(var(--gutter), calc((100% - var(--content-w)) / 2))`, so
  no screen's markup knows it is on a wide viewport. Screens that own their full
  height hide the tab bar (`FULL_BLEED` in `Layout.tsx`). The phone composition
  is still the one that works and the one most fosters will use; it is no longer
  the only one.
- **Both sides are device-agnostic (Sharang, 2026-08-26).** Pawthway should be
  a genuinely good phone app *and* a genuinely good web app, on both sides of
  the product. This unparks the `.shell`/`.phone` restructure that the "what's
  parked" section below had reserved for exactly this decision. Two
  consequences, deliberately split so neither blocks the other:
  - The **shelter side** is built responsive from the start and does not live
    inside the phone frame at all — it's desk-shaped work. Specified in
    `real-data-and-shelters.md`'s RS-2/RS-5/RS-6.
  - The **foster side** stays as-is until DC-5 below. Letting it breathe on a
    wide screen means the narrow composition earns more room, not that it
    gets redesigned desktop-first — the phone layout is the one that works
    today and the one most fosters will use.
- **The chat system** (`AgentChatPanel.tsx` + `theme.css`'s `.chat*`/`.msg*`
  /`.activity*`/`.approve*` rules) is the newest and most complete
  sub-system: instant-not-smooth auto-scroll with position-based pin
  detection, a hand-rolled markdown renderer instead of a library, typed
  error states with retry, per-surface activity verbosity. Any future
  chat-like or streaming UI should extend this pattern rather than invent
  a parallel one — it already solved the scroll-pinning and error-taxonomy
  problems once.
- **Three authored stylesheets, not two — corrected 2026-09-07.** This bullet said "two"
  from the day DC-7 shipped until it was measured again, and it was wrong on the day it was
  written. `App.tsx` imports `pawthway.css` (544) then `theme.css` (922) and `main.tsx`
  imports `index.css` (29) — but **`web/src/phases/careplan/carePlan.css` is 1850 lines**,
  larger than the other three combined, and is imported from `CarePlanView.tsx:30`. DC-7's
  measurement enumerated *`App.tsx`'s import lines* rather than the import *graph*, so the
  biggest stylesheet in the repo was never in the sample. The load-order half of the bullet is
  still exactly right: the `.btn` base layer sits at the top of `pawthway.css` precisely so
  `theme.css`'s `.screen .btn` / `.phone-body .btn--ghost` / `.sharesheet .btn` /
  `.shelter .btn` can override it at equal-or-higher specificity — putting a bare `.btn` in
  `theme.css` instead is the collision PR #60 paid for. Both files carry a header comment
  saying so, and CI prints a **non-failing** notice on two things — a changed import order in
  `App.tsx`, and (since DC-9, 2026-09-07) an added or removed local `.css` import anywhere
  under `web/src/**/*.tsx`, which is the blind spot that let the fourth stylesheet arrive
  unremarked. `carePlan.css` shares the app's geometry as of DC-8 and carries its own header
  comment saying which breakpoints and which width token to use.
- **No dark mode anywhere.** Zero `prefers-color-scheme` references in any
  CSS file. Not an oversight to silently fix — just worth knowing before
  proposing token changes that assume one exists.
- **Roughly half of the CSS that ships is dead — measured 2026-09-08.** Prefix-aware count of
  every class selector against every `className` under `web/src`: `pawthway.css` **41 of 61
  classes unreferenced**, `carePlan.css` **67 of 204**, `theme.css` 19 of 221 (mostly false
  positives — `is-on`, `leaflet-*`). Three modules have zero importers: `careplan/Tips.tsx`,
  `careplan/Journal.tsx`, `hooks/useSwipe.ts`. Nothing is broken by it, but it is why DC-8
  spent a third of its run re-homing media queries for markup that does not exist. DC-10 is
  the pass; the two settled sections below are the method.

## Settled — `App.css` is gone (2026-09-06, PR #67); compressed 2026-09-07

DC-7 deleted `App.css` (627 lines, three live classes), `Sidebar.tsx` and `Checklist.tsx`,
and moved the `.btn` base layer to the top of `pawthway.css` with header comments naming what
depends on the load order. Measurement verbatim in
[`archive/design-consistency-dc7-2026-09-07.md`](archive/design-consistency-dc7-2026-09-07.md);
the Ledger row is what shipped. **One line of that snapshot is wrong and is corrected above:**
it calls the app "two stylesheets", which it was not — the measurement never looked past
`App.tsx`.

## Settled — a phase may keep its own stylesheet (2026-09-07); compressed 2026-09-08

`carePlan.css` stays its own file rather than being folded into `theme.css` the way `App.css`
was folded into `pawthway.css`: all 204 of its classes are `cp-`-prefixed, it contributes
**zero** cross-file collisions, and DC-7's lesson was that the hazard is *shared names*, not
*separate files*. What it did not share was the app's geometry, and DC-8 (PR #69) gave it that.
Full text, verbatim, in
[`archive/design-consistency-dc8-2026-09-08.md`](archive/design-consistency-dc8-2026-09-08.md);
the Ledger row is the account of what shipped. Two facts from that measurement outlive it and
are restated nowhere else:

- **`carePlan.css` is on a second token vocabulary.** Its colors come from the `--color-*` set
  `Layout.tsx` injects at runtime via `themeVars(pawthwayTheme)` (`brand.ts`, 10 keys), while
  the rest of the app reads `theme.css`'s `:root` names (`--ink`, `--line`, `--shadow`,
  `--r-sm`). Both resolve; nothing is broken. A future repaint has to know there are two places
  a color can come from — the PR #11 hazard in slow motion.
- **It carries ~115 hardcoded color literals** (42 hex, 73 `rgba(`) against 218 `var()` uses,
  including four near-identical creams and a purple (`#5a3fa0`, `#7f5fbf`) outside the palette.
  They **predate DC-1's guard**, which only flags *added* lines, so CI has been correct and
  silent throughout. Not a repaint to schedule — a number to know before anyone proposes one.

**And one claim in it was wrong, found by re-measuring on 2026-09-08.** The section above
named `.cp-hub__row` and `.cp-schedule-block` as the screens going two-up inside a 430px
frame, and DC-8 re-homed six media-query blocks onto the frame's 1024px step. **Four of those
six target classes no component renders** — `.cp-topbar`, `.cp-topbar__title` + `.cp-avatar`,
`.cp-tabs`, `.cp-schedule-block` — as does the `.cp-hub__row` auto-fit rewrite. Grepping
`web/src/**/*.tsx` for any of the five returns nothing; `Hub.tsx` renders `cp-hub` and
`cp-quick-row`, and there is no Care Plan topbar or tab strip in the component tree at all.
DC-8's live effect was real and load-bearing — `.cp-stage` went 283px → 560px, `.cp-main`'s
padding, `.cp-emergency-actions`' auto-fit — but a third of the run was spent rearranging rules
for markup that does not exist. **The harness is why**: DC-8 measured against a hand-built
harness "of the real class structure", and a harness containing dead classes reports geometry
for them exactly as convincingly as for live ones. That is the third consecutive run in which
re-measuring corrected the previous run's measurement, and the first in which the *method*, not
the sample, was the fault. The consequence is DC-10 below.

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

## Task queue

- **DC-10 `[large]` (2026-09-08) — delete the dead half of the two stylesheets DC-7 left
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

- **DC-4 — the exempt-file notice; re-confirmed open and grounded 2026-09-08.** `ci.yml`'s
  `frontend` job still has exactly two guard steps ("Design token guard", "Stylesheet order
  notice"); neither says anything when `web/src/theme.css` or `web/src/brand.ts` is edited, so
  a wholesale repaint — PR #11, the incident this doc exists for — still passes CI silently.
  Full spec below under the original entry; it is small enough to ride on DC-10 if the same
  run has room, and DC-9 shipping as DC-8's rider is the precedent.

- **DC-8 `[large]` (with DC-9) — shipped 2026-09-07 (PR #69); the Ledger row is the full
  account.** Care Plan's breakpoints step with the frame and `.cp-stage` caps at `--content-w`
  (283px → 560px, the defect the spec had not known about); `ci.yml`'s notice now watches
  every `.tsx` for an added or removed local `.css` import. **What the spec got wrong is
  recorded in the settled section above, not here** — four of its six re-homed blocks target
  markup that does not exist, and the harness it verified against could not have told it so.

- **DC-7 `[large]` — shipped 2026-09-06 (PR #67); the Ledger row is the full account.**
  `App.css` is gone, the `.btn` base layer lives at the top of `pawthway.css`, and the two
  header comments plus a non-failing CI notice say what the load order is doing. The spec was
  right about all three of its measured claims and wrong about nothing; what it did not
  anticipate is in the ledger row.

- **DC-2 — shipped 2026-09-05 (PR #65) as a rider on DC-5.** `sidekickTheme` is gone from
  `brand.ts`, replaced by a comment naming the trap. The rider convention worked on its first
  use: a one-line item that had lost five runs in a row shipped without costing one.

- **DC-3 — CLOSED 2026-08-28.** The guard had never once evaluated a diff (depth-1 checkout,
  no merge base, `|| true` failing open); DC-6 fixed both, verified from real Actions runs.
  Diagnosis in [`archive/design-consistency-dc3-2026-09-07.md`](archive/design-consistency-dc3-2026-09-07.md).
- **DC-4 — the original spec (2026-08-26; ungated 2026-08-28); the open entry is at the top of
  this queue.** PR #11's damage was spread across five files, so DC-1's stray-literal check
  would have caught *part* of it — the `:root` token rewrite and the `pawthwayTheme.palette`
  rewrite, which were the actual repaint, not at all. Fix the **reporting** half, not the
  failing half: when a PR's diff touches `web/src/theme.css` or `web/src/brand.ts`, emit a
  `::warning::` plus a `$GITHUB_STEP_SUMMARY` block naming the files and showing the changed
  token lines. It must **not** `exit 1` — editing the palette on purpose is allowed, and this
  doc's goal is that a repaint be *visible in review*, not blocked. Add it as a step in
  `ci.yml`'s `frontend` job beside "Design token guard", reusing the same `origin/main...HEAD`
  diff, which DC-6 made resolve. Verify on two throwaway commits the way DC-1 was: a
  `theme.css` `:root` edit produces the warning and a **green** job; a PR touching neither
  exempt file produces no warning at all.
- **DC-5 `[large]` — shipped 2026-09-05 (PR #65); the Ledger row is the full account.** The
  frame widens and the two screens that suffered from the cap use the room. This doc has now
  held the repo's `[large]` slot for four consecutive runs (DC-5, DC-7, DC-8, DC-10).

## What's parked

No new color palette, no new font pairing, no dark mode — none of these are
rejected forever, they're just not queue items until someone (Sharang, in a
review of this doc, or a design pass explicitly commissioned as its own
initiative) decides one is worth doing on purpose. `plan` should not propose
them from its own judgment about what looks nicer.

**Added 2026-09-07: retokenising `carePlan.css`'s ~115 color literals is parked too.** The
number is measured and recorded in the settled section above (42 hex, 73 `rgba(`, against 218
`var()` uses, including four near-identical creams and a purple outside the palette), and DC-8
is explicitly scoped to exclude it. Replacing 115 literals is a repaint by volume even when
every resolved value is preserved byte-for-byte — DC-7 needed three new tokens to move *six*
rules and recorded them as a finding rather than a chore. It stops being parked when someone
commissions a palette pass on purpose, which is the same bar as the paragraph above.

**No longer parked:** restructuring `.shell`/`.phone`/`.tabbar`. Sharang made
that call on 2026-08-26 — see the device-agnostic decision above; DC-5 is the
queued work.

## Ledger

- **2026-08-25 — DC-1 — PR #25; 2026-08-28 — DC-6 — PR #32; 2026-09-04 — the shelter-side
  pass — PR #60. Compressed 2026-09-08; verbatim in
  [`archive/design-consistency-ledger-2026-09-08.md`](archive/design-consistency-ledger-2026-09-08.md).**
  DC-1 added the design-token guard to `ci.yml`'s `frontend` job (git `:(glob)`/`:(exclude)`
  pathspec magic; a bare `**` matches nothing under this git version) and verified it only
  locally, which is the whole reason DC-3 existed. DC-6 fixed it for real — `fetch-depth: 0`
  so `origin/main...HEAD` has a merge base, and `|| true` narrowed to the final `grep` so a
  genuine git failure is no longer swallowed — verified from two real Actions runs, one red
  one green. PR #60 stopped the shelter side borrowing `.screen .btn`, which at `width:100%`
  had starved `.shelter__dog-main` to **0px**. Its two traps are live constraints, so they
  stay here: `.shelter .btn` and `.screen .btn` have equal specificity and the shelter rules
  win only by sitting **below** them in `theme.css` — do not reorder that file; and
  `align-self:center` on a shared button rule reads fine in a row and silently centres a
  button mid-page in a column.
- 2026-09-05 — DC-5 (with DC-2 as its rider) — PR #65 — **The foster journey stops being a
  430px column on a 27" monitor.** Three `:root` tokens (`--frame-w`, `--content-w`,
  `--gutter`) carry the widths that were hardcoded; the reading column is centred with
  **padding, not a wrapper**, so no screen's markup learns it is on a wide viewport. `SavedView`
  got the second column (there is no "discovery grid" — Discovery is a swipe deck and a map);
  `.sharesheet` caps at `min(var(--frame-w),480px)` because a sheet stops reading as a sheet
  past ~500px; `sidekickTheme` is gone from `brand.ts` (DC-2). **The trap worth keeping:**
  `margin-inline:auto` on a column-flex child cancels the cross-axis stretch, so `.deck__stack`
  collapsed to **31px** with `max-width` alone — `width:100%` is the fix, and DC-8 paid for the
  same trap a second time. Verified by measuring computed boxes at 390/768/1024/1440 against a
  baseline build of `main`, which was byte-identical at 390 and 768. Full row, verbatim, in
  [`archive/design-consistency-ledger-2026-09-08.md`](archive/design-consistency-ledger-2026-09-08.md).
- 2026-09-06 — DC-7 — PR #67 — **The app is one stylesheet fewer, and the order that decides
  live screens is written down.** `web/src/App.css` (627 lines), `components/Sidebar.tsx` (51)
  and `components/Checklist.tsx` (31) are deleted — **709 lines out of the repo**, against 78
  added, and the built stylesheet drops from 94.4kB to 86.2kB. The measurement was re-run
  rather than trusted and it held: `App.css` had exactly five live classes, not the seven a
  naive scan reports (`app` and `badge` are JS identifiers inside `className={...}`
  expressions — `app.id`, `badge.tone` — which is worth knowing before anyone re-measures).
  `.btn`, `.btn--primary`, `.btn--ghost`, `.btn:hover:not(:disabled)`, `.btn:disabled` and the
  520px `.btn{width:100%}` rule moved verbatim to the **top of `pawthway.css`**, not into
  `theme.css`, for the reason the spec gave.
  **Proof, not eyeballing.** The built CSS was diffed rule-by-rule against a baseline build of
  `main`: **66 selectors removed, 0 added**, and every removed one is absent from every
  `className` in `web/src`. Four selectors changed and each is accounted for — `.chat` gained
  `min-width:0` (the one property `App.css` was silently supplying to the live Match chat) and
  otherwise resolves to `theme.css`'s rule exactly as it already did; `.chat__scroll` lost a
  copy that was already being overridden, *including* the `padding:18px` inside `App.css`'s
  780px media query, which never won because a media query adds no specificity;
  `.btn--primary`/`.btn--ghost` differ only by `var()` indirection.
  **The one thing the spec did not anticipate: moving the rules would have failed CI.** The
  design-token guard flags an *added* line containing `rgba(` in any file but `theme.css` and
  `brand.ts`, and it cannot tell a move from new drift. Per this doc's standing rule that a
  guard hit means use a token, the three literals became `--btn-primary-shadow`,
  `--btn-ghost-bg` and `--btn-ghost-line` in `theme.css`'s `:root`. Values are byte-identical,
  so this is not the repaint the parked list forbids — but it *is* three new tokens, recorded
  here rather than buried.
  **The notice is a third step, not an extension of DC-4's** — DC-4 has not landed, so there
  was nothing to extend. It greps `App.tsx`'s diff for `import "./*.css"` lines and, on a hit,
  emits a `::warning::` plus a `$GITHUB_STEP_SUMMARY` block; it never exits non-zero. It fires
  on this PR, which is correct — this PR removed an import.
  **What is still dead and deliberately untouched:** `pawthway.css`'s own unused rules, and six
  `className` literals that match no selector anywhere (`cp-journal`, `cp-timeline`, `cp-tips`,
  `cp-tip-group`, `cp-feed-item__tag--ask`, `shelter__home`). All six predate this item and sit
  in files it had no business opening; they are a note for plan, not a bonus fix.
  `build` / `test` (98) / `lint` green, 9 pre-existing warnings on both this branch and `main`.

- 2026-09-07 — DC-8 (with DC-9 as its rider) — PR #69 — **Care Plan stops laying out against
  a viewport it doesn't occupy.** All nine of `carePlan.css`'s media queries were re-homed or
  removed: the four chrome tweaks (`.cp-topbar`, `.cp-topbar__title`/`.cp-avatar`, `.cp-tabs`,
  `.cp-main`) and `.cp-schedule-block`'s 64→78px time gutter moved onto the frame's own first
  step at **1024px**, because each is a "roomier frame gets roomier chrome" tweak and not a
  reflow; `.cp-hub__row` and `.cp-emergency-actions` lost their breakpoints entirely and became
  `repeat(auto-fit,minmax(240px,1fr))` and `minmax(230px,1fr)`, because both were only ever
  asking whether two cards fit and the viewport was the wrong thing to ask. `.cp-stage` now
  carries `max-width:var(--content-w)` unconditionally — `--content-w` equals `--frame-w` below
  1024, so one declaration serves both cases and there is no third place a width lives.
  **The screen was worse than the spec knew, and only measuring found it.** DC-8 was written to
  fix two-up-inside-430px at tablet widths, which was real and is measured below. What nobody had
  noticed is that `.cp-stage--solo`'s old `max-width:780px;margin:0 auto` is **DC-5's exact trap
  a second time**: auto inline margins on a column-flex child cancel the cross-axis stretch, so
  from viewport 1024px up the entire Care Plan screen rendered **283px wide** inside a 762px
  frame — narrower than the phone. It is 560px now, and `width:100%` on `.cp-stage` is what
  fixes it, with a comment on the line saying so. That is twice this trap has been paid for; it
  is worth treating `margin-inline:auto` inside `.phone-body` as requiring `width:100%` by rule.
  **The 900px grid was dead, confirmed not assumed.** `.cp-stage:not(--solo):not(--empty)` could
  never match: `CarePlanView` renders exactly three stages (`:183`, `:188`, `:210`) and every one
  carries `--solo` or `--empty`. There is no `SHOW_DEMO_CONTROLS` identifier anywhere in
  `web/src`, so the flag its comment named is gone too. Deleted, with a comment recording why.
  The `.cp-demo-panel` rules it styled are equally dead and were **left alone** — they are not
  geometry and this item had no business widening into a cleanup.
  **Six dead classNames, not eight — the spec's own measurement was one-and-a-half wrong.**
  `cp-earlier--open`, `cp-feed-item__tag--ask`, `cp-journal`, `cp-timeline`, `cp-tip-group` (two
  sites) and `cp-tips` match no selector in any of the four stylesheets and are gone. The
  seventh, non-`cp-` `ask` in `JournalTips.tsx`, is **not a className at all** — it is a `Mode`
  string literal (`"note" | "photo" | "ask"`) and an entry `kind`. That is precisely the DC-7
  trap the spec warned about, arriving in the spec itself; the honest count of dead classNames
  the run started with was six. `cp-feed-item--ask` *is* live and was left.
  **Verified by measuring, not by eye**, the way DC-5 did and for the same reason: the built
  stylesheet from this branch and from a baseline build of `main`, both served against a
  harness of the real class structure (`.shell > .phone > .phone-body > .cp-stage--solo`), read
  at **390 / 768 / 1024 / 1440** with the real viewport resized rather than iframes.
  At **390** every measured box is identical before and after — frame 390, `.cp-stage` 390,
  `.cp-main` pad 14px, all three grids one column — which was the claim that mattered.
  At **768**: `.cp-hub__row` went from `195px 195px` to a single `402px`, and
  `.cp-emergency-actions` from `196px 196px` to `402px`, both inside a 430px frame — that is
  the defect, measured, and gone. At **1024**: `.cp-stage` **283px → 560px**; at **1440**:
  **283px → 620px**, both centred, both `--content-w` exactly. No horizontal scroll at any of
  the four, before or after.
  **DC-9 rides along.** The notice step now also diffs every `.tsx` under `web/src` for an
  added or removed local `.css` import and warns with the frame rules; the `App.tsx`-reorder
  branch is unchanged and still runs. Both branches are `::warning::` only — a phase-scoped
  stylesheet is allowed, and this doc's own conclusion is that `carePlan.css` should stay. The
  grep pair was exercised locally against synthetic diff lines (fires on `+import "./foo.css";`
  and `-import "../bar/baz.css"`, silent on `+import x from "./y";`) and is correctly silent on
  this PR, which changes no import line.
  `build` / `test` (98) / `lint` green, 9 pre-existing warnings and no new ones.
