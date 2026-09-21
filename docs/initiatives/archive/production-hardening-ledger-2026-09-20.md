# Production hardening — ledger rows archived 2026-09-20

Verbatim from `production-hardening.md`, moved when PH-26 was queued. The working doc keeps a
one-paragraph compression of each.

- 2026-09-18 — PH-24 `[large]` — PR #91 — **onboarding stopped recording answers nobody gave.**
  `OnboardingView` tracks whether each slider was moved and omits `pref_size`/`size_preference`
  and `pref_energy`/`energy_preference` when it was not; `time_availability` is gone entirely,
  because it was derived from the energy slider and the questionnaire has never asked how much
  of the day anyone is home. A foster who taps Continue twice no longer has "Medium", "A daily
  walk, then settle" and "A little (WFH some days)" in Firestore as things they said — and the
  third of those was reaching the agent through `get_foster()`. Four things the build
  established that the spec did not name:
  - **The spec's five-site census was right, and that is the first time in nine runs of
    re-verification that it was.** Eight consecutive runs had paid for the habit by finding a
    census short. This one did not, which is the argument for keeping the habit rather than
    against it: the cost of checking is one read per site.
  - **The fix needed a *third* flag per field, not a second.** `scoreDog` and `matchReasons`
    each had one `knownSize`/`knownEnergy` meaning "the dog's half was recorded" (PH-22), and
    the obvious move — AND the foster's half into it — was wrong for six of the eleven rules
    that read it. "Too big for an apartment" and "an easy first foster" compare the dog against
    the **home** or the **experience level**; an untouched size slider says nothing about either,
    and folding it in would have silenced sentences the foster had genuinely earned. So the two
    comparison terms and the two size/pace sentences take both halves, and everything else keeps
    `dogSize`/`dogEnergy`. **A guard added one layer up is not automatically the same guard.**
  - **The summary screen's judgment call went to omission, not `Unrecorded`.** It is headed
    "Based on your answers" and renders a chip *list*, not labelled rows — there is no slot to
    leave empty, and showing "Medium" back one tap before writing it is precisely how a resting
    position becomes a decision. `Unrecorded` is four-for-four elsewhere and is what the Hub's
    labelled card uses, which is the distinction: **a list omits, a labelled row renders the
    absence.**
  - **Discovery's filter sheet needed new copy, not a deleted sentence.** "Straight from your
    questionnaire" is false over an untouched slider, but the sliders there *write on change*, so
    the honest alternative can say what the control does: "Anything you didn't answer starts in
    the middle — moving it here records it."

  Verified: 153 tests (149 + 4 new in `matching.test.ts`), `tsc --noEmit` clean, `npm run build`
  green, `npm run lint` at the same 8 warnings as `main`. Backend untouched — `foster.py`'s
  `save_intake` still defaults its six strings to `""`, which is a different shape of the same
  question and is **not** fixed here. The retake path is the note left above for `dogathon-plan`.

- 2026-09-17 — PH-23 `[large]` — PR #89 — **the pickup handoff stops speaking for the shelter.**
  All six claims in the census went, each with a replacement rather than a deletion (PH-18's rule):
  `CLOSED_DAYS` and "Closed Sundays & Mondays" are gone and the footnote says
  `Unrecorded`'s one phrasing — *"SF SPCA's opening days and times not recorded"* — followed by the
  booking window **in Pawthway's own voice** ("Pawthway takes requests from 2 days out to 28 days
  ahead"), never "shelters need"; `TIME_SLOTS` stays a chooser and the confirm verb is **Request**;
  `MatchView`'s card says *"You asked for this time. SF SPCA hasn't confirmed it"* with **Change
  request** replacing **Reschedule**; `calendar.ts`'s DESCRIPTION drops the bring-list and the
  "about 30 minutes" and says the slot is still a request, while `durationMinutes ?? 45` **stays**
  because a `DTEND` is geometry; `server.py` loses the two enumerations, keeps "speak generally",
  and gains an instruction never to confirm the slot on the shelter's behalf — the model was being
  told to answer in the shelter's first-person plural about a time no shelter had seen.
  **Two things the spec had not named.** The census was one short: the same sentence in `server.py`
  carried a *third* parenthetical, and leaving it while cutting its two neighbours would have
  reproduced the exact failure the item diagnosed. And `SavedView` drew the same timeline from a
  byte-identical duplicate of `STAGES`/`activeIdx`, so relabelling one screen would have made the
  two disagree — both now read `APPLICATION_STAGES` and `activeStage()` from `applicationView.ts`,
  which is the DC note about one class for one claim applied to a literal. Saved's badge and
  copy ("Approved — request a pickup", "ask them for a pickup time") and the Hub and Care Plan
  pointers into Match moved with it, because a screen that says "schedule pickup" and a screen that
  says "request" are the same disagreement one level out.
  **Verified**: `npm run build`, `npm test` (**149 passed**, 7 new — 4 rendered `MatchView` cases
  in the existing `renderToStaticMarkup` style, 3 `pickupIcs` cases), `./node_modules/.bin/tsc
  --noEmit`, `npm run lint` (8 warnings, the same 8 as `main` — diffed against a stash), and
  `uv run pytest` 55 passed. A dev server cannot be started from an unattended run: what is proven
  is the **markup and the strings**, not how the calendar feels to tap. **No rule was widened**, and
  the request/confirm round trip is still unbuilt and still its own item.
