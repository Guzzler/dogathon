# Archived verbatim: "The line is tense, not topic" (2026-09-10), production-hardening.md

Archived 2026-09-11 in the same PR that queued PH-19. Not superseded — **compressed**, because
two things written since restate most of its length: PH-18's queue entry now carries the seam
and the corrected line citations in more detail than this section did, and the 2026-09-11
design answer ("An enumerated absence is a claim") carries the test itself and extends it from
the page to the prompt. What survives in the working doc is the test, which PH-18 and PH-19
both still depend on.

### The line is tense, not topic — and it cuts one file further than PH-17 was scoped (2026-09-10)

PH-17's rule was written against `data.ts` and stated as a pair of lists. Applying it to a
second file turns it into a **test**, which is the more useful form:

> Could this value be *wrong about a specific animal*? Then it is a record, and it may only
> come from the foster, the shelter's document, or nothing at all.

A tip, a week phase, a task template, an unticked schedule row: all survive the test — they
are advice, false of no dog in particular. A milestone, a weight, a vaccination line, a
journal entry, a tick, a photograph: all fail it.

**So does `emergencyContacts`, and that makes PH-18 the same defect rather than a neighbour.**
`data.ts:204-228` ships "VCA SF Veterinary Specialists · Nearest 24h emergency · 1.2 mi ·
Open now" and "Copper's Dream Rescue · Foster coordinator · On-call today" to every foster.
`1.2 mi` and `Open now` are measurements of a distance and an opening time nobody computed;
"Copper's Dream" is a named shelter that is simply not this dog's, and `normalizeDog()`
already supplies the one that is. The two national rows pass the test unchanged — Pet Poison
Helpline and ASPCA Animal Poison Control are published numbers, correct for any US caller,
and assert nothing local. The hand-drawn SVG labelled "Presidio Park" fails it hardest: it is
a map of nowhere on the screen someone opens when something is wrong.

**The seam between the two items, so neither blocks the other.** Both touch
`Emergency.tsx`, which renders `medicalSummary` as its `summary` prop (`CarePlanView.tsx:260`).
**PH-17 owns the prop** — when the medical record moves into the demo-only module, `summary`
becomes optional and Emergency renders the section as absent, using the same "not recorded"
language the adoption page already uses. **PH-18 owns the rows and the map** and touches
neither the prop nor `data.ts`'s journal/milestone exports. PH-18 may ride PH-17 as a single
PR if execute gets there, per the rider convention, but it is correct alone in either order.

