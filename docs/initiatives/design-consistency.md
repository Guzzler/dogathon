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
- **That dead half is gone — DC-10, 2026-09-08 (PR #71).** `pawthway.css` 544 → 203 lines,
  `carePlan.css` 1863 → 1136, the three zero-importer modules (`careplan/Tips.tsx`,
  `careplan/Journal.tsx`, `hooks/useSwipe.ts`) deleted, and `Timeline.tsx`'s unused second
  export with them. The **built** stylesheet went 85,702 → 69,568 bytes, 824 → 671 selectors:
  **153 removed, 0 added**, every removed selector naming a class no `className` under
  `web/src` produces. What survives in those two files is live. `theme.css` was deliberately
  left alone — its 22 apparent dead classes are mostly false positives (`is-on`, `has-error`,
  `leaflet-*`) and it wants a one-at-a-time pass, not a sweep.
  - **Two rules are left knowingly unpruned**, because pruning them means editing a surviving
    line: `.cp-composer__textarea, .cp-composer__input` and its `:focus` twin are selector
    *lists* whose first half is live and second half dead. Deleting the dead half is a value
    edit, which DC-10's own first ordering rule forbids. They cost two unreachable selectors
    and are the honest place to stop.

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

**And one claim in it was wrong — found by re-measuring 2026-09-08, and resolved by DC-10 the
same day.** Five of the six media-query blocks DC-8 re-homed targeted classes no component
renders; DC-10 deleted them with their rules. The two that survive, `.cp-stage--solo` and
`.cp-main`, were the real effects, and `.cp-stage` going 283px → 560px was real and
load-bearing. **The harness is why DC-8 could not tell the difference**: it verified against a
hand-built page "of the real class structure", and a harness containing dead classes reports
geometry for them exactly as convincingly as for live ones. That is the lesson that outlives
both items, and it is now the third of four consecutive runs in which re-measuring corrected
the previous run's measurement — the first in which the *method*, not the sample, was at fault.
DC-10's Ledger row has the full list of what went.

## Settled — deleting dead CSS is not a repaint (2026-09-08); compressed the same run

The question DC-10 could not be built without: the parked list forbids a repaint, so is
deleting a rule that resolves to a color one? **No.** A repaint changes what a rendered pixel
resolves to; deleting a rule no element matches changes nothing that resolves, and DC-7 set the
precedent with `App.css`'s 627 lines. The token guard agrees by construction — it flags *added*
lines, so a pure deletion passes and should. Three constraints from it outlive the decision and
are restated nowhere else:

1. **Delete whole rules, never edit surviving ones.** A moved value is DC-7's case: the guard
   fires on the added line and the fix is a token, recorded as a finding rather than done
   quietly. This is why DC-10 left two mixed selector lists unpruned.
2. **`.pw-page` and `.pw-textarea` are defined in both `pawthway.css` and `theme.css`** at
   equal specificity, resolving by load order. Live, and not part of the documented `.btn` base
   layer. Don't touch either while deleting around them.
3. **Prove it statically, never with a harness** — diff the built stylesheet's selector set
   against a baseline build of `main` and require every removed selector to match no
   `className` in `web/src`. DC-8's harness is the reason: one containing dead classes reports
   geometry for them as convincingly as for live ones.

Full text, verbatim, in
[`archive/design-consistency-dc10-2026-09-08.md`](archive/design-consistency-dc10-2026-09-08.md),
which also holds DC-10's original spec. DC-10's Ledger row is the account of what shipped,
**including where that spec's own measurement was wrong.**

## Task queue

- **DC-10 `[large]` — shipped 2026-09-08 (PR #71); the Ledger row is the full account.** The
  two stylesheets are down to what the app renders, and the measurement the queue entry was
  written from was itself over-reported by five classes — see the row. Its original spec is
  archived verbatim alongside the design answer, since both orderings it turned on are now
  restated by the settled section above.

- **DC-4 — shipped 2026-09-08 (PR #71) as a rider on DC-10**, which is what its own entry
  invited and the DC-9-on-DC-8 precedent it cited. `ci.yml`'s `frontend` job now has three
  guard steps; the new one is **"Palette change notice"**. Verified on a throwaway commit the
  way DC-1 asked and DC-6 actually did — both cases, though locally rather than on a real
  Actions run. See the Ledger row for exactly what that does and does not prove.

- **This doc's queue is now empty of open items, and the repo's `[large]` slot is empty with
  it (2026-09-08, left for `dogathon-plan`).** DC-10 and DC-4 were the last two, so
  `design-consistency.md` — which had held the slot for four consecutive runs (DC-5, DC-7,
  DC-8, DC-10) — holds nothing. Across all three docs the only open item is **RS-4**, a
  workflow trigger that is small by construction, so this is not an empty-queue audit case
  yet; it is one refill away from being one. Two leads for whoever queues next, both from this
  run rather than invented:
  - **`theme.css` has never had the pass the other two just had.** DC-10 ruled it out of scope
    on purpose: 22 of its 224 classes look unreferenced but most are false positives
    (`is-on`, `is-active`, `has-error`, `leaflet-*` come from libraries or from constructed
    names), and a handful do not — `shelter__form`, `shelter__form-row`, `shelter__label`,
    `shelter__error`, `signin__google`, `signin__note`, `signin__fine`, `account__wipe`,
    `avatar`, `avatar--initial`, `ap-row`, `ap-when`, `ap-manner`, `ap-routine`,
    `tabbar__link--account`. That is a one-class-at-a-time item, not a sweep, and it is small.
  - **`carePlan.css`'s ~115 color literals are now a smaller problem than the number
    suggests**, because the pass above deleted 80 classes' worth of rules. Re-count before
    treating the parked retokenisation as the size it used to be.

- **2026-09-09 — the queue is still empty on purpose, the `[large]` slot has left this doc,
  and the `theme.css` lead above is mostly wrong.** Re-measuring the fifteen classes that
  bullet names as *not* false positives — every `className="..."` and `className={...}`
  literal under `web/src` against `.<name>` in `theme.css` — finds **eleven of them live**:
  `shelter__form`, `shelter__form-row`, `shelter__label`, `shelter__error`, `signin__google`,
  `signin__note`, `signin__fine`, `account__wipe`, `avatar`, `avatar--initial` and
  `tabbar__link--account` all appear in a real `className`. Only the four `ap-*` rules
  (`theme.css:557-564` — `.ap-row`, `.ap-when`, `.ap-manner`, `.ap-routine`) are genuinely
  unreferenced. This is the README's 2026-09-07 lesson landing for the third consecutive run,
  now against a *lead* rather than a shipped claim: the cheapest wrong measurement to find is
  the one the last run just wrote. The lead survives, at a tenth of its stated size — four
  rules, not fifteen — which is a reason to leave it a lead rather than promote it.
  **Nothing is queued here this run, and that is a routing decision rather than an absence.**
  execute works the queues top-down and this doc outranks `production-hardening.md`, so any
  item added here — including the small, true, four-rule version of the lead above — would be
  picked *before* **PH-17**, the repo's only `[large]` item and a defect in what the product
  tells a stranger about a real animal. That is precisely the treadmill the 2026-08-31 re-rank
  exists to stop, arriving from the other direction. The `carePlan.css` literal re-count is
  untouched and still wants doing before the parked retokenisation is sized.

- **2026-09-10 through 2026-09-12 — still empty, still the same routing decision, re-checked
  rather than carried over.** `production-hardening.md` has held the repo's `[large]` slot for
  four consecutive runs (PH-17, PH-19, PH-19's successor PH-20), and execute works the queues
  top-down: anything added here — including the true four-rule `ap-*` version of the `theme.css`
  lead above — would be picked ahead of it. The `carePlan.css` literal re-count is still
  untouched and still wants doing before the parked retokenisation is sized.

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
  and `components/Checklist.tsx` (31) deleted — 709 lines out against 78 added, built CSS
  94.4kB → 86.2kB — and the `.btn` base layer moved verbatim to the **top of `pawthway.css`**,
  not into `theme.css`. Proof rather than eyeballing: the built stylesheet was diffed
  rule-by-rule against a baseline build of `main` — **66 selectors removed, 0 added**, every
  removed one absent from every `className` under `web/src`. **Two things worth keeping out of
  the archive.** `app` and `badge` are *JS identifiers* inside `className={...}` expressions
  (`app.id`, `badge.tone`), so a naive scan reports seven live classes where there are five —
  know that before re-measuring. And moving six rules needed three new tokens, which is why a
  bulk retokenisation is parked rather than queued. Full 35-line row verbatim in
  [`archive/design-consistency-ledger-2026-09-09.md`](archive/design-consistency-ledger-2026-09-09.md).

- 2026-09-07 — DC-8 (with DC-9 as its rider) — PR #69 — **Care Plan joins the frame, and the
  notice learns to watch the import graph.** Archived verbatim the next run, in DC-10's PR, at
  [`archive/design-consistency-ledger-2026-09-08.md`](archive/design-consistency-ledger-2026-09-08.md)
  — DC-10 deleted five of the six media-query blocks this row is about, so most of it now
  describes code that is gone. What survives it and is stated above instead: `.cp-stage` was
  capped to `--content-w` (283px → 560px on a wide screen, a defect the spec hadn't known
  about), `ci.yml`'s stylesheet notice now watches every `.tsx` for a local `.css` import
  (DC-9) rather than `App.tsx` alone, and **a harness cannot prove a CSS change** — which is
  the lesson DC-10 was created by.
- 2026-09-08 — DC-10 (with DC-4 as its rider) — PR #71 — **Half the shipped CSS is deleted, and
  the measurement that queued it was wrong by five classes.** `pawthway.css` 544 → 203,
  `carePlan.css` 1863 → 1136, `Tips.tsx` / `Journal.tsx` / `useSwipe.ts` gone along with
  `Timeline.tsx`'s unused `Timeline` export. 43 dead classes out of `pawthway.css`'s 66 real
  ones, 80 out of `carePlan.css`'s 207. Built CSS **85,702 → 69,568 bytes** (−18.8%), gzip
  19.61 → 17.31 kB, **824 → 671 selectors: 153 removed, 0 added.**
  - **The queue entry's own numbers were over-reported, by exactly the mechanism the settled
    section warned about.** It said `carePlan.css` had 67 dead classes; the honest figure
    before the orphan deletions was **62**. The five it wrongly condemned —
    `cp-week--current`, `cp-week--dim`, `cp-week--passed`, `cp-star--on`,
    `cp-composer-mode--active` — are all live, and all live the same way: a conditional class
    in a **nested** string literal inside a template literal's `${...}`
    (`` `cp-week ${week.passed ? "cp-week--passed" : ""}` ``). A scanner that splits on
    `${...}` and discards the contents never sees them. That is DC-7's `app`/`badge` trap in
    its third costume, and it is now four consecutive runs where re-measuring corrected the
    previous run's measurement. The scanner also has false *lives*: `.checklist` and
    `.pickup-form` are dead classes whose names occur as a Firestore field name and a plain
    word elsewhere, so the real `pawthway.css` figure is **43, not 41**. A literal scan is a
    shortlist; the confirming pass has to read `className=` values specifically.
  - **The orphan-first ordering paid for itself exactly as specified.** Deleting the three
    zero-importer modules first took `carePlan.css`'s dead count 62 → **81** — `cp-milestone*`,
    `cp-timeline-list`, `cp-kind-chip`, `cp-answer`, `cp-ask`, `cp-composer`, `cp-view-header`
    were all being kept alive by components nothing rendered.
  - **Five of DC-8's six re-homed 1024px blocks are gone with their rules**, said plainly
    rather than quietly reverted: `cp-topbar`, `cp-topbar__title` + `cp-avatar`, `cp-tabs`,
    `cp-schedule-block`, and the `cp-hub__row` auto-fit rewrite. The two that survive,
    `.cp-stage--solo` and `.cp-main`, were DC-8's real and load-bearing effects.
  - **A rule whose selector names a dead class is dead even when it also names a live one.**
    `.cp-ask .cp-btn` can never match once `.cp-ask` is gone. The first pruner only checked
    whether *every* class in a selector was dead and left three such rules behind; the fix is
    per-selector reachability, with a comma-separated list dead only when all of its selectors
    are. Two genuine mixed *lists* are left alone on purpose — see the canonical section.
  - **Verified the DC-7 way, not the DC-8 way, which is the whole point of the item.** A
    baseline build of `main` and a build of this branch, their minified selector sets diffed,
    with the requirement that every removed selector name a class no `className` under
    `web/src` produces. No harness, no iframe, no hand-written markup that can disagree with
    the app. `build` / `test` (98 passing) / `lint` green — 9 pre-existing warnings, the same
    9 as on `main`, measured by running lint on a stash of this branch.
  - **One self-inflicted bug, caught by the verification and worth the warning:** a header
    comment I added said `` `web/src/**/*.tsx` ``, and the `*/` inside `**/*` **terminates a CSS
    comment** — the rest of the sentence became garbage CSS, and `vite build` emitted it
    without complaint. The selector diff caught it as two added selectors. A glob in a CSS
    comment is a live hazard; the surviving comment says so.
- 2026-09-08 — DC-4 — PR #71 — **A palette repaint is finally visible in review.** A third
  `frontend` guard step, **"Palette change notice"**: when a PR's diff touches
  `web/src/theme.css` or `web/src/brand.ts` it emits a `::warning::` plus a
  `$GITHUB_STEP_SUMMARY` block naming the files and quoting the changed token and color lines.
  It **cannot** fail the job — editing the palette on purpose is allowed, and the goal was
  always that PR #11 be *noticed*, not blocked. Reuses the `origin/main...HEAD` diff DC-6 made
  resolve, so it inherits the `fetch-depth: 0` fix rather than repeating its bug.
  - **Both of the two cases the spec named were exercised, on a real throwaway commit**, by
    extracting the step's `run:` block out of the parsed YAML and running it against a real
    git diff: a `:root` `--ink` edit produced the warning, the summary block and the quoted
    diff line at **exit 0**; this PR, which touches neither exempt file, produced no output
    and wrote no summary at all — and that second case will be visible on this very PR's run.
  - **What that does not prove, stated plainly because DC-1 is this doc's standing lesson
    about exactly this:** the warning case ran in local Git Bash against local git, not on a
    GitHub Actions runner. DC-1's failure was environmental (a depth-1 checkout local testing
    cannot reproduce), and while DC-6 has since fixed that for this exact diff mechanism — the
    two steps beside this one depend on it and pass — **the warning branch has still never
    been observed on a real Actions run.** Per the README, that makes it something to go and
    check on a named next run, not a disclaimer discharged by being written down. The first
    PR to touch `theme.css` or `brand.ts` is the check; it costs one glance at the summary.
