# production-hardening — Ledger rows for PH-17, PH-19, PH-20 (archived verbatim 2026-10-08)

Moved out of `production-hardening.md`'s Ledger to make room for PH-32's spec. The text below is
exactly as it stood at `306e2d6`.

- 2026-09-12 — PH-20 `[large]` — PR #79 — **The one paragraph this app keeps because a model
  wrote it now has to name what nobody recorded.** `generate_adoption_profile` returns a seventh
  key, `missing`, each entry a *sentence about what did not happen* rather than a field name;
  `PAWTHWAY_SYSTEM` loses the word **"specific"** and gains the pickup paragraph's content
  guardrail; `send_adoption_profile_to_shelter` writes `adoption_profile_source: "agent"`. **The
  harness needed building before the tests could be written**, which the spec had not costed —
  `conftest.py` had no `update()` and no `order_by().stream()`, which is why this module had no
  tests at all. The fake's `update()` **raises on a missing document**, or a test would pass
  against a dog nobody seeded. Not verifiable live by an unattended run.

- 2026-09-11 — PH-19 `[large]` — PR #77 — **The Care Plan brief stops asserting things nobody
  recorded, and stops calling training notes medical.** `medicalFlags` → `careNeeds`,
  `weightLbs: number | null`, and the clauses drop when the values are absent. **Omitting the
  sentence was necessary and not sufficient** — the brief's closing instruction makes silence
  read as "nothing there" — so `sayWhatIsMissing()` states each gap *as* a gap, the only form
  both true and useful to a reader who cannot go and check. **One false claim found in the code
  rather than the spec**: `CarePlanView.tsx:45`'s comment justified `?? 0` as rendering in a
  header that does not exist; both real readers printed the zero as a fact. 9 new tests.

*(Both rows above are one-paragraph compressions. The full text — PH-20's account of the
harness and PH-19's of the offline-fallback copy it also removed — is verbatim in
[`archive/production-hardening-ledger-2026-09-14.md`](archive/production-hardening-ledger-2026-09-14.md).)*

- 2026-09-10 — PH-17 `[large]` — PR #75 — **A demo dog's past no longer reaches a real
  foster's document, or the adoption page.** `data.ts` splits by the tense test; the seed moves
  to `data.demo.ts` behind `LOCAL_MODE`. **All four write paths were gone, not the two the spec
  named** — the first note a foster wrote had been saving the whole invented past underneath it.
  Two things the spec had wrong, both expensive: `adoption` had no tests to add cases to, and
  `medical` needed a *source designed* rather than chosen, so it is now built from ticked
  schedule rows and `vet_visit` entries, `null` when empty, with **allergies not rendering at
  all** ("None reported" is a clean bill of health nobody gave). Full 28-line row verbatim in
  the [2026-09-11 ledger archive](archive/production-hardening-ledger-2026-09-11.md).


## PH-27 and PH-28 + PH-29 + PH-30 (also archived verbatim 2026-10-08)

- 2026-09-21 — PH-27 `[large]` — PR #98 — The agent writes only the dog its foster has.
  `update_dog` is gone from `shelter.py`, `DEFAULT_DANGEROUS` and both `toolLabels.ts` entries;
  `adoption.py`'s new `_own_dog()` reads the resolved foster and raises before any write —
  `ValueError` with no `matchedDogId`, `PermissionError` for any other id — and an omitted `dog_id`
  now means the matched dog. **No phase gate**: `/post-foster` (`App.tsx:100`) and `PostFosterView`
  gate on `matchedDogId` alone, so a phase rule would have been a guard no screen has. Withdraw
  refuses unless `adoption_profile_source` is `agent`/`foster_withdrawn`. Riders: `log_care_entry`
  checks `ENTRY_TYPES`; `list_dogs` excludes an unknown weight under a limit and reads `status` and
  `good_with_kids` with `.get()` too (same `KeyError`, same RS-6 form — slightly past the spec).
  Two existing tests changed meaning rather than broke: "refuses an unknown dog" now expects
  `PermissionError` (the ownership check fires before the existence check), and
  `test_approval_store.py`'s opaque name is now `record_swipe`. 71 pytest (10 new cases), 168
  vitest, build green, lint 8 warnings as on `main`. **Not verified live** — the agent needs a
  signed-in token; reasoned from the tests and the route, not observed.
- 2026-09-26 — PH-28 `[large]` + PH-29 + PH-30 — PR #104 — **an org we can't name is absent, not
  hashed onto a real rescue, and a dog with no org isn't listed.** `shelterFor(id)` returns
  `Shelter | null`; `RichDog.shelter` is nullable (`RichDog` now extends `Omit<Dog, "shelter">`, since
  `Dog.shelter` is `undefined`-optional); `isListable()` gates Discovery; `shelterName(dog, form,
  { start })` gives "the shelter"/"The shelter" for sentences — the `start` option is beyond the spec,
  because six of the sites open a sentence or a badge with the name. Map, swipe chip, distance, **Find
  at** card and the adoption page's contact card omit on `null`; `shelterRecordTitle()` titles the
  record. **Beyond the spec, from its own third symptom:** both apply sites (`DogDetailView`,
  `SavedView`) disable **Apply** as "Not taking applications" on `null`, since a saved dog or a deep
  link still reaches an unlisted one; Match shows a plain notice instead of `PickupScheduler` (no
  address to collect from); `CarePlanView` passes no shelter so Emergency's existing guard skips the
  card. Importer: a stale `available` dog kept for a foster is batch-`update`d to `retired` and the
  plan line says `(delisted: [...])`; already-unlisted statuses are left alone. PH-29: the demo intro
  no longer dates the roster or says "all"; "near you"/"nearby" → "in San Francisco" at the five named
  sites plus two more in the same Discovery states, and `DiscoveryView` drops the now-unused `real`.
  PH-30: `SignInToApply` says answers carry over *on a first sign-in* — `migrateGuestData()` skips when
  `fosters/{uid}` exists, so an unqualified promise would be false for a returning user. Verified: 190
  vitest (8 new: `shelterFor` null for `petsun`/unknown/undefined, no `SHELTERS[h` in the source,
  `shelterName` both ways, `normalizeDog`/`isListable` on `petsun` vs `sfspca-mission`,
  `shelterRecordTitle`), 76 pytest (3 new, against a fake Admin client: kept-and-retired, unmatched
  still deleted, `plan_only` writes nothing), `tsc -b`, build, lint at `main`'s 8. **Not verified:**
  any of it in a browser — the unattended run can't start a dev server. `CLAUDE.md`'s "`shelterFor()`
  remains only as the fallback for seeded records" is now stale; not this loop's file.
