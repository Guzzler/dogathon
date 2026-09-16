# PH-18 — the emergency screen makes claims it cannot support (queue entry, archived 2026-09-15)

Verbatim snapshot of the queue entry as it stood in `production-hardening.md` when PH-18
shipped (PR #__). Kept because the entry holds nine runs of re-verification, three of which
found the spec materially wrong — including the last one, which found that the two rows PH-18
was going to *keep* had never rendered where they were meant to. The shipped outcome is the
Ledger row in the working doc.

- **PH-18 `[large]` — the emergency screen makes claims it cannot support.** *(Entry rewritten
  2026-09-13: six rounds of re-verification had accreted as six layers of line-drift
  narration on top of a spec that changed three times. What follows is the spec as it now
  stands, with only the corrections that are still live. The superseded rounds are in the git
  history of this file and are not worth a reader's time.)*

  `web/src/phases/careplan/Emergency.tsx` renders a hand-drawn SVG street map labelled
  "Presidio Park" and "Bay" with a pin for the nearest vet — a picture of nowhere, on the screen
  someone opens when something is wrong — and `emergencyContacts` (`data.ts:204-229`) offers
  "VCA SF Veterinary Specialists · Nearest 24h emergency · 1.2 mi · Open now" and "Copper's
  Dream Rescue · Foster coordinator · On-call today" regardless of where the foster is or which
  shelter the dog came from. `:113` renders `{nearest.distanceMi} mi · 4 min`, and the **4 min**
  is a hardcoded travel time nobody computed; it dies with the map. **The two national lines
  stay** — Pet Poison Helpline and ASPCA Animal Poison Control are published, correct for any US
  caller, and claim nothing local. Delete the decorative map rather than labelling it.
  Grounded in the tense test above: `1.2 mi` and `Open now` fail it exactly as a seeded weight
  does. **The seam:** PH-18 touches `contacts` and `VetMap` only — never `summary` (already
  optional and already rendering "Not recorded"), never `data.ts`'s journal and milestone
  exports, never `weightLbs` (PH-19 shipped that half; `:182` now reads "Not recorded").

  Three corrections that are still live, each found by re-verifying rather than by building:

  - **The defect would survive its own fix.** `:130` resolves the headline vet as
    `contacts.find((c) => c.distanceMi != null) ?? contacts[0]`, so dropping the VCA row makes
    the fallback bite and the screen renders **Pet Poison Helpline under the heading "Nearest
    24-hour vet"**, with `nearest.phone` on a *Call Vet Now* button. The two national rows are
    the ones PH-18 correctly keeps, which is exactly what makes them the fallback. The
    nearest-vet card must become **conditional on there being a nearest vet**, not merely
    stripped of its claims; `nearest` is dereferenced unguarded at `:150`, `:153`, `:155` and
    `:159` (the `tel:` href).
  - **The coordinator row cannot be sourced as written.** This entry used to say it "comes from
    the dog's own `shelter`" — but **no shelter record anywhere in this app carries a phone
    number.** `Shelter` is `{id, name, short, address, lat, lng}` (`shelters.ts:1-3`) and
    `Dog.shelter` is the same six fields (`types.ts:104`), while an `EmergencyContact` renders
    as a `tel:` link. Decide deliberately: either the row renders without a call action, or it
    does not render at all. **Do not add a `phone` to `Shelter` to make the row work** — that
    field would have to be *filled*, and inventing it is the defect PH-18 exists to remove.
  - **Both local phone numbers are invented, and one belongs to an organisation that does not
    exist** — `shelters.ts:13` records Copper's Dream Rescue as *"from the product spec"*. A
    made-up number on the screen a foster opens in an emergency is worse than a made-up
    distance, and it is the same delete.

  - **The two rows PH-18 keeps are the two the screen has never shown properly, and one of
    them has never rendered at all.** `:131` resolves the poison tile as
    `contacts.find((c) => /poison/i.test(c.role))` — and neither national line's **role** is
    "poison": both read `"Toxin ingestion"` (`data.ts:216-228`). The names match the regex;
    the field it is tested against does not. So `poison` is `undefined` on every render, the
    `{poison && ...}` quick-action at `:187` has never appeared, and both honest rows fall
    through to `other` and render as ghost buttons under **"Other contacts"** at the bottom of
    the screen. Verified by evaluating the predicate against all four shipped roles: `[false,
    false, false, false]`. Fix the field, not the regex — `role` is the right thing to branch
    on for a *category*, so the rows want a category (`kind: "poison" | "vet" | "shelter"`),
    not a second substring test.

  Verify by rendering with a dog whose shelter is not Copper's Dream and reading the screen for
  anything still guessed, and by confirming a poison line reaches the quick-action row rather
  than "Other contacts". *(A line for the ledger, not a code change: `CLAUDE.md` lists
  "Emergency Mode (24h vet map)" as explicitly out of scope, and it shipped anyway. The scope
  note is stale.)* **Re-verified against `main` 2026-09-15 — a ninth consecutive run, and the
  first in three to find something**: PR #83 touched nothing this entry cites, so every line
  number re-reads (`data.ts`'s array is 204–**229**, off by one in the old wording), but
  re-reading the screen *whole* rather than only the cited lines produced the correction above.
  That is the habit's fourth paid run out of nine, and it sharpens what "re-verify" means:
  checking the citations is not checking the claim.
