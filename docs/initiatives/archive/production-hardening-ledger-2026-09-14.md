# Archived from `production-hardening.md` on 2026-09-14

The full ledger rows for **PH-20** (PR #79) and **PH-19** (PR #77), verbatim. Cut under the
README's "the Ledger is the first place to look when a doc is over" rule: both items shipped,
both are restated in the working doc's consolidated tense-test section, and the working doc
crossed 400 when PH-22 was queued. Nothing here is superseded — it is simply no longer the
thing a reader of the queue needs first.

- 2026-09-12 — PH-20 `[large]` — PR #79 — **The one paragraph this app keeps because a model
  wrote it now has to name what nobody recorded.** `generate_adoption_profile` returns a
  seventh key, `missing` — computed the way `adoption.ts:151-156` computes its own, plus the
  two the page doesn't need and the model does — and each entry is a **sentence about what did
  not happen** rather than a field name, for PH-19's reason. `PAWTHWAY_SYSTEM`'s adoption
  paragraph loses the word **"specific"** (the word doing the damage over sparse, nullable
  inputs), keeps "warm", and gains the content guardrail the pickup paragraph already had:
  *"a short paragraph that is true of this dog is correct when the care log is thin; a fuller
  one that is true of some dog is not"*. `send_adoption_profile_to_shelter` writes
  `adoption_profile_source: "agent"` beside the text — **nothing renders it yet, which is half
  of what PH-21 is for**. **The harness needed building before the tests could be written**,
  which the spec had not costed: `tests/conftest.py` had no `update()` and no
  `order_by().stream()`, so neither of this module's two tools could be driven at all — that is
  why `adoption` had no tests, not oversight. The fake's `update()` **raises on a missing
  document** rather than creating one, or a test would pass against a dog nobody seeded.
  `tests/test_adoption.py` is new (12 cases; 34 → 46). Backend and frontend checks green.
  **Not verifiable live by an unattended run** — reaching Post Foster needs a completed journey
  on a signed-in account, so the tests are the verification.

- 2026-09-11 — PH-19 `[large]` — PR #77 — **The Care Plan brief stops asserting things nobody
  recorded, and stops calling training notes medical.** `DogProfile.medicalFlags` → `careNeeds`
  (the name `adoption.ts` already used for the same data) and `weightLbs: number | null`;
  `brief.ts` drops the weight clause when there is no weight and the needs clause when there
  are none. **Omitting the sentence turned out to be necessary and not sufficient**, which is
  the one thing the design answer had not anticipated: the brief closes by telling the model
  never to go beyond what it was given, so a silently-absent field reads as "nothing there"
  just as confidently as "No medical flags." did. So `sayWhatIsMissing()` states each gap as a
  gap — *"The shelter's record for Juniper does not include any care or behaviour needs and a
  weight at intake. That is a gap in the paperwork, not a finding"* — which is the only form
  that is both true and useful to a reader who cannot go and check. The same null weight is
  now guarded on the emergency screen (`:137`, `:178` → "Not recorded"), and `askAbout`'s
  offline fallbacks lose the age claim returned for nine-year-olds ("For a puppy X's age…")
  and the prototype copy shipped to real fosters ("In the real app this would call an LLM…").
  **One false claim found in the code, not in the spec**: `CarePlanView.tsx:45`'s comment
  justified `?? 0` as reading "unknown in the Care Plan header", and no header renders
  `weightLbs` at all — the only two readers were the emergency screen and the brief, and both
  printed the zero as a fact. `brief.test.ts` is new (9 cases; 106 → 115), covering the three
  shapes with no coverage plus the multi-gap sentence. Build, test and lint green, no new
  warnings. **Not verified live** — Care Plan needs a sign-in this loop can't do; the brief is
  a pure function and is covered by tests instead.

