# Archive — real-data-and-shelters, 2026-09-02

Verbatim snapshot of two settled sections of
[`../real-data-and-shelters.md`](../real-data-and-shelters.md), taken when that run's own
edits (the application round-trip design answer and RS-11) pushed the working doc past the
README's ~400-line threshold. Both were archived for the same reason the 2026-09-01 one
was: **the reasoning had been restated by the thing it produced.** The photo-source
decision is fully described by RS-6's ledger row and by `dogPhotoOrNull()` in the code,
and RS-6's ledger row is itself the longest in the doc. Archives are append-only — if
something here turns out to be wrong, correct the working doc and say so there.

## Where a hand-entered dog's photo comes from — decided 2026-08-31, built 2026-09-01 (RS-6)

**Decided: the form takes a photo URL, written into the same `photo_urls` the scraper writes.
No uploads.** Firebase Storage is not in this stack (a new SDK surface, a new rules file, a new
deploy target); every dog on the site today is already a hotlinked third-party image, so a
pasted link introduces no practice the app isn't doing. The consequence that mattered most is
built and unit-tested: **the placedog fallback must not fire for a hand-entered dog**, because
a stock photo of some other animal on a real adoptable record is indistinguishable from a photo
the staff member believes they supplied. `dogPhotoOrNull()` keys that on `source`. Uploads, if
ever wanted, are their own item — a `storage` block, rules scoped by `isStaff`, a size cap and
a deletion path — not a widening of RS-6. The full reasoning as first written:

<details><summary>Original design note (2026-08-31)</summary>

RS-6 lets a staff member add a dog by hand, and its spec says the form should mirror
what `scripts/shelters/sfspca.py`'s `to_dog()` produces, so that a typed dog and a
scraped one are the same shape downstream. That holds for every field except one, and
it was unanswered: **there is nowhere for a photo to go.** Read off `main` this run,
not inferred:

- `Dog` carries `photo_urls?: string[]` — "real photos from the source"
  (`web/src/types.ts:89`) — and every row in `data/dogs.json` holds an external CDN
  link (`g.petango.com/…`), hotlinked, never copied.
- `dogPhoto()` (`web/src/lib/dog.ts:85`) falls back to
  `https://placedog.net/800/1000?id=<n>` when `photo_urls` is empty.
- **Firebase Storage is not in this stack.** `storageBucket` is passed through in
  `web/src/firebase.ts:9` only because it arrives in the config blob; nothing calls
  `getStorage`, `firebase.json` has no `storage` block, and there are no storage rules
  to deploy. Adding uploads is not a form field — it is a new SDK surface, a new rules
  file, a new deploy target, and a new class of thing staff can put into the project.

**Decided: the form takes a photo URL — the same field the scraper already writes. No
uploads in RS-6.** A hand-entered dog and a scraped one are then genuinely identical
downstream, which is the entire point of RS-6 as "the second source adapter". It costs
nothing to build and nothing to run, and it introduces no practice the app isn't
already doing: every dog on the site today is a hotlinked third-party image.

Two consequences, both accepted on purpose:

- A pasted URL can rot, and loading it leaks the viewer's IP to whoever serves it.
  Both are already true of all 19 committed dogs. Validate the shape (`https`, and an
  `<img>` that fails falls back to the no-photo state rather than a broken-image
  icon); don't try to solve permanence.
- **The placedog fallback must not fire for a hand-entered dog.** A stock photo of
  some other animal on a real adoptable dog is exactly the "unknown is not a claim"
  failure `CLAUDE.md` describes, and it is worse on a shelter-entered record than on a
  seeded one, because the staff member who typed it will reasonably read a photo
  appearing as "mine uploaded". RS-6 ships a real empty state — a neutral,
  obviously-not-a-photograph tile — for a dog with no `photo_urls`, and leaves the
  placedog path exactly where it is for the seeded roster.

**If uploads are wanted later, that is its own item and not a widening of RS-6.** It
needs a `storage` block in `firebase.json`, rules scoped by `isStaff`, a size and
content-type cap, and a deletion path for when a dog is retired. None of that belongs
in the PR that first lets a shelter add a dog.

</details>


## RS-6's ledger row, verbatim (backfilled to PR #54)

- 2026-09-01 — RS-6 `[large]` — PR #__ — **Add and retire a dog**, at `/shelter/dogs`, behind
  the same staff gate as the inbox. `match /dogs/{dogId}`'s blanket `allow write: if false`
  became `create: isStaff(request.resource.data.shelter_id)` + `update: isStaff(resource.data.shelter_id)`
  with `shelter_id` pinned across the write + `delete: if false`. `useShelterDogs` is one
  equality on `shelter_id` and no `orderBy`, so **no new index**; the pure half is
  `web/src/lib/shelterDog.ts` (16 unit tests, no Firebase import), the writes are
  `shelterRoster.ts`. Two things the spec hadn't seen, both fixed here because leaving either
  would have made the feature wrong rather than incomplete:
  **(1) `scripts/import_dogs.py` would have deleted every hand-entered dog** on its next real
  run — replace-not-append computed staleness as "not in this scrape", and a manually entered
  dog is by construction never in the scrape. It now reads each doc's `source` and keeps
  `shelter-manual` rows, alongside the existing matched-foster exemption.
  **(2) `DogStatus` had no honest value for "retired."** Writing `adopted` to hide a dog would
  be a claim about a real animal nobody made, so `retired` was added to the union and to
  `src/agent/builtin/shelter.py`'s `STATUSES`. `rosterAction()` deliberately offers no relist
  for an `adopted` dog — that is not a checkbox to reopen.
  Photos landed as the design section decided: a URL into `photo_urls`, and `dogPhotoOrNull()`
  returns `null` for a `shelter-manual` dog with none, so all seven photo call sites render an
  empty tile instead of a placedog stand-in of a different animal. **Unverified, honestly:**
  every check that needs a signed-in staff account — the form writing, retire removing a dog
  from Discovery, the rules refusing another shelter's `shelter_id` — could not be run,
  because a Google popup sign-in is not drivable unattended and this session is refused
  production Firestore writes for the same reason RS-5b is parked. Build, tests, lint and the
  design-token guard are green; the rules change itself was never exercised against the
  emulator or production. That belongs with RS-5b and RS-8 as one sitting for a human.
