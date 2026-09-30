# RS-17 — the listing follows the handoff (archived verbatim 2026-09-29, the day it shipped)

Snapshot of the queue entry as execute read it, taken from
[`real-data-and-shelters.md`](../real-data-and-shelters.md) when RS-17 shipped. The Ledger row
there is the account of what was built, including where it differs from this spec.

- [ ] **RS-17 `[large]` — the listing follows the handoff (queued 2026-09-29).** Nothing in the
  app writes `status: "foster"`. `DogStatus` has the value (`types.ts:63`), `rosterActions("foster")`
  handles it and `isListable()` (`dog.ts:128`) already excludes it — but no screen, tool or script
  sets it (re-grepped this run: the only other mention is `shelter.py:19`'s filter list). So after
  the shelter presses **Confirm pickup** the dog is still `available`: in Discovery, in a second
  foster's Saved list, and — through PH-31's `isListable()` — appliable by them. RS-15 made the
  confirmation *the* handoff for the foster's side; the dog's side never heard about it.

  **Design answer (this run's question — who takes a dog off the roster when it goes home, and who
  puts it back?).** The shelter, **at the moment it answers**, in the **same `writeBatch`** as the
  application write, so the answer and the listing can never disagree. Three reasons it is not
  anyone else: the foster's rules can't write `dogs` and must not (RS-6: `update` needs
  `isStaff(resource.data.shelter_id)`); the agent may only write the foster's matched dog and only
  Post Foster's fields (PH-27); and a Cloud Function would be a third writer of `status`, which RS-10
  and RS-16's *one writer per field* rule out. **No rules change** — staff already own the field.
  The transitions, as one pure function so the writers stay thin:

  | Staff event (inbox) | Dog status now | Write |
  |---|---|---|
  | Confirm pickup | `available` | `foster` |
  | Confirm pickup | anything else | nothing — a `medical_hold` or `retired` dog is staff's own earlier decision; the inbox says so beside the button |
  | Take back confirmation, or Ask for another time after confirming | `foster` | `available` |
  | Decline the application | `foster` | `available` |
  | any of the above | not the value on the left | nothing |

  The **foster** can still undo a confirmed pickup (withdraw, or **Change request**, which clears
  `pickupConfirmedAt`) and cannot write the dog. Deliberately: a changed request is still the same
  foster holding the same dog, so staying unlisted is right; a **withdrawal** is not, and staff see
  it — step 4.

  1. `web/src/lib/shelterDog.ts`: `handoffStatus(event: "confirm" | "unconfirm" | "decline",
     current: DogStatus): DogStatus | null` implementing the table, commented with *why the shelter
     is the writer* (the three reasons above, not the table).
  2. `web/src/lib/applications.ts`: `setPickupConfirmed`, `askForAnotherTime` and a declining
     `setApplicationStatus` take the dog (`{ id, status }`) and, when `handoffStatus` returns a
     value, write `dogs/{id}` `{ status, updatedAt }` in a `writeBatch` with the application
     update. Keep RS-15's existing field clears exactly as they are.
  3. `ShelterApplicationsView.tsx`: pass the dog it already resolves (`useDogName` reads `useDogs`
     — widen it to return the dog). Beside **Confirm pickup**, when the dog isn't `available`, one
     muted line: *{Name} is marked {status label} — confirming won't change that.*
  4. **Withdrawn after confirmation.** A `withdrawn` application whose dog is still `foster` gets a
     notice in its detail — *{Foster} withdrew after pickup was confirmed; {Name} is still marked in
     foster* — and a **List again** button (`relistDog`). `rosterActions("foster")` gains `relist`
     so the roster offers the same thing; update `shelterDog.test.ts:140`.
  5. `groupRoster()`: a fourth group, **In foster**, between *Back from foster* and *Listed*, for
     `foster` dogs (today they fall into *Not listed*, beside retired ones). Omitted when empty, as
     *Back from foster* already is.

  **Not in scope** (write each down as a lead if still true when done): other fosters' open
  applications on a dog that just went `foster` — they stay `submitted` and the inbox shows them as
  if the dog were free (a closing-the-others design, not a status write); SF SPCA's own
  `in_foster_home` prose flag, which is *their* foster network and must never be conflated with this
  `status`; the importer (RS-16 keeps a non-`available` status, and RS-13b gates any writing import
  behind RS-16). **Order with RS-16:** RS-17 is safe to ship first — a writing import needs a person
  to untick *plan only*, and RS-13b already says not before RS-16.

  **Verify:** vitest — `handoffStatus` every row of the table, plus each status × event not in it
  returning `null`; `groupRoster` puts `foster` in *In foster* and omits the group when empty;
  `rosterActions("foster")` is `["relist", "retire"]`; `ShelterApplicationsView` renders the step-3
  line for a `medical_hold` dog and the step-4 notice for a withdrawn application on a `foster` dog
  (and not on an `available` one). `tsc -b`, build, lint at `main`'s 8. **Not verifiable
  unattended:** the batch against real Firestore — RS-14b step (8): confirm, expect the dog to leave
  foster-side Discovery; take it back, expect it to return.
