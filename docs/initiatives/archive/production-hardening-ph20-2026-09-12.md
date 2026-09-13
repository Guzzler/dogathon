# PH-20 — the queue entry, verbatim (archived 2026-09-12, the run it shipped)

Written 2026-09-12 by `dogathon-plan`, built and shipped the same day as PR #79. Archived
under the README's rule that a shipped item's spec and its ledger row are two tellings of one
story: the row in `production-hardening.md` is the shorter, and this is the longer.

- **PH-20 `[large]` — the one paragraph this app keeps because a model wrote it.** The
  grounding is the design section above; this is the build. Three changes plus tests, in one
  PR, because none of them is safe alone — a prompt told to name gaps with no gaps in its
  input will name none, and a tool that reports gaps to a prompt still asking for "specific"
  will have them written around.
  1. **`src/agent/builtin/adoption.py` — `generate_adoption_profile` returns what is
     missing.** Add a `missing: list[str]` alongside the three raw keys, computed the way
     `web/src/lib/adoption.ts:151-156` computes its own: no journal photos, no journal notes,
     no ticked care items, no weigh-in or vet visit, no `adoptionNote`. Extend it with the two
     the frontend does not need and the model does — the dog's own `needs` being empty, and no
     weight from either source. **Phrase each entry as the gap it is, not as a field name**
     ("no weigh-in was ever logged", not `"weight"`), for the reason PH-19's row records:
     `sayWhatIsMissing()` had to state a gap as a gap because a bare absence reads as "nothing
     there". Update the docstring, which currently promises only "raw materials".
  2. **`src/agent/server.py` — the adoption paragraph of `PAWTHWAY_SYSTEM` (`:94-104`) gets
     the content guardrail the pickup paragraph already has.** Keep "warm"; **drop or qualify
     "specific"**, which is the word doing the damage. Say plainly that everything in the
     profile must come from the tool result, that the `missing` list is what the foster and
     shelter never recorded and must be described as unrecorded rather than filled or skipped
     silently, and that a short honest paragraph is correct when the care log is thin. Do not
     add a fourth clause to the pickup or care paragraphs in this PR.
  3. **`src/agent/builtin/adoption.py` — `send_adoption_profile_to_shelter` writes a
     provenance field beside the text.** `adoption_profile_source: "agent"` on the same
     `update()` (`:63`), so the paragraph on `ShelterRosterView.tsx:237` is distinguishable
     from anything a human later writes into that field. One optional field on `Dog` in
     `web/src/types.ts`, nothing rendering it yet — the roster's own labelling is a separate,
     smaller item and should not be bundled here.
  4. **Tests.** `tests/test_adoption.py` is new — the `adoption` module has none, and the
     harness for this has existed since PH-9 (`tests/conftest.py`'s in-memory Firestore fake;
     no ADC, key or network). Cover: a dog and foster with nothing logged produces all seven
     `missing` entries; a fully-logged one produces none; a partially-logged one produces
     exactly the right subset; `send_…` writes `adoption_profile_source`; and the existing
     `notified_shelter`/`arcade_messaging_available` split still reports separately.
  **Verify** with `uv run pytest` (green, count up from 12). **There is no Python linter to
  run** — the `backend` job is `uv sync --locked`, `import agent.server`, `compileall` and the
  test step, checked this run rather than assumed, so don't add a `ruff` invocation to the
  verification and don't read its absence as licence to skip the import check locally. **Not verifiable live by an unattended run**: reaching Post Foster needs a
  completed foster journey on a signed-in account, so the tests are the verification and the
  ledger row should say so in those words rather than hedging. **Two traps, both measured this
  run rather than guessed.** (a) The `dog` object `generate_adoption_profile` returns is
  `snap.to_dict()` and nothing else (`shelter.py:48-51`) — it is **not** `normalizeDog()`'s
  enriched shape, so every field `web/src/lib/dog.ts` *derives* is simply absent here rather
  than defaulted. Compute `missing` from what Firestore actually holds; a `KeyError` on a
  frontend-only field name is the cheap failure, and a silently-empty `missing` list is the
  expensive one, since it would report "nothing is missing" about a dog with nothing recorded.
  (b) `profile_text` is stored with **no way to correct or retract it** — nothing in the app
  clears `adoption_profile`, and RS-6's update rule pins `shelter_id` but says nothing about
  this field. Adding a retraction path is out of scope and is the natural follow-up item; note
  it in the ledger row rather than building it.
