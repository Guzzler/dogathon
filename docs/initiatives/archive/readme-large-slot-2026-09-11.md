# Archived verbatim: the 2026-09-08 and 2026-09-09 `[large]`-slot entries, README.md

Archived 2026-09-11, in the same PR that queued PH-19, for the reason those entries themselves
established: **a chronological log is the same growth shape as a ledger, and the oldest entries
are the ones that stopped being read.** This continues
[`readme-large-slot-2026-09-09.md`](readme-large-slot-2026-09-09.md), which holds the first
seven entries in the chain.

Both entries are compressed to their standing lessons in the working README. Nothing here is
superseded. The reason to come back to this file is the detail of *how* the two CSS
measurements were wrong — DC-8's harness containing dead classes, and DC-10's own count being
over-reported by five classes live via a conditional nested inside a template literal — which
is the concrete backing for the rule that what you measured against is part of the claim.

- **2026-09-08 — measuring found the slot a third time, and what it corrected was the
  *method*, not the sample.** DC-8 shipped; the first two fallbacks came back empty against
  the top doc for the fourth consecutive run and for the same structural reason (M3 finished,
  M5 gated on a shelter), so measure was used again and produced **DC-10**. What it measured
  was every class selector in all four stylesheets against every `className` under `web/src`,
  prefix-aware so constructed names like `` `cp-plan-chip__kind--${row.kind}` `` count as live:
  **41 of `pawthway.css`'s 61 classes and 67 of `carePlan.css`'s 204 are unreferenced**, and
  three modules have zero importers. The finding that made it a correction rather than a
  cleanup: **four of the six media-query blocks DC-8 re-homed the day before target classes no
  component renders.** DC-8 verified against a hand-built harness "of the real class
  structure", and a harness containing dead classes reports geometry for them exactly as
  convincingly as for live ones. So the standing lesson from 2026-09-07 gains a second half:
  a measurement is evidence, and **what you measured against is part of the claim** — the
  cheapest correction is still the section the last run just wrote, but the *method* it used
  deserves the same suspicion as its numbers. Where a static diff can prove the thing (DC-7's
  selector-set diff), prefer it over anything you had to build to observe it.
- **2026-09-08, second run — the slot was *spent*, not found, and the loop is now out of
  `[large]` work everywhere.** DC-10 shipped (with DC-4 as its rider), which empties
  `design-consistency.md`'s queue entirely after it held the repo's `[large]` slot for four
  consecutive runs. Across all three docs the only open item is **RS-4**, small by
  construction. So the next `dogathon-plan` run inherits the 2026-09-05 situation in a sharper
  form: the top doc is still gated on a human, and now the second doc has run out too. Both
  leads DC-10 left behind are small (a one-class-at-a-time `theme.css` pass; a re-count of
  `carePlan.css`'s literals now that 80 classes of rules are gone), so the honest expectation
  is that **the third fallback — measure — has to find the next `[large]` item somewhere other
  than CSS**, because three consecutive runs of measuring CSS have now consumed the dead CSS
  there was. One thing DC-10 proved about the method itself, worth carrying forward: its own
  queue entry's measurement was **over-reported by five classes**, all of them live via a
  conditional class nested inside a template literal's `${...}`. A literal scan is a shortlist,
  never a verdict — the confirming pass must read `className=` values specifically, and
  whatever is measured next deserves the same two-pass treatment.
- **2026-09-09 — the fourth link in the chain: measure something that isn't CSS, and the
  slot lands in the *third* doc.** The previous run predicted this exactly — three
  consecutive runs of measuring CSS had consumed the dead CSS there was, so the next
  `[large]` item would have to come from somewhere else. It did. Both cheap fallbacks came
  back empty against the top doc for the fifth consecutive run and for the unchanged
  structural reason (M3 finished, M5 gated on a shelter, RS-4 small by construction and in
  flight as this ran). Measuring **content provenance** instead of selectors — every module
  that supplies data to `buildAdoptionProfile`, traced back to where the data is written —
  produced **PH-17**: `web/src/phases/careplan/data.ts` is a demo dog's *past*, and
  `useJournal.ts` writes it into every real foster's Firestore document, from where the
  adoption page prints another animal's vaccination record and labels a seeded weight
  `source: "care plan"`. Three things generalise, and the third is the one to keep:
  - **The measurable surface is not only CSS.** Selectors against markup is one instance of
    a general move — enumerate what the code *claims*, then trace each claim to its source.
    Applied to content rather than style, the same method found a defect in what the product
    tells a stranger about a real animal.
  - **The slot may sit in the lowest-ranked doc**, and this is the second time the `[large]`
    item has been outside the top one (2026-09-05 was the first, in the second doc). Same
    reading as then: the ranking's premise — that real-data has the buildable work — has
    expired *for now*, not been overturned. Routing for one run, not a re-rank.
  - **Ranking cuts both ways, so an empty higher queue can be the correct queue.** execute
    works top-down, so anything queued in `design-consistency.md` this run — including a
    small, true item that survived re-measurement — would be picked *before* PH-17. Leaving
    it a lead is what protects the `[large]` item. "Don't refill a queue just because it has
    room" was written to stop the treadmill; this is the same rule arriving from the other
    direction, and it applies to a doc that ranks *above* the work that matters, not just
    below it.
  - A fourth, smaller: the 2026-09-07 lesson landed for the third run running, this time
    against a *lead* rather than a shipped claim. DC-10 left fifteen `theme.css` classes
    named as genuinely unreferenced; re-measuring found **eleven of them live**. The cheapest
    wrong measurement to find is still the one the last run just wrote.
- **`production-hardening.md`'s queue was empty by design for eight consecutive runs, and
  was refilled on 2026-09-09.** The emptiness was right while it lasted: it is the lowest-
  ranked doc, and it is the one whose refills produced the treadmill the re-rank exists to
  stop. What changed is not the ranking but the item — **PH-17** is a whole phase of the
  product asserting things about a real animal that nobody observed, which is the class of
  defect this doc was created for, not the small headlessly-verifiable errand class that
  caused the treadmill. Its verification errands stay parked under "Needs a human", and
  that list is still not a to-do list.

