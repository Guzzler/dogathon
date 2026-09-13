# Archive — the README's 2026-09-10 `[large]`-slot entry (2026-09-12)

Verbatim snapshot of the 2026-09-10 entry in `docs/initiatives/README.md`'s fallback-chain log,
archived when the README crossed 400 lines on 2026-09-12. It is the entry that established
**"a spec is a measurement too"** — re-verify a queue item before someone spends a run on it,
not only after it ships.

It was chosen for the cut because the rule it introduced is now restated by both entries that
follow it: 2026-09-11 recorded the habit's fifth consecutive payoff against PH-18, and
2026-09-12 its sixth, which found PH-18 could not be built as written at all. The README's own
rule applies — a design answer stops earning its length the moment something else restates it —
and this is the oldest entry in a chronological log, which is the same growth shape as a ledger.

---

- **2026-09-10 — the slot was not sought, and the run's work was checking the one that exists.**
  PH-17 was queued the day before and had not been picked up (execute's last run shipped RS-4,
  #72, which merged twenty minutes before PH-17's doc PR, #73). So no fallback was run: the
  `[large]` slot is filled, it sits in the third doc for the second consecutive run, and both
  higher queues are empty on purpose — `design-consistency.md`'s emptiness is the routing
  decision recorded there on 2026-09-09, and re-queueing its four-rule `theme.css` lead would
  still take execute's run ahead of PH-17. **Total open across all three docs: two, one
  `[large]`.** Nothing was refilled, which is "don't refill a queue just because it has room"
  applied to a run with room in two of three docs.

  What the run did instead was **re-verify the `[large]` item's own spec against `main`** — the
  standing 2026-09-07 lesson, now on its fourth consecutive run and for the first time applied
  to an item *before* it is built rather than after. Every line number PH-17 cited was right,
  and the spec was still materially incomplete in three ways an execute run following its file
  list literally would have inherited:
  - **It named two write paths and there are four.** Deleting the two seeding effects leaves
    `setJournal` (`useJournal.ts:31`) and `setSchedule` (`:64`) persisting
    `updater(stored ?? seed…)`, so the first note a real foster writes saves the whole invented
    past underneath it. The defect would have survived its own fix.
  - **It named three files and there are four.** `CarePlanView.tsx` imports both moving exports
    and is what re-labels another shelter's intake record with this dog's name; moving them
    breaks it, and that is not discoverable from the other three files.
  - **One of its hedges was wrong in the safe direction.** "The count is not the two this doc
    names, verify it" — it is exactly two.
  The generalisation, and the reason this is worth a line here: **a spec is a measurement too.**
  The loop has learned to re-measure a shipped claim and a written-down lead; a queue entry that
  has not been built yet is the same object, and the cheapest moment to find it wrong is before
  someone spends a whole run on it.

  The design question advanced turns PH-17's rule from a pair of lists into a **test** — *could
  this value be wrong about a specific animal?* — and applying it to a second file showed
  **PH-18 is the same defect**, not a neighbour: `1.2 mi` and `Open now` on the emergency screen
  fail it exactly the way a seeded weight does. Recorded in `production-hardening.md`, with the
  seam that lets either item ship first.

