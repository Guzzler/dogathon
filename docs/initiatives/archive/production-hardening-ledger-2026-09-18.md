# Archived 2026-09-18 — `production-hardening.md`'s PH-22 and PH-21 Ledger rows, verbatim

Cut from the working doc to make room for PH-24. Both rows were already one-paragraph
compressions of the fuller text in
[`production-hardening-ledger-2026-09-17.md`](production-hardening-ledger-2026-09-17.md), which
is where to read them at full length; this file preserves the intermediate compression the
working doc carried between 2026-09-14 and 2026-09-18.

- 2026-09-14 — PH-22 `[large]` — PR #83 — **`normalizeDog()` still fills the three holes a card's
  layout needs, but it now writes down that it had to, and nine surfaces stopped printing the
  filling as the shelter's answer.** `RichDog` gains `derived: {fosterWeeks, size, energyLevel}`,
  resolved to `null` first and defaulted second, so "did anyone record this?" survives the
  defaulting. Rendering goes through **one** component (`components/Unrecorded.tsx` + one class) —
  the shape `design-consistency.md` asked for — while `matchReasons()` says *nothing* rather than
  "Not recorded": a slot promised a value gets the component, a sentence never owed gets silence.
  The sharp half: `foster_weeks` is absent on **all 19** roster dogs, so every countdown this app
  has ever shown a foster was arithmetic from a constant. In scoring, `compat()`'s three-way moved
  one layer earlier (unknown size `0`, unknown energy `-4`), and the case that makes it concrete is
  a dog named "Border collie" with no `energy_level` that `guessEnergy()` scored 4 and which then
  paid both the apartment and the first-timer penalty on the strength of its name.
  **Re-verifying the spec against `main` paid for an eighth consecutive run, this time on the
  census**: it named seven read sites and there were nine — the miss being `AdoptionProfile.tsx:48`,
  the shared adoption link, the one surface a stranger reads when deciding about a real animal.
  Two **stated contracts that were false** are corrected in place (`shelterDog.ts`'s and
  `types.ts`'s claim that `normalizeDog()` "already knows how to render" an absent key), as is
  `matching.ts:50`'s citation of a `score >= 45` cutoff in `DiscoveryView` that **has never
  existed**. Tests 120 → **132**, all green, plus build and lint. **Not verified live, and this one
  could have been** — every affected function is pure and covered, but that `.unrecorded` reads
  correctly on Discovery's dark photo overlay is reasoned about, not observed. One standing lead:
  `ageLabel`'s one-month floor, in two places (`dog.ts:66`, `DogProfile.ageMonths`).

- 2026-09-13 — PH-21 `[large]` — PR #81 — **The one paragraph a model wrote is now readable by the
  two people who could correct it, attributed everywhere it appears, and retractable.**
  `ProfileAttribution` + `lib/adoptionSource.ts` is **one line and one class** across all three
  surfaces. The **one deliberate departure from the spec**: instead of a second card in
  `PostFosterView`, the paragraph lands once in `AdoptionProfileBody` — both the foster's page and
  the shared link render that body, so it is not printed twice on one screen, and the banner became
  the disagreement the spec insisted the screen must be able to render (`readyForAdoption` lives on
  `fosters/{uid}`, the text on `dogs/{id}`). `withdraw_adoption_profile` **writes rather than
  clears** and leaves `status` untouched: since RS-12 the write *is* the notification, so a blank
  field would leave a **Back from foster** card with nothing in it. The third state — the field
  simply **absent** — needed a line the spec had not named: "Source not recorded", because guessing
  "the foster" for a pre-field record is the same invention the tense test rules out. Tests 115 →
  120 plus 4 backend cases; all green. **Not verified live**: producing a `ready_for_adoption` dog
  needs a completed journey on a signed-in account.

