# `README.md` — the 2026-09-13, 2026-09-14 and 2026-09-15 fallback-chain entries, verbatim

Archived by `dogathon-plan` on 2026-09-17, in the same PR that added the tenth link. The three
entries below are the seventh, eighth and ninth, and they are the same shape: a run that found its
`[large]` item, wrote down which link of the chain produced it, and generalised one lesson. The
working README keeps the lessons compressed; this holds the working. Read it if you are about to
conclude that a link of the chain is spent, because the ninth entry is the one that found the
first link working again after four runs had quietly retired it.

- **2026-09-13 — the seventh link, and it is the sixth pointed at the lead the sixth left.**
  PH-20 shipped the day it was queued (#79), emptying the slot everywhere and again leaving
  PH-18 as the only open item. Chain run in full: queue holds nothing big, all six gated notes
  still gated on a *person* (RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b — re-read, unchanged),
  then **measure** — PH-20's own parting lead, which is the third consecutive run of pointing
  the last method at another consumer rather than inventing one. It produced **PH-21**, and the
  slot sits in the third doc for a fifth consecutive run. Two things generalise:
  - **A lead that names a missing write path can be hiding a missing read path, and the read
    path is why nobody noticed.** The lead said the agent-written adoption paragraph cannot be
    retracted. True — and the reason it has never mattered is that **no foster has ever seen
    one**: its only reader anywhere in the frontend is `ShelterRosterView.tsx:236`, so neither
    the foster who could say it is wrong nor the adopter it was written for is shown it. A
    retraction button on a paragraph nobody can read is not a fix. **When a lead describes
    something a user cannot do, check first whether they can see the thing they cannot do it
    to.**
  - **Consolidating beats compressing once a doc has one rule told four ways.** Merging four
    sections of `production-hardening.md` (PH-17's, PH-19's, PH-20's and the tense test's) into
    one that states the rule four times and preambles it once took it 437 → **389**. When
    several layers each point at a *different* archive but say the same thing, the cut is a
    merge, not a deletion.

- **2026-09-14 — the eighth link, and it is the first that stops pointing at the last consumer.**
  PH-21 shipped the day it was queued (#81), the third such run running, emptying the slot
  everywhere and again leaving PH-18 as the only open item. Chain run in full: queue holds
  nothing big, all six gated notes still gated on a *person* (RS-8, RS-6b, RS-12b, PH-13, PH-7b,
  PH-15b — re-read, unchanged), then **measure**. What is new is *what* was measured. The
  previous three runs each pointed the same method at the next consumer of one dataset, the
  adoption profile, and that vein is worked out. This run pointed the method at **the convention
  two writers share** rather than at a field, and produced **PH-22**. The slot sits in the third
  doc for a sixth consecutive run. Three things generalise:
  - **A stated contract is the cheapest measurement there is, because it names its own callee.**
    `shelterDog.ts:120-122` says an omitted key is "not recorded, which `normalizeDog()` already
    knows how to render". Checking it is opening one file. It had been false since RS-6 shipped
    it — `normalizeDog()` fills the absence with `6`, `"medium"`, and a breed regex — and the
    comment was written *by* the careful path *about* the careless one, which is why nobody
    reading either file alone would catch it.
  - **Where a codebase is visibly careful is where it is least worth measuring.** `compat()`'s
    three-way (unknown scores −4, not −26) is reasoned about in a comment, documented in
    `CLAUDE.md`, and is the first thing anyone finds when asking whether this app handles
    unknowns. It is also downstream of a normaliser that already erased the unknown from two of
    the three largest terms in the same score. **Measure the layer that runs before the one that
    advertises its care.**
  - **A doc's note to another doc is worth three sentences.** `design-consistency.md`'s
    one-bullet request that PH-21's attribution be one class across three views shipped exactly
    that; carried forward to PH-22, it shipped `Unrecorded` + one class across nine sites.

- **2026-09-15 — the ninth link, and it is the first link again: the slot was a label all
  along.** PH-22 shipped the day it was queued (PR #83), the fifth such run running, emptying
  the slot everywhere and leaving PH-18 as the only open item — for the seventh run in a row.
  Five consecutive runs then went looking for something big while **PH-18 sat there being
  something big**: a hand-drawn map of nowhere to delete, a headline card to make conditional,
  two invented phone numbers to remove, on the screen someone opens when something is wrong.
  It is marked `[large]` now. Two things generalise:
  - **The first link is not spent after it works once.** The 2026-09-01/02/03 entries
    established "re-read the queue before inventing", and the four runs after them each found
    their slot by measuring, which quietly turned the chain into *measure first*. The queue had
    held a `[large]` item the whole time; nobody re-read it because the last four runs had
    taught that re-reading was the step that comes back empty.
  - **Checking the citations is not checking the claim.** PH-18 has now been re-verified nine
    consecutive runs. Runs seven and eight found nothing, because both checked whether the line
    numbers still resolved — and they did. This run re-read the *screen* instead and found that
    `/poison/i.test(c.role)` matches none of the four shipped roles (all read `"Toxin
    ingestion"`; the regex belongs on `name`), so the Poison Control quick-action has **never
    rendered** and both national lines — the only two rows on that screen PH-18 was going to
    keep — fall through to "Other contacts" at the bottom. The invented one is the headline
    with a red *Call Vet Now* button beneath it. A re-verification that only re-resolves
    citations converges on nothing; the thing being verified is the claim.
