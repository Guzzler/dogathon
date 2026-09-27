# PH-28 spec — archived verbatim 2026-09-26, the run it shipped

Snapshot of `production-hardening.md` as queued on 2026-09-23. The Ledger row in that doc is the account of what shipped and where it differed.

### PH-28 `[large]` — a fallback may choose a pixel, never a name (queued 2026-09-23)

execute's 2026-09-22 audit filed three findings here for plan to spec. Re-read against `main` at
`b937d3e` this run, all three hold, and PH-28 has a **third symptom the audit could not see from a
guest session**: `createApplication()` takes `shelterId` from the raw `dog.shelter_id`
(`DogDetailView.tsx:61`, `SavedView.tsx:122`), so applying to `d-026` writes an application to
`shelterId: "petsun"` — an id `shelters.ts` removed and no `shelters/{id}` document staffs — while
Saved and Match tell the foster *"Copper's Dream works through the approval checklist with you"*.
The display invents one organisation and the write addresses a second that does not exist. Nobody
can ever answer that application, which is RS-14's rule arriving from the other side.

**The design answer.** The 2026-09-14 section below draws the line at *"a default is a fallback when
it feeds geometry and a claim when it feeds a labelled row or a sentence"*. `shelterFor()`'s hash
feeds **no** geometry-only reader: all ~30 read sites of `dog.shelter` (counted this run with
`grep -rn "\.shelter\b\|\.shelter\." web/src`) render a name, an address, a distance, a map pin or a
sentence attributing a decision — and a pin *is* an address. So there is nothing to keep it for:

> **A fallback may choose a pixel, never a name.** An unknown organisation is absent, not hashed
> onto a real one — and a dog nobody can apply to through a shelter that reads the application is
> not listed.

The second half is what makes the first cheap: a dog with no resolvable shelter leaves Discovery,
so the dozen foster-journey sites need only a *generic* noun ("the shelter"), never a missing-name
layout — and **the live `d-026` disappears on deploy with no Firestore write**, which shrinks the
human half the audit expected to cleanup.

**Spec — one PR:**
1. **`shelterFor()` stops hashing.** `shelters.ts:24` returns `Shelter | null` (known id → entry,
   else `null`); `RichDog.shelter` (`dog.ts:27`) becomes `Shelter | null`, and `dog.ts:88`'s comment
   stops calling the hash a fallback. A `shelterName(dog, "short" | "name")` helper returns the org's
   name or **"the shelter"** — for sentences only, never for a labelled row.
2. **Listing.** `DiscoveryView.tsx:27` lists `status === "available" && dog.shelter` — the one place
   listing is decided. `MapView` groups only dogs with a shelter; `SwipeDeck.tsx:125/148` and
   `DogDetailView.tsx:32/175-176` omit the chip, the distance and the **Find at** card on `null`;
   `DiscoveryView.tsx:36`'s search tolerates `null`.
3. **Every sentence site** (`SavedView` ×5, `MatchView` ×8, `MatchChatView` ×2, `PostFosterView:115`,
   `DogDetailView:235`, `CarePlanView:55`) goes through `shelterName()`; `Emergency.tsx:120` already
   guards. **Coordinate with RS-14**, which rewrites `MatchView.tsx:158/197` and `MatchChatView.tsx:62`
   — whichever lands second rebases onto the other's copy; neither re-introduces `dog.shelter.x`.
   RS-14 was **mid-build in the shared checkout** when this was written (branch
   `feat/rs14-pickup-request-reaches-shelter`, uncommitted), so expect PH-28 to land second. One
   thing RS-14's own spec got wrong, recorded here rather than in its entry to avoid a merge
   conflict with that build: its verify grep for `first-person plural` is **vacuous** — the phrase
   spans a string-concatenation line break (`server.py:77-78`), so it returns nothing on `main`
   too. `foster coordinator` (one line) is the grep that actually proves the prompt changed.
4. **The adoption page.** `AdoptionProfile.tsx:200` titles the section **"The shelter's record"** on
   `null`, and `:236-237`'s contact card is omitted — the public link must not send enquiries to an
   org that has never heard of the dog.
5. **The importer stops listing what it keeps for a foster.** In `_push_to_firestore()`
   (`import_dogs.py:162-172`), a `spoken_for` dog whose status is `available` is written
   `status: "retired"` in the same batch (RS-6's value for "stop listing for a reason the others would
   misstate"), and the plan line says so: `keep N stale but matched to a foster (delisted: …)`.
   `plan_only` still writes nothing.
6. **`dogFromForm()`'s comment** (`shelterDog.ts:157-160`) stops endorsing the fallback: an unknown
   staff shelter's dog now has `shelter: null` and is unlisted, which is **correct until a second
   shelter exists**. Denormalising its name from `shelters/{id}` is named here, not built — there is no
   second shelter, and that document carries no coordinates to pin.

**Riders — both small, both from the same audit, both copy.** **PH-29:** `DemoIntroView.tsx:25-26`
stops dating the roster ("August 23rd, 2025" is a year wrong — `data/dogs.json` landed 2026-08-23 — and
a hardcoded date goes stale on its own while RS-13b keeps the weekly check from looking) and stops
saying "all": e.g. *"The dogs listed come from SF SPCA's public adoption listings; some may have been
adopted since."* "Shelters near you" (`WelcomeView.tsx:32`, `HubView.tsx:21`,
`DiscoveryView.tsx:94/189/205`) becomes "shelters in San Francisco" — nobody was asked where they are.
**PH-30:** `SignInToApply.tsx:62-63` drops *"You'll answer the questionnaire once more on your new
account"*, which PH-5's `migrateGuestData()` (`auth.ts:65`) made false on 2026-08-26.

**Verify:** vitest — `shelterFor` returns `null` for `petsun` and for an unknown id; `normalizeDog` of
a `petsun` dog has `shelter: null`; a Discovery-list helper (extract one if needed) excludes that dog
and keeps an `sfspca-mission` one; the adoption section title on a `null` shelter; `shelterName()` both
ways. pytest in the existing `tests/test_import_dogs.py` — a stale `available` dog matched to a foster
is kept **and** written `retired`, a stale unmatched one is deleted, `plan_only` writes nothing.
`grep -rn "SHELTERS\[h" web/src` empty. `./node_modules/.bin/tsc -b` (the type change finds every
site — trust it over this list), build, lint at `main`'s 8 warnings, `uv run pytest`. **Not in scope:**
deleting `d-026` (a human's — **PH-28b** under "Needs a human"), a second shelter's pin, and
`CLAUDE.md`'s "`shelterFor()` remains only as the fallback for seeded records", which goes stale with
this PR — not this loop's file; say so in the PR body.

Checked and fine by the audit: no console errors; an untouched slider is not recorded (PH-24 holds
live); the guest apply path opens the sign-in sheet. **Not reached:** anything past applying, and the
desktop layout.

