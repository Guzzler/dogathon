# PH-27 spec, verbatim — archived 2026-09-21 when it shipped

Snapshot of the queue entry from `production-hardening.md` at the moment execute shipped it. The Ledger row there is the account of what actually shipped; this is what was asked for.

- **PH-27 `[large]` — queued 2026-09-21. The agent writes only the dog its foster has.** Finishes
  the audit PH-26 started; the design answer is the section "The agent acts for one foster" below —
  read it first. One PR, both languages:
  1. **Remove `update_dog`** from `src/agent/builtin/shelter.py` (keep `STATUSES`, `list_dogs`,
     `get_dog`), from `DEFAULT_DANGEROUS` in `web/src/components/AgentChatPanel.tsx`, and from both
     entries in `web/src/lib/toolLabels.ts` (the map at `:22` and the `case` at `:56`).
     `tests/test_approval_store.py` uses `"update_dog"` only as an opaque name string — rename it to
     a tool that exists, or leave it and say so in the row.
  2. **Bind both adoption tools to the matched dog.** In `adoption.py`, read the resolved foster
     (`get_foster`) and raise if `matchedDogId` is unset or `dog_id` differs from it — **before** any
     write. Let an omitted `dog_id` default to `matchedDogId`, and update both docstrings to say the
     dog is the foster's own. Before choosing whether to also gate on `phase`, check whether the
     `/post-foster` route gates on it; if it doesn't, the `matchedDogId` check alone *is* the twin
     and adding a phase rule would be a guard no screen has.
  3. **`withdraw_adoption_profile` refuses** unless the dog's `adoption_profile_source` is `agent`
     or `foster_withdrawn` — nothing to withdraw is an error, not a note.
  4. **Riders:** `log_care_entry` raises on an `entry_type` outside `weigh_in`/`vet_visit`/`note`/
     `photo` (the `CareLogEntry["type"]` union in `web/src/types.ts:216`); `list_dogs` stops raising
     `KeyError` on a dog with no `weight_lbs` — RS-6's `dogFromForm()` (`shelterDog.ts:145`) omits it
     when the staff member leaves weight blank. Under a `max_weight_lbs` filter an unknown weight is
     **excluded**, not treated as zero.

  **Done means:** new pytest cases (in `tests/test_adoption.py` / `test_foster_tools.py`, using the
  existing `fake_db`) show send and withdraw each raising on a dog that is not the foster's
  `matchedDogId` and on a foster with none, **with the other dog's document unchanged**; withdraw
  raising on a dog with no agent profile; a bad `entry_type` raising; `list_dogs(max_weight_lbs=50)`
  returning over a seeded weightless dog without it. `test_the_ui_prompts_for_exactly_the_dangerous_tools`
  must still pass (it is what catches a half-removed tool). `grep -rn update_dog src web/src` empty;
  `uv run pytest`, and in `web/`: `npm test`, `./node_modules/.bin/tsc -b`, `npm run build`,
  `npm run lint` (warnings no worse than `main`). Not verifiable live unattended — the agent needs a
  signed-in token; say so in the row rather than parking a new "Needs a human" item for it.
