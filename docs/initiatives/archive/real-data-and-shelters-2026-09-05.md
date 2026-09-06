# Archive — real-data-and-shelters.md, 2026-09-05

Verbatim snapshot of the **"notify the shelter" means the dashboard** design section, taken
when RS-12 shipped (PR #63) and the section stopped being a specification and became a
description of code. Per the README's 2026-09-02 rule, a shipped `[large]` item's design
answer and its ledger row are two tellings of one story, and the working doc keeps the
shorter one. Archives are append-only: if something below turns out to be wrong, correct
the working doc and say so there.

---

## Settled 2026-09-04 — "notify the shelter" means the dashboard, and PH-1's gate is now open

`production-hardening.md` has carried PH-1 — *the tool that claims to notify a shelter and
doesn't* — since 2026-08-24, deliberately unqueued with the note that a real notification path
is **downstream of M3**, because "a shelter with an account and an application list is the
thing worth notifying." M3's three surfaces have all shipped (RS-2, RS-5, RS-6) and RS-5b
proved on 2026-09-04 that a real staff account reads the inbox and writes back to it. **The
gate is open.** So the question this run answers is what the notification actually is.

**It is not email, and it is not Arcade.** `send_adoption_profile_to_shelter` still returns
`"notified_shelter": arcade_tools.available()`, which is honest (PR #19) and will stay `false`
in production until someone configures an `ARCADE_API_KEY` that nobody has asked for. Wiring
Gmail or Slack would mean choosing an address for an organization Pawthway has no relationship
with — the conversation this doc keeps saying is Sharang's to have, not a PR's. A shelter that
signs in to `/shelter` has already told us where it reads.

**So the notification is a surface, not a message: the dog comes back on the shelter's own
roster, with the profile attached.** Three consequences the build must not soften:

- **The profile has to be rendered, or the tool is still lying.** `adoption_profile` is written
  by the Admin SDK and read by nothing. The foster's Post Foster phase is the app's most
  expensive turn (Opus, by `model_for_surface`) and its entire output currently reaches no
  human but the foster who watched it stream.
- **`ready_for_adoption` is an arrival, not a resting state.** It belongs in its own group at
  the *top* of `ShelterRosterView`, above `available` — a dog waiting on a person, which is what
  the Applications inbox is for and what the roster's flat available/rest split cannot express.
- **The shelter needs a truthful action, and `retire` is not it.** Retiring says "stop listing
  this for a reason of our own"; a dog whose foster handed it back adoption-ready wants
  **List for adoption** (→ `available`, back into Discovery) or **Mark adopted** (→ `adopted`,
  terminal, which `rosterAction` already refuses to reopen). Both already exist in `DogStatus`;
  neither is offered.

`notified_shelter` then stops being a capability probe and becomes true because the write
landed somewhere a shelter demonstrably reads — which is the claim PH-1 was created to stop the
app from making falsely. That is RS-12, and PH-1 is discharged by it rather than by anything in
`production-hardening.md`.

