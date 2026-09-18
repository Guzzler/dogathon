# `production-hardening.md` — PH-22 and PH-21 Ledger rows, verbatim as they stood on 2026-09-17

Archived by `dogathon-plan` on 2026-09-17, in the same PR that queued PH-23, because that PR
pushed the doc to 440 lines and the README names the Ledger as the first place to look. Both
items had already shipped and both have their specs archived separately
([PH-22](production-hardening-ph22-2026-09-14.md),
[PH-21](production-hardening-ph21design-2026-09-14.md)), so these rows were the longer of two
tellings. The working doc keeps a compression of each: the decision, the surprises, and what
was verified versus reasoned about.

- 2026-09-14 — PH-22 `[large]` — PR #83 — **`normalizeDog()` still fills the three holes a
  card's layout needs, but it now writes down that it had to, and nine surfaces stopped printing
  the filling as the shelter's answer.** `RichDog` gains `derived: {fosterWeeks, size,
  energyLevel}`, set by resolving each field to `null` first and defaulting second — so the
  question "did anyone record this?" survives the defaulting instead of being answered by it.
  Two borderline cases were called deliberately and are tested as such: **bucketing a recorded
  `weight_lbs` counts as recorded** (restating a weight is not inventing a size), and so does
  `parseLegacyLength()` on free text somebody wrote. `fosterWindow()` takes `number | null` and
  returns `recorded: false` with a null total, null label, no bar and no `endDate` — which is
  the sharp half, because `foster_weeks` is absent on **all 19** roster dogs, so every countdown
  this app has ever shown a foster ("12 days left", an end date, a progress bar) was arithmetic
  from a constant. Rendering goes through **one** component, `components/Unrecorded.tsx` plus
  one class — the shape `design-consistency.md` asked for, and `ProfileAttribution` was checked
  first and is a different thing (it attributes a *paragraph* whose author is in doubt; this is
  an inline stand-in for a *value* nobody supplied). `matchReasons()` **says nothing** rather
  than saying "Not recorded": a slot promised a value gets the component, a sentence that was
  never owed gets silence.

  **Re-verifying the spec against `main` paid for an eighth consecutive run**, and this time on
  the census rather than on a line number: the entry named seven read sites and there are nine.
  It missed `AdoptionProfile.tsx:48` — `sizeLabel(dog.size)` on the **shared adoption link**,
  the one surface in this app read by a stranger deciding about a real animal, and the exact
  surface PH-17, PH-20 and PH-21 each hardened in turn — and `DogDetailView.tsx:94`'s subhead.
  It also did not name `MapView.tsx:81`, where the "easy" sort filters on `energyLevel <= 2`: a
  claim wearing a filter's clothes, and it sat one `&&` away from `good_with_kids === true`,
  which had been refusing unrecorded answers correctly all along. Both are in this PR.

  In scoring, `compat()`'s documented three-way is extended one layer earlier rather than
  widened: unknown size scores `0` and unknown energy `-4`, each slightly below its term's
  midpoint, so a recorded match outranks an unknown and an unknown outranks a recorded mismatch.
  Every home/experience rule now waits on its input having been recorded — the case that makes
  this concrete is a dog named "Border collie" with no `energy_level`, which `guessEnergy()`
  scored 4 and which then paid both the apartment and the first-timer penalty on the strength of
  its name. `matching.ts:50`'s justification cited a `score >= 45` cutoff in `DiscoveryView`;
  **there has never been one**, and `DiscoveryView.tsx:34-35` carries the opposite comment. The
  reason is ranking, not admission, and the comment now says so. *(`CLAUDE.md` repeats the same
  dead cutoff under "Unknown is not a claim" — a sentence for Sharang; this loop does not edit
  that file.)* Two **stated contracts that were false** are corrected in place:
  `shelterDog.ts`'s "an absent key is 'not recorded', which `normalizeDog()` already knows how
  to render" (wrong since RS-6, and written *by* the careful path *about* the careless one) and
  the same claim in `types.ts`.

  Tests: 12 new (`dog.test.ts` is new — 7 cases on the flags and `recordedStay`; 4 in
  `matching.test.ts` pinning the match > unknown > mismatch ordering and the collie; 1 in
  `foster.test.ts` for the no-window branch), 120 → **132**, all green, plus build and lint
  (8 warnings, byte-identical to `main`). **Not verified live, and this one could have been:**
  dev servers cannot be started from an unattended run, so nothing was rendered in a browser.
  Every affected function is pure and every one is now covered, but the visual claim — that
  `.unrecorded` reads correctly on the dark photo overlay in Discovery as well as on cream — is
  reasoned about, not observed. Worth two minutes from whoever is next in front of it.

  Untouched, as the spec's seam said: the photo fallback (RS-6 solved it with `source`),
  `shelterFor()`, `parseLegacyLength()`, `compat()`'s existing three-way, and `ageLabel`'s
  one-month floor — still the one standing lead, now in two places (`dog.ts:66` and
  `DogProfile.ageMonths`).

- 2026-09-13 — PH-21 `[large]` — PR #81 — **The one paragraph a model wrote is now readable by
  the two people who could correct it, attributed everywhere it appears, and retractable.**
  Four parts, all shipped. `ProfileAttribution` + `lib/adoptionSource.ts` is **one line and one
  class** for all three surfaces (`.profile-attrib`, withdrawn as a data attribute) — the shape
  `design-consistency.md` asked for when it saw three views each about to write their own.
  `AdoptionProfileBody` gains a **"The assistant's write-up"** section above the foster's note,
  which lands parts 1 and 2 in one place: both the foster's page and the shared adoption link
  render that body, so the paragraph is not printed twice on the same screen. **That is the one
  deliberate departure from the spec**, which asked for a card in `PostFosterView` as well; what
  the banner at `:70-74` became instead is the disagreement the spec correctly insisted the
  screen must be able to render — `readyForAdoption` lives on `fosters/{uid}` and the text on
  `dogs/{id}`, so with a profile the banner points down the page at the words themselves, and
  without one it says the shelter sees the same blank. `withdraw_adoption_profile` **writes
  rather than clears** and leaves `status` untouched: since RS-12 the write *is* the
  notification, so a blank field would leave a **Back from foster** card with nothing in it —
  the arrival surviving while its content vanished. `Dog.adoption_profile_source` widens to
  `"agent" | "foster_withdrawn"`, and the third state — **absent** — needed a line the spec had
  not named: "Source not recorded", because guessing "the foster" for a pre-field record is the
  same invention the tense test rules out. `server.py`'s prompt gains the correct-or-withdraw
  branch and the instruction never to tell a foster it was taken down. Tests: 4 backend cases
  (`test_adoption.py` 12 → 16), 3 for `attributionFor`, 2 rendered roster cases (115 → 120).
  Build, test, lint (8 warnings, all pre-existing — the pure half moved to `lib/` rather than
  trip `only-export-components`) and pytest all green. **Not verified live**, as the spec said
  to say plainly: producing a `ready_for_adoption` dog at all needs a completed journey on a
  signed-in account.

