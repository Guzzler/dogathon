# Archived from `README.md` on 2026-09-13

The 2026-09-11 and 2026-09-12 entries of the `[large]`-slot fallback log, verbatim. Both are
long accounts of a method — *point the last measurement at another consumer of the same
records* — that `production-hardening.md`'s consolidated tense-test section now states in four
lines, and whose two findings (PH-19, PH-20) are both shipped with their own ledger rows. Per
the doc-size rule: a design answer stops earning its length the moment something else restates
it, and a chronological log is the same growth shape as a ledger.

---

- **2026-09-11 — the fifth link, and it is the fourth link pointed at a second consumer.**
  PH-17 shipped (#75), which emptied the `[large]` slot everywhere and left PH-18 — small — as
  the only open item in the repo. So the chain was run in full for the first time since
  2026-09-08: **read the queue** (nothing big), **re-read the gated notes** (every one is gated
  on a *person*, unchanged — RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b), then **measure**. What
  was measured is the 2026-09-09 move applied to a different consumer: provenance again, but of
  what the **model** is told rather than what the adoption page prints — every value in
  `buildAgentBrief`'s output traced back to where it is written. It produced **PH-19**, and the
  slot sits in the third doc for the third consecutive run. Three things worth carrying:
  - **A method is reusable against a second consumer, and that is cheaper than a new method.**
    The four fallbacks so far each invented a new thing to measure. This run did not: it took
    2026-09-09's move and asked it of a different reader of the same data, and found a defect
    affecting **all nineteen dogs** — `brief.ts:42` says "No medical flags." for the 9 with no
    `needs` recorded, and mislabels behavioural notes as medical for the other 10, none of whose
    `needs` values are medical. Before inventing a fifth surface to measure, ask who else reads
    the surface you measured last.
  - **An enumerated absence is a claim.** The design answer this run, in
    `production-hardening.md`: a page can render "Not recorded", but a prompt that enumerates a
    field cannot stay silent about it, so **any template whose empty branch is prose rather than
    nothing converts a missing record into an assertion.** Grep for that shape, not for the
    field. It is the tense test surviving a move from output to input, and it is why PH-19 is a
    surface rather than a one-line change.
  - **The 2026-09-10 lesson held for a fifth run, against PH-18.** Re-verifying the one item
    already in the queue found its line citations stale (PR #75 moved 163 lines out of
    `data.ts`), one hardcoded number it had not named, and — the expensive one — that **PH-18's
    fix would have re-introduced the defect it fixes**: `Emergency.tsx:130` falls back to
    `contacts[0]`, so deleting the guessed "nearest vet" row makes the screen render *Pet Poison
    Helpline* under the heading "Nearest 24-hour vet", on a *Call Vet Now* button. That is the
    same shape as PH-17's "two write paths and there are four", found the same way, one run
    apart. **Re-verify the queue entry, not only the shipped claim** is now the loop's most
    reliably productive habit.

- **2026-09-12 — the sixth link, and it is the first time the fallback found the *same* method
  already had a second answer waiting.** PH-19 shipped the day it was queued, so the chain ran
  in full again: **read the queue** (only PH-18, small), **re-read the gated notes** (all six
  still gated on a person), then **measure** — and the thing measured was the lead PH-19 itself
  left, which is 2026-09-11's "ask who else reads the surface you measured last" taken at its
  word for a second consecutive run. It produced **PH-20**, and the `[large]` slot sits in the
  third doc for a fourth consecutive run. Three things generalise:
  - **A lead is a measurement too, and half of this one was wrong.** PH-19 named the Match and
    Post Foster prompts together. Match **passes** — every value its three `quickActions`
    interpolate is a record someone wrote, and the screen does not render without
    `foster.pickup`. Post Foster is not a prompt problem at all but a persisted-record one, so
    it is `[large]` rather than the one-line edit the lead implied. Striking half a lead and
    growing the other half is the normal outcome of checking one, not an unusual one.
  - **When a fix teaches one reader of a dataset to handle absence, check every other reader of
    that dataset before calling it shipped.** `buildAdoptionProfile` computes a `missing` list
    for exactly PH-19's reason; `generate_adoption_profile` hands the *same three sources* to a
    model and returns them raw. The second consumer is cheaper to fix than the first — the
    design work is already done — and it is the one nobody notices, because the first was the
    one visibly broken. This is the fourth-link method moved down a layer: not a second
    surface, a second consumer of the same records.
  - **Re-verifying the queue entry paid for itself a sixth consecutive run, and this time it
    found an item that could not be built as written.** PH-18 says the coordinator row should
    come from the dog's own shelter — and **no shelter record in this app carries a phone
    number**, while the row renders as a `tel:` link. Also unnamed until now: both local
    numbers are invented, one for an organisation that does not exist. Three items running,
    the spec has been wrong in the same direction — fixing the named thing would have left or
    re-created the defect.

