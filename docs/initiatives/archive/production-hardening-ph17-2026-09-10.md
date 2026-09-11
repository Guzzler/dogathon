# Archive — PH-17's finding and its queue entry (2026-09-10)

Snapshot taken when PH-17 shipped. The rule it established survives in
`production-hardening.md` in its more useful form — the tense test under
"The line is tense, not topic" — which PH-18 still depends on. What is here is the original
finding (the evidence that produced the rule) and the queue entry's file list, both restated
by the shipped code and by PH-17's ledger row.

## Settled — advice may be templated; a history may not be seeded (2026-09-09)

**The finding.** `web/src/phases/careplan/data.ts` is 438 lines written for a demo dog
called Marty, and most of it is not a template — it is a **past**. Thirteen
`seedMilestones` with dates and outcomes ("Intake with Copper's Dream · Cleared for foster.
Deworming complete.", "DHPP booster", "Vet check-in (Dr. Alvarez)"), **seven carrying a
weight** from 20 lb to 29 lb; three `seedJournal` entries in a foster's voice ("Wouldn't eat
kibble. Tried a spoon of wet food on top"), one a photograph of a different animal
(`web/public/journal/day4-couch.jpeg`); a `medicalSummary` asserting `DHPP (booster
complete)`, `Allergies: None reported`, `Deworming — in progress`; and `scheduleBlocks`
shipping **pre-ticked** (`s-flea`, `s-dhpp-1` are `done: true`).

None of it is confined to a demo. `useJournal.ts:25` and `:59` write `seedJournal` and
`scheduleBlocks` **into the real foster's Firestore document** on first render, for every
foster, gated on nothing — `useJournalEntries` carefully gates *its* fallback on
`LOCAL_MODE`, and the seeding write defeats that gate by making the data real. From there
it reaches exactly where this project has already decided invented content must not go:
`adoption.ts:144` sets `medical: medicalSummary` **unconditionally**, so every dog's
adoption page prints Marty's vaccines and allergies; `:51`'s `milestones` parameter
**defaults to `seedMilestones`**, which `CarePlanView` re-labels with the real dog's name;
`:98-103` returns a seeded weight as `{ value, source: "care plan" }`, so the page's own
provenance line says a foster observed a number nobody measured; and `careDone` counts the
pre-ticked items. `adoption.ts`'s own comments name the standard without noticing it
applies to its other inputs — *"a stand-in photograph of a different animal on the page a
stranger reads to decide about this one is exactly what 'nothing on this page is invented'
rules out"*. The compatibility tri-state got that treatment; the health record and the
journal did not.

**The rule that resolves it is a line, not a purge:**

> **Forward-looking advice may be templated. A record of what has already happened may
> never be seeded.**

A tip, a week phase, a task template and an *unticked* care schedule are guidance — generic
by construction, true of any dog, honest with `{dog}` substituted. A milestone with a date,
a weight, a vaccination record, a journal entry, a ticked checkbox and a photograph are
assertions that a specific thing happened to a specific animal. The first set stays; the
second must come from the foster, from the shelter's record, or render as absent — the same
three sources `buildAdoptionProfile` already names, and the same standard "Unknown is not a
claim" applies to the dog document.

**`LOCAL_MODE` is the deliberate exception and the only one.** A fresh clone shows a banner
saying the data is local, so showing demo content behind it is honest. **Writing it to a
foster document is not**, in any mode — that is what PH-17 removes outright rather than gates.

---

## The PH-17 queue entry, verbatim

- **PH-17 `[large]` — stop seeding a history the foster never lived.** The design section
  above is the specification; this is the file list and the exit condition. Do not
  redistribute it into small PRs — the halves are only honest together.
  - **`web/src/hooks/useJournal.ts` — four write paths, not two** *(re-verified 2026-09-10;
    the two effects are exactly where this doc said, and the other two were missed)*. Delete
    both seeding effects (`patchFoster({ journal: seedJournal })` at :25,
    `patchFoster({ careSchedule: seedSchedule })` at :60 — the line is :60, not :59) and the
    `seeded` refs with them. **Then fix the two setters**, which are the reason deleting only
    the effects would leave the defect intact: `setJournal` at :31 persists
    `updater(stored ?? seedJournal)` and `setSchedule` at :64 persists
    `updater(stored ?? seedSchedule)`, so the first note a real foster writes, or the first
    box they tick, saves the entire seed underneath it. Both fall back to `[]`. Line :28's
    `stored ?? seedJournal` becomes `stored ?? (LOCAL_MODE ? seedJournal : [])` — which is
    exactly what `useJournalEntries` (:41) and `useCareScheduleBlocks` (:74) already do
    correctly, so copy them rather than inventing a shape.
  - **`web/src/lib/adoption.ts` — three fixes, all provenance.** `medical: medicalSummary`
    (:144) must render from data the app actually holds and otherwise be absent, with
    `"medical record"` added to `missing`; the `milestones` parameter (:51) must **not**
    default to `seedMilestones` — default it to `[]`; and the `lastMilestoneWeight` branch
    (:98-103) must not be reachable from template data, so a weight is either a real
    `careLog` weigh-in (`source: "care plan"`), the shelter's intake figure
    (`source: "shelter"`), or the size bucket — never a seeded figure wearing the foster's
    label.
  - **`web/src/phases/careplan/data.ts` — split the file by the rule, don't gut it.** Keep
    `taskTemplates`, `weekPhases`, `tips`, `daysSincePickup` and the `scheduleBlocks`
    *shape*; set every `done: true` to `false` — *verified 2026-09-10:* it **is** exactly the
    two this doc names, `s-flea` (:279) and `s-dhpp-1` (:288), `grep -c "done: true"` returns
    2, so the hedge in the original entry was wrong and no hunt is needed. Move `seedJournal`,
    `medicalSummary`, `marty` and every past-dated `seedMilestones` entry into a clearly
    named demo-only module (e.g. `data.demo.ts`) that **only `LOCAL_MODE` code paths may
    import**; the one milestone that can survive is a pickup marker derived from
    `foster.pickup.date`, which is real.
  - **`web/src/phases/careplan/CarePlanView.tsx` — a fourth file the original entry did not
    name** *(found 2026-09-10)*. It imports `medicalSummary` and `seedMilestones as
    rawMilestones` at :13-14, re-labels the milestones with the real dog's name at :120-127
    (which is how another shelter's intake record ends up wearing this dog's name), passes
    them at :228 and :247-248, and hands `medicalSummary` to `<Emergency summary=...>` at
    :260. Moving those exports into the demo-only module **breaks this file**, so it is part
    of PH-17 and not discoverable from the other three. The milestone list becomes `[]`
    outside `LOCAL_MODE` plus the real pickup marker; `summary` becomes optional per the seam
    described in the design section above.
  - **Empty states are part of the item, not follow-up.** `CarePlanView`, `Hub` and the
    adoption page must each read well with an empty journal, no milestones and no medical
    record — the adoption page already has `missing` and the "still to add" prompt for
    exactly this, so use it rather than inventing new copy.
  - **Verify, and make the verification a test rather than a screenshot.** Add cases to the
    existing `adoption` tests: `buildAdoptionProfile` given an empty journal, empty schedule
    and a dog with no medical fields returns no medical assertions, no milestones, a weight
    whose `source` is `"shelter"`, and `missing` naming each absent section. Then
    `grep -rn "seedJournal\|medicalSummary\|seedMilestones\|marty" web/src --include=*.ts
    --include=*.tsx` must return only the demo module and `LOCAL_MODE`-guarded call sites —
    paste that output in the ledger row. Finish with `npm run build` and a local run where a
    foster document that has never opened Care Plan gains **no** `journal` or `careSchedule`
    field (check the Firestore document, or `localStorage` in local mode).
