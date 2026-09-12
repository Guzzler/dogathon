# Archived 2026-09-11 — PH-19's queue entry, verbatim

The spec `dogathon-execute` built from, archived in the same PR that shipped it. Its four
findings and both of its roster counts were re-measured against `main` before the build and
every one of them held — which is itself worth knowing, since the previous two `[large]` items
(PH-17, PH-18) were both found materially wrong by the same check. What the spec did *not*
know is in the ledger row, not here.

---

- **PH-19 `[large]` — the agent is told things about the dog that nobody recorded, and then
  told not to doubt them.** `web/src/phases/careplan/brief.ts` composes the context carried by
  every Care Plan question, and it reaches the model for real — `CarePlanView.tsx:251` builds
  it, passes it to `JournalTips` as `dogContext`, and that component sends it at `:151`
  (a logged note) and `:187` (a typed question). Four things in it fail the tense test, and the
  brief's own closing instruction — *"Never invent anything about the dog that isn't above"*
  (`brief.ts:107-108`) — is what converts each of them from a gap into an authority.
  1. **`brief.ts:42` is wrong in both of its branches, for every dog in the roster.**
     `medicalFlags` comes from `d.needs ?? []` (`CarePlanView.tsx:47`). When `needs` is absent
     the brief asserts **"No medical flags."** — a categorical negative about a real animal that
     nobody tested. **9 of the 19 committed dogs have no `needs` at all** (Howdy, Champ,
     Colocho, Krypto, Jackie, Roxy, Sirius, Toby, Uncle Fester), so that sentence is shipped for
     47% of the roster. For the other 10 it is a **mislabel**: the entire `needs` vocabulary is
     behavioural — "Only dog in the home", "Leash training", "Confidence building", "Patient
     introductions", "Daily fetch", "Jumping practice", "Slow introductions", "Teen-dog
     training", "Only pet in the home" — and **not one of the ten values is medical**. The
     model is told "Medical flags: Leash training, Daily fetch." Both counts were measured
     against `data/dogs.json`; re-measure rather than trusting them.
  2. **`brief.ts:41` tells the model a weight of zero.** `weightLbs` is `d.weight_lbs ?? 0`
     (`CarePlanView.tsx:45`), whose comment claims "0 reads as 'unknown' in the Care Plan
     header" — true of that one header and of nothing else. `weight_lbs` is nullable by design
     (CLAUDE.md, "Unknown is not a claim") and the shelter's own add-a-dog form makes it
     optional (`shelterDog.ts:71`, "Give a weight or pick a size", writing `null` at `:125`).
     All 19 committed dogs happen to have one, so this is unexercised **today** and reachable
     the first time a real shelter adds a dog through RS-6's form — at which point the brief
     reads "0 lbs at intake".
  3. **The same `0` is rendered to the foster on the emergency screen.**
     `Emergency.tsx:137` (`{dog.name} · {dog.weightLbs} lbs`) and `:178` (under the label
     **Weight**). Fix these with the brief, not with PH-18 — PH-18 owns the contacts and the
     map, and this is the same `weightLbs` defect wearing a different surface.
  4. **`JournalTips.askAbout` (`:47-75`) asserts age-specific claims about any dog.**
     *"For a puppy ${dogName}'s age, biting is almost always teething"* is returned for a
     nine-year-old, and the final branch ships prototype copy to a real foster: *"In the real
     app this would call an LLM…"*. It is reached whenever the agent is unreachable, and is
     flagged `offline` in the UI but not in its own text.
  **What "fixed" means here is not "delete".** A prompt cannot render "Not recorded" the way a
  page can — see the design answer below. An absent `needs` should produce **no sentence at
  all**, or one that names the absence as an absence ("no medical needs are recorded; the
  shelter may not have assessed this"). A `needs` list should be labelled what it is — care or
  behaviour notes — not "Medical flags". A null weight should drop the clause rather than
  print a number. **Verify** with `npm run test` plus a unit test over `buildAgentBrief` for
  the three shapes that currently have no coverage: a dog with no `needs`, a dog with
  behavioural `needs`, and a dog with no `weight_lbs` — asserting the output contains no
  "No medical flags.", no "Medical flags:" over behavioural values, and no "0 lbs". There is
  no brief test file today; `adoption.test.ts` (new in PR #75) is the pattern to copy.
