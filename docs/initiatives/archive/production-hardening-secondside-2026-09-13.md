# Archived from `production-hardening.md` on 2026-09-13

Two blocks, verbatim as they stood the moment PH-20 shipped (PR #79). Both are archived for
the README's 2026-09-02 rule — *after a `[large]` item ships, its design answer and its ledger
row are two tellings of one story; keep the shorter* — and for the 2026-09-12 sharpening of it:
cut the layer that points at a layer that points at the reasoning.

The first is the design section that specified PH-20. The second is the Task queue's narration
of the run that found it. What survives in the working doc is the rule they produced, restated
once, plus PH-20's ledger row.

---

### The rule has a second side: what the model is allowed to write *down* (2026-09-12)

PH-19 fixed what the model is **told**. Nothing has yet asked what the model is **permitted to
assert**, and the two are not the same question, because this app keeps exactly one thing a
model wrote:

> `send_adoption_profile_to_shelter` stores `profile_text` on the dog's own document
> (`adoption.py:63`), and since RS-12 **that write is the notification** — shelter staff read
> the paragraph at `/shelter/dogs` (`ShelterRosterView.tsx:236-237`) and decide from it whether
> a real animal gets listed. Every other model output in Pawthway is a chat turn that scrolls
> away.

Asked of that paragraph, the tense test answers immediately: a sentence in it *can* be wrong
about a specific animal, so it is a record, and it may only come from the foster, the shelter's
document, or nothing at all. What makes this a surface rather than a wording change is that
**three separate things currently push the other way**, and they compound:

1. **The prompt asks for the shape, not the evidence.** `PAWTHWAY_SYSTEM`'s adoption paragraph
   (`server.py:94-104`) says *write a warm, **specific**, one-paragraph adoption profile*. Warm
   and specific over sparse, nullable inputs is the precise instruction to fill.
2. **The one anti-invention clause in that paragraph is scoped to channels**, not content —
   *"never describe a channel that didn't run"* covers whether an email was sent and says
   nothing about the dog. The pickup paragraph has a content clause (*"speak generally rather
   than inventing specifics"*); the care paragraph and the adoption paragraph have none. Of the
   three moments this agent exists for, the one whose output is *persisted* is the one with no
   content guardrail.
3. **The tool hands over absence as silence.** `generate_adoption_profile` returns `dog`,
   `foster_intake` and `care_log` raw. A dog with no `needs`, no weight and an empty care log
   arrives as three thin objects, and PH-19 already established what a model does with that: a
   silently-absent field reads as "nothing there" exactly as confidently as a false claim reads
   as a fact.

The answer to (3) is the part worth recording, because **the frontend already solved it and the
backend never got the answer.** `buildAdoptionProfile` computes `missing: string[]`
(`adoption.ts:151-156`) for this exact reason, stated in its own header comment: *"Every field
is either logged by the foster, recorded by the shelter, or absent — and `missing` lists what is
absent so the page can ask for it instead of filling it in."* Two consumers read the same three
data sources; one was taught the rule and one was not. So the generalisation is not a new rule
at all, it is a **routing** one:

> When a fix teaches one reader of a dataset to handle absence, check every other reader of that
> same dataset before calling it shipped. The second reader is cheaper to fix than the first —
> the design work is done — and it is the one nobody notices, because the first reader is the
> one that was visibly broken.

That is 2026-09-11's "ask who else reads the surface you measured last" arriving one layer down:
not a second *surface*, a second *consumer of the same records*. It is also why the
`missing`-list shape is the right answer here rather than a stronger prompt sentence — a prompt
can be argued with, and an enumerated gap in the tool result cannot.

**One claim the measurement contradicts, worth naming precisely rather than loosely.**
`adoption.ts`'s header says "Nothing here is invented", and that is true of `adoption.ts` —
`buildAdoptionProfile` really does source every field. But `CLAUDE.md`'s "The adoption page"
section generalises it to *"Nothing on this page is invented"*, and the agent-written paragraph
is a second, generated artefact about the same dog, read by staff rather than by the page.
The two do not currently contradict each other in code, because **`/adoption/:dogId` does not
render `adoption_profile`** — grep finds its only frontend reader is the shelter roster. So this
is a scope note, not a bug: the sentence is right about the page and silent about the paragraph.
Correcting `CLAUDE.md` is Sharang's, not this loop's.

---

of defect this doc was founded on (PH-1). They sit here because this doc owns truthfulness, not
because production-hardening has been re-ranked. *(The three-run narration of how PH-17 and
PH-19 were found, queued and shipped is now told by their Ledger rows and by "The line is
tense, not topic" above; it was cut on 2026-09-12 under the README's rule that a design answer
stops earning its length once something else restates it.)*

**2026-09-12 — PH-20 joins PH-18, and the `[large]` slot stays in this doc for a fourth
consecutive run.** PH-19 shipped the day it was queued, which emptied the slot everywhere and
left PH-18 — small — as the only open item in the repo. So the README's fallback chain was run
in full again: the queue held nothing big, every gated note is still gated on a *person* and
not on code (RS-8, RS-6b, RS-12b, PH-13, PH-7b, PH-15b — re-read, unchanged), and the third
link, **measure**, was used. It was used the way 2026-09-11 recommended — *point the last
method at another consumer rather than invent a new method* — and that recommendation paid off
twice over, because **the lead PH-19 left was half wrong and the half that was right was bigger
than it looked**:

- **The Match prompts pass the tense test, and that is a result rather than a non-finding.**
  Every value `MatchChatView`'s three `quickActions` interpolate — `dog.name`,
  `foster.pickup.date`, `foster.pickup.time`, `dog.shelter.name` — is a record the foster or
  the shelter actually wrote, and the screen does not render at all without `foster.pickup`
  (`MatchChatView.tsx:23`). Nothing to fix. The lead can be struck.
- **The Post Foster half is not a prompt problem at all**, which is why it is PH-20 and
  `[large]` rather than the one-line edit the lead implied. See the design section directly
  above: the defect is that the app persists one model-written paragraph as a record about a
  real animal, and all three of the things shaping that paragraph — the system prompt's ask,
  its missing content guardrail, and a tool that returns absence as silence — push toward
  filling gaps rather than naming them.

`DogProfile.ageMonths`'s `Math.max(1, …)` floor is the one lead left untouched and it survives
unchanged: it reports "1-month-old" for a dog entered as 0 years, which is a rounding today and
an assertion the moment anything reads it as one.


