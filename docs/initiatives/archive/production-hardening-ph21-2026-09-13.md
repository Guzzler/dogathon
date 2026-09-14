# PH-21's queue entry, verbatim (archived 2026-09-13, the run that shipped it)

Snapshotted out of `production-hardening.md` when PH-21 shipped, per the README's rule that
a shipped item's spec and its ledger row are two tellings of one story and the shorter is
the one to keep. The design section it points at -- "A retraction is a write, not an
erasure" -- stays in the working doc, because it holds the measurement rather than the
build instructions. What the build found that this spec had not is the ledger row.

- **PH-21 `[large]` — the paragraph a model wrote about a real dog is invisible to the two
  people who could correct it, and permanent.** The measurement and the design answer are in
  "A retraction is a write, not an erasure" above; build from there, not from this summary.
  Four parts, all of them required for the item to be coherent — a read path with no way to act
  on it is the state the app is in today:

  1. **Show the foster what was sent.** In `web/src/phases/postfoster/PostFosterView.tsx`,
     replace the `foster.readyForAdoption` banner at `:70-74` with a card that renders
     `dog.adoption_profile` in full when it exists, labelled from `adoption_profile_source` —
     *"Drafted by the Pawthway assistant from your journal"* for `"agent"`. Read it off the dog
     document the view already has; do **not** re-derive it from the chat transcript, which is a
     different record and may not be the text that landed. When `readyForAdoption` is true and
     `adoption_profile` is absent, say that plainly rather than keeping the old sentence — the
     two documents disagreeing is a state the screen must be able to render.
  2. **Show the adopter.** `PublicAdoptionView` / `AdoptionProfileBody` render the paragraph as
     its own attributed section. It must be **visibly attributed and visibly separate** from the
     foster's own words (`Foster.adoptionNote`, which `AdoptionProfile.tsx` already renders as
     "A note from the foster") — the whole point of `adoption_profile_source` is that a reader
     can tell a drafted paragraph from a written one. Unattributed, this makes the page worse,
     not better.
  3. **A withdrawal path.** A new `@tool(dangerous=True)` in `src/agent/builtin/adoption.py` —
     `withdraw_adoption_profile(foster_id, dog_id, reason)` — which **writes rather than
     clears**: `adoption_profile` becomes a sentence naming the withdrawal and the foster's
     stated reason, and `adoption_profile_source` becomes `"foster_withdrawn"` (widen the union
     on `Dog` in `web/src/types.ts`). It must **not** touch `status`: a dog that came back from
     foster is still back from foster, and `ready_for_adoption` is RS-12's arrival state, not a
     claim about the paragraph. Add a quick action to `PostFosterView`'s `AgentChatPanel` and a
     `toolLabels.ts` entry, matching the two already there.
  4. **Tell the shelter which it is reading.** `ShelterRosterView.tsx:236-237` renders the
     paragraph bare. It gains the same attribution line, and a withdrawn profile reads as a
     withdrawal rather than as a description — staff are deciding whether a real animal gets
     listed, and PH-20 wrote `adoption_profile_source` for precisely this reader.

  **Tests.** `tests/test_adoption.py` (12 cases today) gains the withdrawal tool: it writes the
  sentence and the source, it leaves `status` alone, and it fails cleanly on a dog id that
  doesn't exist — `conftest.py`'s fake `update()` raises on a missing document, which is the
  behaviour that makes the last case meaningful. `ShelterRosterView.test.tsx` gains an
  attributed-render case and a withdrawn-render case. **Verification is the tests plus
  `npm run build`/`test`/`lint` and `pytest`** — reaching Post Foster live needs a completed
  journey on a signed-in account, which an unattended run cannot do; say so in the ledger row
  rather than implying otherwise.

  **One thing to re-verify before building, because three consecutive specs were wrong in the
  same direction:** confirm `PostFosterView` still holds the raw dog document (it calls
  `normalizeDog(raw)`, which spreads `...d`, so `adoption_profile` should pass through
  `RichDog` — check `web/src/lib/dog.ts` rather than assuming), and confirm the banner is still
  at `:70-74`.
