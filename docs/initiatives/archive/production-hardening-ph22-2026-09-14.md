# PH-22 — queue entry, verbatim (queued 2026-09-14, shipped 2026-09-14)

Archived when PH-22 shipped, per the README's doc-size rule: the Ledger row in
`production-hardening.md` is now the account of what was built, and this is the account of what
was *measured* before it was. The design section it sits under ("A default is honest when it is
a fallback for the layout, and dishonest when it is an answer") stays in the working doc,
because that is the rule rather than the build instructions.

Two things in the spec below turned out to be incomplete, both found by re-verifying it against
`main` before building rather than after — see the Ledger row:

- The read-site list names seven sites; there are **nine**. It misses
  `AdoptionProfile.tsx:48` (the shared adoption link a stranger reads) and
  `DogDetailView.tsx:94` (the subhead), and counts `DogDetailView.tsx:152`
  ("First-time friendly", derived from `energyLevel`) as neither.
- `MapView.tsx:81`'s "easy" sort filters on `energyLevel <= 2`, which is a claim wearing a
  filter's clothes. Not named anywhere in the spec.

Everything else re-read exactly, including the coverage figures (`foster_weeks` 0/19,
`foster_length` 0/19, `size` 19/19, `energy_level` 19/19 — re-counted against `data/dogs.json`)
and the dead `score >= 45` cutoff at `matching.ts:50`.

---

- **PH-22 `[large]` — the absence both writers carefully record is erased by the layer that
  renders it.** *(Queued 2026-09-14. This doc owns it for the same reason it owns PH-17/19/20/21
  — truthfulness — and not because production-hardening has been re-ranked; see the routing note
  at the top of this queue. It lands on Discovery, which is Eesha's phase: `gh pr list --state
  open` was empty when it was queued, but check again before building.)*

  **The measurement, so nobody rebuilds it.** Both dog-writing paths omit rather than null a
  field they have no value for — `dogFromForm()` (`web/src/lib/shelterDog.ts:124-157`, asserted
  by `shelterDog.test.ts:87`) and the importer's `to_dog()`. `normalizeDog()`
  (`web/src/lib/dog.ts:48-70`) then fills five of those absences with confident values:
  `foster_weeks` -> **6** and `"6 weeks"` (`:49`, `:62-63`); `size` with no weight ->
  **`"medium"`** (`:53`); `energy_level` -> `guessEnergy()` (`:31-38`), a **breed regex** —
  `collie|husky|terrier|shepherd|russell|cattle` scores 4 — plus age thresholds; `photo` -> a
  hash of the dog's **id** into a placedog stand-in; `shelter` -> `shelterFor()`.

  **Coverage against the committed roster** (`data/dogs.json`, 19 dogs): `foster_weeks` **0/19**
  and `foster_length` **0/19**, so *every dog in the real roster* renders "6 weeks" — and once
  `pickup.date` exists, `fosterWindow()` (`lib/foster.ts:73`) turns that 6 into a **countdown, a
  progress bar and an end date**: "12 days left", "Last day", "3 days over". A date a real foster
  plans around, arithmetic all the way down from a constant. By contrast `size` and
  `energy_level` are **19/19**, supplied by `enrichment.json` from the shelter's own write-up —
  so those two derivations never fire on the scraped roster and *do* fire on a dog a shelter
  types in through RS-6, which is the inverse of where you would want them.

  **Read sites** (the "answer" half, every one of them a labelled row or prose):
  `SwipeDeck.tsx:163` (`{fosterLength} foster`), `DogDetailView.tsx:98` and **`:153`** (a
  `Row k="Foster length"`), `SavedView.tsx:140` and `:166`, `HubView.tsx:88`,
  `PostFosterView.tsx:48`. Plus `matchReasons()` (`matching.ts:68-84`), which renders the derived
  values as sentences to the foster — *"Zoomies energy, exactly the pace you picked"*,
  *"Medium — right in your size range"*, *"An easy first foster"*.

  **The sharp half: the honesty is downstream of the erasure.** `compat()` (`matching.ts:17`)
  scores an unknown **−4 rather than −26**, deliberately, and `:40-42` do the same for grooming
  and coat. But `scoreDog` takes a `RichDog`, so `d.size` and `d.energyLevel` **cannot be unknown
  by the time it runs** — and those two feed the largest terms in the score
  (`22 - |pref - size|*0.4` and `22 - |pref - energy|*11`, against a base of 52). The documented
  care applies only to the four fields the normaliser leaves alone.

  **One stale claim to correct inside this diff.** `matching.ts:50` justifies the −4 by *"the
  score >= 45 cutoff in DiscoveryView"*. **There is no cutoff.** `DiscoveryView.tsx:34-35`
  carries the opposite comment — *"No match-score cutoff: the real roster is small, so a weak
  match still beats no dog at all"* — and `:36-38` filter on the search string only, then sort.
  The −4 is still correct; its reason is **ranking**, not admission, and the comment should say
  so. *(`CLAUDE.md` repeats the same dead cutoff under "Unknown is not a claim". A sentence to
  Sharang, not a doc edit — this loop does not edit that file.)*

  **The seam, deliberately narrow.** PH-22 touches `foster_weeks`/`foster_length`, `size` and
  `energy_level` only. It does **not** touch the photo fallback (RS-6 solved that half with
  `source`, and `dogPhotoOrNull()` is the precedent this item follows rather than a problem to
  fix); it does **not** touch `shelterFor()`, documented as the seeded-demo fallback and already
  declined by `dogFromForm()` rather than invented; it does **not** touch `parseLegacyLength()`,
  which reads a value someone actually wrote; it does **not** widen `compat()`'s existing
  three-way; and it does **not** touch `ageLabel`'s one-month floor, the lead left standing above.

  **Verify** by rendering Discovery, a dog profile, Saved and the Hub against the committed
  roster — where `foster_weeks` is absent on all 19 — and reading every surface for a duration, a
  size or an energy word still claiming to be recorded, including after setting a `pickup.date`
  so the countdown branch runs. Unit tests are the real verification, since every affected
  function is pure: `fosterWindow` with no total, `scoreDog` and `matchReasons` with an unknown
  size and an unknown energy, and `normalizeDog` over a record carrying none of the three. Say
  plainly in the ledger row what was and was not observed live.
