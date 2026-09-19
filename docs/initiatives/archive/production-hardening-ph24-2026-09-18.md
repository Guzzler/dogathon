# PH-24, verbatim — archived 2026-09-18, the run it shipped

Both halves of PH-24 as they stood in `production-hardening.md` before PR #__ merged: the queue
spec (queued 2026-09-18) and the design section that argued it, "The fifth face: what an input
*control* may record". Archived together per the README's rule that after a `[large]` item ships,
its design answer and its Ledger row are two tellings of one story — keep the shorter. Read this
before changing what onboarding writes, or before deciding that a form may persist a control's
resting position.

## The queue spec

- **PH-24 `[large]` — the questionnaire records two answers the foster may never have given, and
  a third to a question it never asked.** Queued 2026-09-18. Measured this run by asking which of
  the five phases had never been put through the tense test: Discovery (PH-22), Care Plan (PH-18,
  PH-19), Post Foster (PH-20, PH-21) and Match (PH-23) all had. **Onboarding had not**, and it is
  the one surface that *writes* rather than renders.

  **The root, and it is three lines.** `OnboardingView.tsx:45-46` opens the size slider at `50`
  and the energy slider at `2`. `:53`'s `canNext = [!!experience, true, true, !!home, true, true]`
  makes steps 1 and 2 — the two sliders — advanceable **without being touched**, while the two
  pill questions (experience, home) are correctly required and the tag step is honestly optional
  (`[]` really is "none selected"). `finish()` at `:73-74` then writes `pref_size: sizePref` and
  `pref_energy: energyPref` **unconditionally**. A foster who tapped Continue twice has "Medium"
  and "A daily walk, then settle" in Firestore as answers.

  **And `:69` is worse, because the question does not exist.** `time_availability` is derived
  from the energy slider — `energyPref >= 3 ? "A lot (home most of the day)" : "A little (WFH some
  days)"`. Onboarding never asks about time. `get_foster()` (`foster.py:65-77`) returns the whole
  document, so **the agent is told how much of the day a foster is home** on the strength of a
  slider they may not have moved, answering a question nobody put to them. `size_preference` and
  `energy_preference` at `:70-71` are the same defaults in a second shape.

  **The five read sites, enumerated — this is the census, and per eight runs of precedent, verify
  it against `main` before building:**
  1. `HubView.tsx:137-138` — the "What you're looking for" card prints the size bucket and
     `${ENERGY_WORD[p.energy]} energy` as chips under a heading that says these are the foster's
     answers. A **labelled row**, so the 2026-09-14 rule applies at full strength.
  2. `matching.ts:93` — `"exactly the pace you picked"`, and `:91` `"right in your size range"`.
     PH-22 guarded both on `knownSize`/`knownEnergy`, which are properties of the **dog**; the
     `p.size`/`p.energy` half was never guarded. This is the "second reader" rule from PH-20
     arriving from the other side of the same comparison.
  3. `matching.ts:39-40` — `scoreDog`'s two largest terms. Ranking, not an answer, so per the
     2026-09-14 rule the number needs no absent state — but `UNKNOWN_SIZE`/`UNKNOWN_ENERGY`
     (`:30-31`) exist for exactly this and currently only fire on the dog side.
  4. `DiscoveryView.tsx:142-146` — the filter sheet's sliders, under the sentence **"Straight from
     your questionnaire."** The sliders themselves are controls and stay where they are (geometry);
     the sentence is the claim.
  5. `OnboardingView.tsx:199-201` — the summary screen's own chips, which show "Medium" back to a
     foster as something they said, one tap before it is written.

  **What to build.** Track whether each slider was moved (two booleans in `OnboardingView`'s
  existing `useState` block is enough — the sliders keep their resting positions and nothing about
  how the step looks or feels changes), and **omit** `pref_size` / `pref_energy` / `size_preference`
  / `energy_preference` from the written `intake` when they were not. **Omit `time_availability`
  entirely, always** — it answers an unasked question and no amount of touch-tracking makes it
  true; adding a sixth step to ask it is out of scope and its own item. Then branch the five sites
  on the field's presence: `Unrecorded` for (1), the existing idiom and now four-for-four per
  `design-consistency.md`; **silence** for (2), per `matchReasons()`' own comment that a sentence
  never owed gets no `Unrecorded`; the existing `UNKNOWN_*` constants for (3); and for (4) a
  sentence that does not claim the questionnaire supplied an untouched slider. (5) is a judgment
  call for execute — showing the resting value back before writing it is arguably the moment it
  stops being untouched, and either answer is defensible if the row is written down.

  **Do not** make `FosterIntake`'s fields non-optional, do not add a `derived` bag (see the design
  section above for why this case is the opposite of PH-22's), and do not touch `firestore.rules` —
  nothing here changes who may write what.

  **Verification.** `npm test` (149 today; `matching.test.ts` has 12 cases and is where the
  `prefs()` half belongs), `npm run build`, `./node_modules/.bin/tsc --noEmit` — **not** `npx tsc`,
  which resolves to an unrelated `tsc@2.0.4` — and `npm run lint` diffed against `main` for the
  same 8 warnings. `uv run pytest` should be unchanged; if `foster.py` moves at all, say why. The
  case that proves it: an intake written by tapping Continue through both sliders has neither
  `pref_size` nor `time_availability` as keys, the Hub renders `Unrecorded` rather than "Medium",
  and `matchReasons()` returns no size or pace sentence.

## The design section

### The fifth face: what an input *control* may record (2026-09-18)

The four faces above ask what a page may print, what a model may be told, what a model may
assert, and who is shown the assertion. All four watch a value **leaving** the app. This one
watches a value **arriving**, and it is the first that does not involve a dog at all — the
claim is about the **foster**.

> A control has to render somewhere. A slider has a thumb, a stepper has a number, a range
> input at rest sits where its `useState` put it. That resting position is geometry, exactly as
> `size: "medium"` is. **It becomes a claim at the moment it is written down** — because a
> stored `pref_size: 50` is indistinguishable from a foster who dragged the slider to the
> middle on purpose, and every reader downstream is entitled to read it as an answer.

So the rule, stated to be reusable against the next form somebody builds:

> **A default a control renders is a fallback; the same default persisted is an answer.** A form
> may only write a field the person actually supplied. Where it cannot tell, it must omit — not
> annotate.

**Why omit rather than annotate, when PH-22 annotated.** PH-22 could not omit: `RichDog.size`
and `RichDog.energyLevel` are non-null because layout genuinely needs them, so the only place
the provenance could live was a sibling `derived` set. `FosterIntake` has the opposite shape —
`pref_size`, `pref_energy` and all four siblings are **already optional** (`types.ts:149-153`),
`prefs()` **already** supplies `?? 50` / `?? 2` for ordering, and the agent's `save_intake`
already defaults each of the six strings to `""`. Absence is representable at every layer;
nothing is asking to be annotated. The generalisation worth keeping:

> **Prefer absence to annotation wherever the schema can already carry absence.** A `derived`
> bag is what you build when it cannot. Reaching for one first adds a parallel vocabulary to a
> field that was nullable all along.

**The consequence that makes this worth a run rather than a two-line patch.** `prefs()`'s
`?? 50` / `?? 2` has a comment calling it an intake default "so a foster who skipped onboarding
still gets sensible ordering" — and it can never fire for a foster who *finished* onboarding,
because `finish()` writes both fields unconditionally. The fallback the codebase believes it
has is dead code, and the defaults reach the render sites as recorded values instead. Fixing
the write is what turns the existing fallback back on; the render sites are then branching on a
field that is genuinely sometimes absent, for the first time.
