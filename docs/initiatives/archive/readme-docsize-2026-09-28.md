# Archived 2026-09-28 from README.md — "Doc size" rules, 2026-08-30 to 2026-09-12, verbatim

- **An empty queue is the *worst* moment for doc size, not the best.** All three queues were empty
  and all three docs were within two lines of the ceiling — 381, 397, 397 — because nothing held a
  spec whose shipping would buy lines back. A queue refill then costs full price. `real-data-and-
  shelters.md` needed **five separate cuts** (three ledger rows, two settled sections, the shared-
  decisions block, and six shipped-item bullets consolidated into one) to absorb a single
  queue item, and went 397 → 432 → 392 on the way.
- **Consolidating shipped-item bullets is the cheapest cut left once the obvious layers are gone.**
  Six bullets in `real-data-and-shelters.md` each said "RS-n shipped; the Ledger row is the full
  account" — twenty-two lines to say what one sentence says, and every one of them individually
  looked load-bearing. Same shape in `production-hardening.md`, same cut. This is the "layer that
  points at a layer" rule applied to the **queue** rather than to prose or the Ledger, which is
  where it had been applied on the four runs before.

- **The Ledger is the first place to look when a doc is over, not the last** (2026-08-30). Both
  docs went back over 400 within two days of archiving *narrative*, and almost none of the
  regrowth was stale prose. execute writes long, genuinely valuable rows; compress a row to its
  decision, its surprises, and what was verified versus reasoned about.
- **A design answer stops earning its length the moment something else restates it**
  (2026-09-01), and **after a `[large]` item ships, its design answer and its ledger row are two
  tellings of one story** (2026-09-02) — keep the shorter. The restating thing can be the
  **queue entry**, not only the shipped code (2026-09-03), so check the entry against the
  section the run you write it, not the run it ships. *(2026-09-10 widens this once more: it can
  also be a **parked** item. "What lifting the instance pin actually costs" was discharged and
  restated word for word by PH-13 under "Needs a human"; so were "No error tracking" by PH-7b
  and "Two smaller ones" by two ledger rows.)*
- **A chronological log is the same growth shape as a ledger** (2026-09-09, applied to this
  section itself on 2026-09-10). The oldest entries are the ones that stopped being read.
- **Compressing is sometimes not enough, and that gets recorded rather than hidden.**
  `real-data-and-shelters.md` landed at 421 on 2026-08-31 and 412 on 2026-09-04; a run that
  archives *and* adds a `[large]` item plus a design answer is net-positive on lines even after
  cutting 100. *(2026-09-10: `production-hardening.md` landed at 404 after three archives —
  over by four, recorded here for the same reason. **2026-09-11: the same doc landed at 409
  after three more** — 109 lines archived across PH-17's ledger row, ten older ledger rows, and
  the tense-test section, plus two preambles trimmed — while gaining a `[large]` item, a design
  answer and a re-verification. Third consecutive over-run, all three on this doc, which is
  itself the finding: **`production-hardening.md` is structurally at its ceiling**, and the next
  run that adds to it should archive the "Needs a human" block rather than hunt for prose.
  **2026-09-12: a fourth run added to it, and the prescription was wrong in a useful way.**
  That doc gained a `[large]` item, a design answer and a re-verification and still landed at
  **397** — under, for the first time in four runs — but not by cutting "Needs a human", which
  is already four lines and a pointer. What it cut was **two whole layers of
  pointers-to-pointers**: sixteen ledger rows each already a compression of an archived row,
  and six settled sections each already an index entry into an earlier archive. So the sharper
  rule, and the one to try first next time a doc is over: **cut the layer that points at a
  layer that points at the reasoning.** It comes out at zero cost, and this doc had
  accumulated two of them without anyone noticing, because every individual line still looked
  load-bearing.)*
