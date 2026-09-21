# PH-26 spec, verbatim — archived 2026-09-20 when it shipped

Snapshot of the queue entry from `production-hardening.md` at the moment execute shipped it. The Ledger row there is the account of what actually shipped; this is what was asked for.

- [ ] **PH-26 `[large]` — the agent's two foster-writing tools stop routing around the app's own
  rules** (queued 2026-09-20; design answer directly below). Both live in
  `src/agent/builtin/foster.py` and both are reachable today by any signed-in foster in Match,
  Care Plan or Post Foster, behind nothing but the approval modal — whose copy for each
  (`toolLabels.ts:57-62`) describes a far smaller write than the one that happens.
  1. **`record_swipe(liked=True)` is an application the shelter never receives.** It writes
     `matchedDogId` and `phase: "match"` (`foster.py:132-135`) and nothing else. Both UI apply paths
     (`SavedView.tsx:113-125`, `DogDetailView.tsx:50-63`) do that *and* `createApplication()` —
     the document RS-5's inbox and RS-10/11's checklist join read. So an agent "like" puts a foster
     on the Match screen for a dog **no shelter account can see they applied for**; it skips
     `needsAccountToApply()` and `activeApplication()`'s one-foster block; and in Care Plan it
     swaps `matchedDogId` out from under the dog currently living in the foster's home. **Fix:** a
     like writes `likedDogIds` only — exactly what Discovery's swipe writes (CLAUDE.md, "Where
     liking becomes matching") — and the docstring stops saying a like "moves the foster into the
     Match phase". Committing to a dog stays a UI act with a confirm sheet. Do **not** teach the
     tool to create an application: a second write path for one record is where PH-17 found four.
  2. **`save_intake` answers six questions whether or not it was asked any of them, and sends the
     journey back to Discovery.** Every omitted argument defaults to `""` and is written
     (`foster.py:103-110`) — including `time_availability`, which PH-24 removed because nothing asks
     it — so "I'd prefer a smaller dog" blanks the foster's home, experience and restrictions. It
     writes the size **word** without `pref_size`, so the Hub, Discovery and `scoreDog` keep showing
     the old answer while `get_foster()` returns the new one. And `"phase": "discovery"`
     (`foster.py:111`) takes a foster in Match or Care Plan out of the phase their matched dog
     depends on — `activeApplication()` returns null, so the one-foster block lifts. **Fix: remove
     the tool.** Registration is by decorator; also drop it from `DEFAULT_DANGEROUS`
     (`AgentChatPanel.tsx:15`) and both `toolLabels.ts` entries (`:17`, `:59`) in the same PR, or
     the UI keeps a label for a tool the server no longer has.
  3. **Rider — the filter sheet writes half an answer.** `FilterSheet.save`
     (`DiscoveryView.tsx:125-127`, called at `:160`/`:167`) writes `pref_size`/`pref_energy` and
     never the word beside it. **Correction to the lead this doc carried on 2026-09-19**: the Hub
     card does *not* print from the word — it reads `prefs()` like everything else, so every screen
     agrees. The one reader of the word is **the agent**, through `get_foster()`, so moving the
     slider leaves the model answering "you wanted a large dog" to a foster every screen calls
     Small. Fix: one helper in `web/src/lib/matching.ts` (beside `prefs()`) that returns both halves
     of a size or energy answer, used by `OnboardingView.tsx:81-82` and `FilterSheet`; delete both
     copies of `sizeWord` (`OnboardingView.tsx:12`, `DiscoveryView.tsx:13`). CLAUDE.md's "keep
     writing both" rule stands — this makes it one write instead of a rule to remember.

  **Done means:** `uv run pytest` green with new cases in `tests/` (the `fake_db` fixture in
  `conftest.py`): a liked `record_swipe` on a foster with `matchedDogId: "d-1", phase:
  "care_plan"` leaves both untouched and adds to `likedDogIds`; `save_intake` is absent from the
  registry that `builtin/__init__.py` builds (assert on its tool names). `npm test` green with a
  case that a filter-sheet size change writes `pref_size` **and** `size_preference` and the two
  agree; `./node_modules/.bin/tsc --noEmit`, `npm run build`, `npm run lint` (same 8 warnings as
  `main`). `grep -rn save_intake src web/src` returns nothing. CLAUDE.md names `save_intake` in
  "New agent tool modules" — that line is not this loop's to edit; say so in the PR body so
  Sharang can. Not verifiable live unattended: the agent needs a signed-in token.
