# The tense test and its five faces, plus "a retraction is a write" — verbatim snapshot, archived 2026-09-19

Cut from `production-hardening.md` (lines 51-131 and 204-223 as of commit 7b87b22) on 2026-09-19 to make room
for PH-25. All five faces had shipped by then, so what stood in the working doc was five rules
plus five preambles plus five pointers into other archives. The compressed form in the working
doc keeps the five rule statements; everything that surrounded them is here.

## The tense test, and the four faces it has been asked in — consolidated 2026-09-13

*(A **fifth** — what an input *control* may record — was added 2026-09-18 and sits below the
queue, because it is a design answer PH-24 still depends on. All four here watch a value leaving
the app; it watches one arriving, and is the first about the **foster** rather than a dog.)*

Four sections stood here, one per shipped item, each a rule plus a preamble plus a pointer to
the archive holding its working. They are one rule asked four times, so they are one section.
The statements below are verbatim; everything that surrounded them is in the archives named at
the end, and **PH-18 and PH-21 both still depend on this**.

**1 — the test itself (PH-17, what a page may print).**

> Could this value be *wrong about a specific animal*? Then it is a record, and it may only
> come from the foster, the shelter's document, or nothing at all.

A tip, a week phase, a task template, an unticked schedule row: all survive — they are advice,
false of no dog in particular. A milestone, a weight, a vaccination line, a journal entry, a
tick, a photograph: all fail. **So does `emergencyContacts`**, which is why PH-18 is the same
defect rather than a neighbour.

**2 — input (PH-19, what a model may be told).**

> A page can render an absence. A prompt, once it enumerates a field, cannot stay silent about
> it — so **"No medical flags." is not the prompt equivalent of "Not recorded."** The prompt
> equivalent is omitting the sentence. Generalised: **any template whose empty branch is prose
> rather than nothing converts a missing record into an assertion.** Grep for the shape, not
> the field.

Shipping it added the half the rule had not anticipated, recorded in PH-19's ledger row:
omitting the sentence is necessary and **not sufficient**, because the same closing instruction
that makes a false claim authoritative makes silence read as "nothing there".

**3 — persistence (PH-20, what a model may assert).**

> This app keeps exactly one thing a model wrote. `send_adoption_profile_to_shelter` stores
> `profile_text` on the dog's own document (`adoption.py:126`), and since RS-12 **that write is
> the notification** — staff read the paragraph at `/shelter/dogs` and decide from it whether a
> real animal gets listed. Every other model output in Pawthway is a chat turn that scrolls
> away. A sentence in it can be wrong about a specific animal, so it is a record.

And the routing rule that found it, which is the reusable half:

> When a fix teaches one reader of a dataset to handle absence, check every other reader of that
> same dataset before calling it shipped. The second reader is cheaper to fix than the first —
> the design work is done — and it is the one nobody notices, because the first reader is the
> one that was visibly broken.

**4 — audience (PH-21, who is shown the assertion).** Shipped 2026-09-13; the measurement
and the design answer are the section directly below, and what the build added to them is
PH-21's ledger row. The answer the measurement gave: the assertion reached only the party
who cannot verify it, never the two who can.

*Archives, in order: [PH-17's finding and the original tense-test working](archive/production-hardening-ph17-2026-09-10.md)
and [the 2026-09-10 section in full](archive/production-hardening-tensetest-2026-09-11.md);
[PH-19's working](archive/production-hardening-absence-2026-09-11.md);
[PH-20's design section and the queue narration that found it](archive/production-hardening-secondside-2026-09-13.md).*

**One stale fact, still stale, recorded here because `CLAUDE.md` is not this loop's to edit.**
`CLAUDE.md` says the cheap-model path is off — *"`web/src/api.ts` doesn't send it yet"*. It is
on: `api.ts:98` takes `phase?: ChatSurface` and `:109` sends it, `AgentChatPanel`'s `phase` prop
is required, all three mount points pass it, and `server.py:432` hands it to
`model_for_surface`. Match pickup coordination is answered by Haiku today. A sentence to
Sharang, not a doc edit. *(A second one joins it this run, from PH-21's measurement:
`CLAUDE.md`'s "The adoption page" section says "Nothing on this page is invented", which is true
of `buildAdoptionProfile` and silent about the agent-written paragraph. Correcting it is
Sharang's, not this loop's.)*

### A retraction is a write — archived 2026-09-14

PH-21 shipped (PR #81) and its ledger row is the fuller telling, so the design section that
produced it moved verbatim to
[`archive/production-hardening-ph21design-2026-09-14.md`](archive/production-hardening-ph21design-2026-09-14.md).
Three things from it are still load-bearing and are stated here rather than one hop away:
**a retraction is a write, not an erasure** (since RS-12 the write *is* the notification, so a
cleared field leaves a **Back from foster** card with nothing in it); **the write goes through
the agent and `firestore.rules` does not move** (a foster cannot write `dogs`, and widening
that would hand every foster their shelter's roster); and the method — *measure every reader
and every writer of a field, traced to the surface it renders on* — which is what PH-22 below
reuses against a different field.


---

## The fifth face, cut from lines 204-223 of the same file in the same move

### The fifth face: what an input *control* may record (2026-09-18, shipped the same run)

The four faces above each watch a value **leaving** the app. This one watches one **arriving**,
and it is the first whose claim is about the **foster** rather than a dog. The rule, stated to be
reusable against the next form somebody builds:

> **A default a control renders is a fallback; the same default persisted is an answer.** A form
> may only write a field the person actually supplied. Where it cannot tell, it must omit — not
> annotate.

Two generalisations worth keeping out of the archive. **Prefer absence to annotation wherever the
schema can already carry it** — PH-22 built a `derived` bag because `RichDog`'s fields are
non-null and layout needs them; every `FosterIntake` field here was already optional, so reaching
for a bag would have added a parallel vocabulary to a field that was nullable all along. And **a
defensive default that cannot execute is evidence the value it defends against is being
manufactured upstream**: `prefs()`'s `?? 50` / `?? 2` carried a comment about "a foster who
skipped onboarding" and could never fire, because `finish()` wrote both fields unconditionally.
The full section and PH-24's queue spec are verbatim in
[`archive/production-hardening-ph24-2026-09-18.md`](archive/production-hardening-ph24-2026-09-18.md).

