# Archived 2026-09-11 — `production-hardening.md`, the design answer that produced PH-19

Verbatim snapshot of the "An enumerated absence is a claim" section, archived in the same PR
that shipped PH-19 (per the README's rule that a shipped `[large]` item's design answer and its
ledger row are two tellings of one story — keep the shorter). The rule itself survives in the
working doc; everything below is the working that produced it, including the line citations,
which PH-19's PR has moved.

---

### An enumerated absence is a claim — the tense test, moved from the page to the prompt (2026-09-11)

PH-17 established the test and PH-18 showed it was about tense rather than topic. The open
question this run was whether it survives the move from **what the product prints** to **what
the product tells the model**, since a prompt is not read by the foster and could be argued to
be scaffolding. It does survive, and it gets sharper, because the two surfaces fail differently:

> A page can render an absence. A prompt, once it enumerates a field, cannot stay silent about
> it — so **"No medical flags." is not the prompt equivalent of "Not recorded."** The prompt
> equivalent is omitting the sentence.

`adoption.ts` could answer "we hold no weight for this dog" by not drawing the row, and PR #75
did exactly that. `brief.ts:42` has no such move available to it as written: a ternary over
`dog.medicalFlags.length` has two branches and both of them are sentences, so an empty array is
not an absence — it is routed to the confident negative. That is the whole of PH-19's first and
largest finding, and it generalises past this one line: **any template whose empty branch is
prose rather than nothing will convert a missing record into an assertion.** Grep for the shape,
not the field.

Two consequences worth keeping:

- **The model is a reader with no way to check.** A foster reading "Not recorded" knows to go
  and look; a model reading "No medical flags." has been told, and `brief.ts:107-108` closes by
  instructing it never to go beyond what it was given. The instruction is correct and is what
  makes the input's accuracy load-bearing — it should not be softened as the fix.
- **This is why PH-19 is `[large]` and not a one-line change.** Three of its four findings are
  one expression each; what makes it a surface is that the same question has to be asked of
  every value the three LLM moments carry, and nothing in the repo has asked it before.

**One stale fact found while tracing this, recorded here because `CLAUDE.md` is not this loop's
to edit.** `CLAUDE.md` says of the cheap-model path: *"`web/src/api.ts` doesn't send it yet, so
everything currently runs on the capable model; adding it to the `/chat` body is what turns the
cheap path on."* That is no longer true. `api.ts:98` takes `phase?: ChatSurface` and `:109`
sends it in the body; `AgentChatPanel`'s `phase` prop is **required**, not optional; all three
mount points pass it (`MatchChatView.tsx:70` `"match"`, `PostFosterView.tsx:103` `"postfoster"`,
and the Care Plan panel); and `server.py:432` hands `req.phase` to `model_for_surface`. The
cheap path is on, and Match pickup coordination is being answered by Haiku today. Worth a
sentence to Sharang rather than a doc edit.
