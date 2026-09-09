# Archived 2026-09-08 — design-consistency.md's settled DC-8 section, verbatim

Snapshot of the section `## Settled — a phase may keep its own stylesheet; what it may not
keep is its own geometry (2026-09-07)` as it stood before compression. Archived per the
README's 2026-09-02 rule: after a `[large]` item ships, its design answer and its ledger
row are two tellings of one story, and the working doc keeps the shorter.

**One claim in here is now known to be incomplete**, and the working doc says so: the
measurement below treats `.cp-topbar`, `.cp-tabs`, `.cp-avatar`, `.cp-hub__row` and
`.cp-schedule-block` as live screen geometry. None of the five is rendered by any component
in `web/src`. Archives are append-only, so the correction lives in the working doc, not here.

---

## Settled — a phase may keep its own stylesheet; what it may not keep is its own geometry (2026-09-07)

The design question this run opened, given the correction above: **`carePlan.css` is a
phase-scoped stylesheet loaded from a component. Should it be folded into `theme.css` the way
`App.css` was folded into `pawthway.css`?**

**No — and the measurement says so unusually clearly.** All 204 classes it defines are
`cp-`-prefixed, and it collides with nothing: the only class selectors defined in more than one
stylesheet anywhere in the repo are `.btn`, `.btn--ghost`, `.btn--primary` (the documented base
layer) and `.pw-page` / `.pw-textarea` (`pawthway.css` ↔ `theme.css`, undocumented but
intra-root). `carePlan.css` contributes **zero** cross-file collisions, and it references
thirteen tokens, all of which resolve. It is the best-namespaced file in the codebase. Folding
1850 lines of one phase into the global sheet would trade that for nothing, and DC-7's own
lesson was that the hazard is *shared names*, not *separate files*.

What it did not do is share the app's geometry, and that was the real finding: its
breakpoints stepped at 900/720/520px against the **viewport** while the frame is 430px until
1024, so `.cp-hub__row` and `.cp-schedule-block` went two-up inside a 430px frame at ordinary
tablet widths; it referenced none of DC-5's frame tokens, and `.cp-stage` is not `.pw-page`, so
the wide-screen reading column never applied to it. **DC-8 fixed all of that (2026-09-07, PR
#__) and found worse: the screen was rendering 283px wide above 1024px.** The Ledger row is the
account. Two facts from that measurement outlive it and are not restated there:

- **`carePlan.css` is on a second token vocabulary.** Its colors come from the `--color-*` set
  `Layout.tsx` injects at runtime via `themeVars(pawthwayTheme)` (`brand.ts`, 10 keys), while
  the rest of the app reads `theme.css`'s `:root` names (`--ink`, `--line`, `--shadow`,
  `--r-sm`). Both resolve; nothing is broken. A future repaint has to know there are two places
  a color can come from — the PR #11 hazard in slow motion.
- **It carries ~115 hardcoded color literals** (42 hex, 73 `rgba(`) against 218 `var()` uses,
  including four near-identical creams (`#fffdf6`, `#fffdf7`, `#fffdf8`, `#fffaf8`) and a
  purple (`#5a3fa0`, `#7f5fbf`) that appears nowhere in the palette. They **predate DC-1's
  guard**, which only flags *added* lines, so CI has been correct and silent throughout. Not a
  repaint to schedule — a number to know before anyone proposes one.

**The decision was: keep the file, give it the frame.** DC-8 built exactly that. Retokenising
the 115 literals was explicitly *not* part of it — that is a repaint by volume even if every value
is preserved, and it belongs in the parked list until someone commissions it.

