# Archived 2026-09-08 — design-consistency.md's Ledger rows for DC-1, DC-6 and the 2026-09-04 shelter-side pass, verbatim

Taken per the README's 2026-08-30 note that the Ledger is where the growth is. All three
are settled and referenced from the working doc: DC-1 and DC-6 are the guard's history
(diagnosis in `design-consistency-dc3-2026-09-07.md`), and the shelter-side row's two traps
are restated in the working doc's canonical section.

---

- 2026-08-25 — DC-1 — PR #25 — added a "Design token guard" step to
  `.github/workflows/ci.yml`'s `frontend` job: fetches `origin/main`, diffs
  it against HEAD over `web/src/**/*.css|*.ts|*.tsx` excluding `theme.css`
  and `brand.ts` (git pathspec `:(glob)`/`:(exclude)` magic — a bare
  `**` glob without `:(glob)` silently matches nothing under this git
  version), and fails if an added line matches a hex color or
  `rgb(`/`rgba(`. Went with the inline-bash option over a separate Python
  script, per the task's own "either" framing. Verified locally on two
  throwaway commits (not yet observed on a real GitHub Actions run): a
  hardcoded hex added to `App.css` fails the check; a `theme.css`-only
  edit passes. DC-3 is the note to watch the first real PR that exercises
  this for real.
- 2026-08-28 — DC-6 — PR #32 — `actions/checkout@v4` in the `frontend` job
  now takes `fetch-depth: 0` instead of the default depth-1, so the guard's
  `git diff origin/main...HEAD` has a merge base to compute against; the
  standalone "Fetch main for the design-token diff" step is now a plain
  `git fetch origin main` (kept, not removed, since the guard still needs
  `origin/main` as a ref even with full history checked out). The guard's
  diff is now computed into its own `diff=$(...)` statement so `set -e`
  catches a real git failure; `|| true` moved to sit only on the final
  `grep`, which is expected to exit 1 on a clean diff. Verified from real
  Actions runs, not a local throwaway (that's what missed the original
  bug): pushed a commit adding a hardcoded hex to `web/src/App.css` on this
  same branch and confirmed the `frontend` job **failed** with the guard's
  `::error::` message (run 33223963302); then reverted it and confirmed the
  job **passed** with no `fatal: ... no merge base` line in the log (run
  33224005057).

- 2026-09-04 — DC (shelter side, unqueued — reported by Sharang while reviewing the demo) —
  PR #60 — **The shelter surfaces now read as the same product as the foster journey.** The
  root cause was the collision this doc exists for: `ShelterLayout` renders inside `.screen`,
  so `.screen .btn` — the phone's `width:100%`, 100px-radius, thumb-sized primary action —
  landed on every shelter button. That was not cosmetic. At `width:100%` a Retire button's
  flex basis becomes the entire row, which starved `.shelter__dog-main` to **0px**, so each
  dog's breed and age rendered *underneath* the button and names wrapped mid-word. Measured on
  the deployed page before the fix: Retire 806px, meta column 0px; after: 71px and 275px.
  Beyond the bug, a pass to close the gap with the foster app: a real sticky header (paw +
  wordmark + a `SHELTER` role marker, mirroring `.topbar`) instead of two links floating on
  bare ground; native OS checkboxes replaced with the phone's own rounded sage tick; detail
  section headings demoted from `h3`-weight titles to coral eyebrows; the app's soft `--shadow`
  on cards; the 19-dog roster two-up above 760px with name / breed·age / status on two tight
  lines instead of three; and status actions given hierarchy, since three identical outline
  buttons made *decline* look as routine as *mark in review*.
  **Two traps worth recording.** `.shelter .btn` and `.screen .btn` have equal specificity, so
  the shelter rules only win by sitting *below* them in `theme.css` — don't reorder that file.
  And `align-self:center` on the shared button rule reads fine in a row and silently centres
  "Add a dog" mid-page in a column; it was caught in preview and removed.
  Verified by injecting the exact rules over the live deployed page and measuring, not by eye.


---

## Also archived 2026-09-08 — DC-5's Ledger row, verbatim

DC-5 shipped 2026-09-05 as PR #65 with DC-2 as its rider. Its live constraints (the three
frame tokens, the padding-not-a-wrapper reading column, the `margin-inline:auto` trap) are
restated in the working doc's canonical section and in DC-8's ledger row, which is why the
row itself could be compressed.

- 2026-09-05 — DC-5 (with DC-2 as its rider) — PR #65 — **The foster journey stops being a
  430px column on a 27" monitor.** Three new `:root` tokens — `--frame-w`, `--content-w`,
  `--gutter` — carry the widths that were hardcoded, so `.phone` and `.sharesheet` both move
  from one place; at `min-width:1024px` the frame goes to 760/560 and at 1440px to 960/620.
  The reading column is centred with **padding, not a wrapper**: `.topbar`, `.pad` and `.tabs`
  take `padding-inline: max(var(--gutter), calc((100% - var(--content-w)) / 2))`, which
  resolves to exactly the old 24px at phone width, so one rule serves both cases and no
  screen's markup learns it is on a wide viewport. `.pw-page` (Hub, Post Foster, the older
  phase views) just stops stretching. `SavedView`'s list is now a `.cardgrid` that goes two-up;
  `SwipeDeck`'s stack caps at 440px and centres, because a swipe card that fills 960px is a
  worse swipe card, while the map behind the same toggle deliberately takes the whole widened
  frame. The tab bar keeps its decided shape — a new `.tabbar__row` wrapper caps and centres so
  five thumb-sized cells don't stretch across 1400px.
  **Three things the spec did not know.**
  (1) There is **no "discovery grid"**; Discovery is a swipe deck and a map, so the second
  column landed in `SavedView` alone — the one list long enough to earn it.
  (2) `.sharesheet` does **not** stay 430 and does not follow the frame either: it is
  `max-width:min(var(--frame-w),480px)`, because a sheet stops reading as a sheet somewhere
  around 500px. The spec offered "move it or say it stays" and the honest answer was neither.
  (3) A real bug, caught by measuring rather than by eye: `margin-inline:auto` on a
  **column**-flex child cancels the cross-axis stretch, so `.deck__stack` collapsed to
  **31px** at 1024px+ with `max-width` alone. `width:100%` is what fixes it and there is a
  comment on the line saying so.
  Verified by serving the built stylesheet against a harness of the real class structure in
  four iframes (a media query evaluates against an iframe's own viewport, which is what made
  this measurable at all in a session that cannot start a dev server) and reading computed
  boxes at **390 / 768 / 1024 / 1440**: frame 390→390, 768→430, 1024→760, 1440→960; `.pad`'s
  left padding 24 / 24 / 99 / 169; the grid one column then `273px 273px` then `303px 303px`;
  the deck stack 302 / 340 / 440 / 440, centred at every width; **no horizontal scroll at any
  of the four**. The narrow half was diffed against a baseline build of `main`: frame, gutter
  and sheet are byte-identical at 390 and 768, which is the claim that mattered — this widens
  the frame, it does not redesign the phone. `build` / `test` (98) / `lint` green, with the
  same 9 pre-existing warnings and no new ones.

---

## Appended later the same day, in DC-10's PR — DC-8 / DC-9's Ledger row

DC-10 shipped hours after DC-8 and deleted five of the six media-query blocks this row
describes re-homing, so the row became a description of code that no longer exists. Its
`.cp-stage` finding and its harness lesson are kept in the working doc; everything else is
here. **Append-only** — corrections go in `design-consistency.md`.

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
