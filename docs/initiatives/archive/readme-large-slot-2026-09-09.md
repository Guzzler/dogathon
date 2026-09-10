# Archive — README.md, the `[large]` slot log for 2026-09-01 → 2026-09-07 (verbatim, 2026-09-09)

Snapshotted because this run's own additions carried `docs/initiatives/README.md` well past
the length it asks its own initiative docs to stay under, and this section is a
chronological log — the oldest entries are the ones that had stopped being read. What the
working README keeps is the fallback chain those seven runs established, compressed to one
dated line each, plus the two most recent runs in full. Archives are append-only — if
anything below turns out to be wrong, correct the working doc and say so there.

---


- **`real-data-and-shelters.md` had no `[large]` item at all** after RS-5 shipped —
  the only one in the repo was DC-5, sitting in the *second*-priority doc, which is
  not what this README asks for. RS-6 (add and retire a dog: a rules change, a form,
  a status transition, and the foster-side consequences of both) was already that
  size and merely wasn't labelled. It is now marked `[large]` and sits at the top of
  the top doc's queue. The lesson is that the `[large]` slot is usually a **labelling**
  gap, not a missing item — look for the item that is already big before inventing one.
  **2026-09-02 repeated it exactly.** RS-6 shipped, taking the only `[large]` item in the top
  doc with it, and the next one was again already in the queue and unlabelled: RS-10 (a hook,
  both foster views composed from two sources, an agent tool constrained, a four-case test).
  Twice running, the answer was a label rather than an invention. Treat "there is no `[large]`
  item" as a prompt to re-read the queue before writing anything new.
- **2026-09-03 repeated it a third time, and the label was already right.** RS-10 shipped and
  RS-11 was already marked `[large]` and already at the top of the top doc — nothing needed
  labelling or inventing. Three runs in a row, the `[large]` slot was filled by reading the queue.
- **2026-09-04 broke the streak, and the exception is as instructive as the rule.** RS-11
  shipped and the top doc's queue held exactly one item — RS-4, a workflow trigger that is
  small by construction. Re-reading it produced nothing `[large]`, because there genuinely was
  nothing: M3's three surfaces and both round trips are built. The item came instead from
  **verifying a claim in the other direction** — PH-1 has said since 2026-08-24 that a real
  notification path is "downstream of M3", and M3 finished while nobody re-read that sentence.
  Reading `adoption.py` against the shipped shelter dashboard turned an old gated note into
  RS-12. So the generalisation gains a second half: **read the queue first, and when it is
  genuinely empty of big work, re-read the notes that were gated on something that has since
  shipped.** A parked item whose gate opened is the cheapest place a `[large]` one hides.
- **2026-09-05 — the slot left the top doc, and the ranking did not change with it.**
  RS-12 shipped and `real-data-and-shelters.md` was left holding one small item (RS-4). Both
  fallbacks were tried and both came back empty: re-reading the queue found nothing big
  unlabelled, and re-reading the gated notes found nothing whose gate had opened. The reason
  is structural rather than an oversight — **M3 is finished** (three surfaces, both round
  trips, a real staff account verified against it), and **M5 is explicitly gated on one real
  shelter using the admin surface**, which is gated on Sharang's conversation. So the repo's
  only `[large]` item is **DC-5**, in the *second*-priority doc, which is precisely the
  arrangement the 2026-09-01 note called "not what this README asks for". *(DC-5 has since
  shipped — PR #65, 2026-09-05 — and the slot is now DC-7 in the same doc; see the next
  bullet.)* It is the right answer anyway, and the distinction matters: **the top doc has run out of buildable work, not
  out of work.** Re-ranking would be wrong — the moment a shelter says yes, real-data goes
  straight back to the top with M5 and a second source behind it. Promoting DC-5 to execute's
  next run is a routing decision for one run, not a re-rank. The generalisation worth keeping:
  when the top doc's remaining work is gated on a human rather than on code, take the
  `[large]` item from the next doc down and **say so**, rather than inventing one to keep the
  slot inside the top doc.
- **2026-09-06 — the slot was found a third way: by measuring, not by reading.** DC-5
  shipped, which emptied the only `[large]` item in the repo. Both established fallbacks were
  run against the top doc and both came back empty again — re-reading `real-data-and-shelters.md`'s
  queue found only RS-4, and re-reading its gated notes found no gate that had opened, for the
  same structural reason as the day before (M3 finished, M5 waits on a shelter). The item came
  instead from **measuring the codebase against itself**: every `className` in `web/src/**/*.tsx`
  against every selector in the three stylesheets. That turned up 627 lines of `App.css` of which
  three classes are live, two dead components nothing imports, and — the part that made it worth
  a `[large]` item rather than a cleanup chore — **two selectors defined in two files at
  identical specificity, resolving a live screen by import order**. So the fallback chain now has
  three links, in cost order: *read the queue, then re-read the gated notes, then measure*. The
  third is the most expensive and the only one that can find work nobody has written down yet.
  DC-7 is the result, and the slot stays in `design-consistency.md` for a second run — which is
  the 2026-09-05 arrangement continuing, not a new one.
- **2026-09-07 — measuring worked twice, and the *second* measurement corrected the first.**
  DC-7 shipped, emptying the slot again. The first two fallbacks came back empty for the third
  consecutive run and for the same structural reason (M3 finished, M5 gated on a shelter), so
  the third link — measure — was used again, and it found the slot again: **DC-8**. But the
  lesson is not "measuring works." It is that **the previous run's measurement was wrong, and
  only re-measuring caught it.** DC-7 enumerated `App.tsx`'s import lines and concluded the app
  is "two stylesheets"; the app has **three** authored stylesheets, and the one it missed —
  `web/src/phases/careplan/carePlan.css`, imported from a component — is **1850 lines, larger
  than the other three combined**. That false claim shipped into `design-consistency.md`'s
  "what's actually canonical right now" list and stood for a day. Two things generalise:
  **enumerate the import graph, not one file's imports**, and — the more useful half — **a
  measurement is evidence, not a fact, and the cheapest place to find a wrong one is the
  section the last run just wrote.** The step-2 duty to verify grounding against reality
  applies to this loop's own prior output first, not only to the humans'.
