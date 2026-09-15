# Archived from `production-hardening.md` on 2026-09-14

PH-21's design section, verbatim as it stood when PH-21 shipped (PR #81). Cut under the
README's rule that after a `[large]` item ships, its design answer and its ledger row are two
tellings of one story — keep the shorter. PH-21's ledger row is the fuller account and stays
in the working doc. This is the measurement that produced the item, preserved because the
*method* — measure every reader and every writer of a field, traced to the surface it renders
on — is what PH-22 reuses.

### A retraction is a write, not an erasure — and nobody but the shelter can read the paragraph at all (2026-09-13)

PH-20 closed the question of what the model may assert and left one behind, recorded as an
unqueued lead: **`adoption_profile` cannot be retracted.** Measuring it — every reader and every
writer of that field, traced to the surface it renders on — found the lead was the smaller half
of the defect, and the larger half is the reason the smaller one is hard to notice:

- **The foster never sees what was sent.** `PostFosterView.tsx:70-74` renders *"{dog}'s adoption
  profile is with the shelter. Thank you for fostering!"* keyed on `foster.readyForAdoption`,
  and **nothing in that view renders `dog.adoption_profile`**. The text is available to it —
  `dogs` is `allow read: if true` (`firestore.rules:13`), `normalizeDog()` spreads `...d`, and
  `PostFosterView` already holds the matched dog — it is simply not shown. So the one person who
  can tell whether a sentence about this dog is true reads a banner saying a paragraph exists.
- **The adopter never sees it either.** `PublicAdoptionView` — the shared link, the surface the
  paragraph is *written for* — builds its body from `buildAdoptionProfile` and does not read
  `adoption_profile`. Grep confirms the field's only frontend reader anywhere is
  `ShelterRosterView.tsx:236-237`. A profile written for adopters reaches staff and stops.
- **`adoption_profile_source` is written and rendered nowhere.** PH-20 added it for exactly this
  purpose; its three occurrences are `adoption.py`, `types.ts` and a test.
- **Two documents carry one claim and can disagree.** The banner reads
  `fosters/{uid}.readyForAdoption`; the paragraph lives on `dogs/{id}`. One tool writes both, so
  they agree today — but the banner asserts the paragraph's existence without consulting it.

The design answer, which is what makes this a surface rather than a delete button:

> **A retraction is a write.** Clearing the field is the wrong primitive, because RS-12 made the
> write *be* the notification: erasing it leaves the dog in `ready_for_adoption` with a **Back
> from foster** card and nothing in it — the arrival survives and its content vanishes, which is
> a worse state for the person deciding than either the paragraph or no card. So a withdrawn
> profile must carry a sentence saying it was withdrawn by the foster, and
> `adoption_profile_source` must stop saying `"agent"`.

Two consequences worth stating rather than re-deriving:

1. **Replacement is already built; visibility is not.** `send_adoption_profile_to_shelter`
   overwrites unconditionally, so "the agent rewrites it and re-sends" works today. It is
   unreachable in practice because the foster cannot read what would be replaced. That reorders
   PH-21: the expensive half is the read path, not a new write path.
2. **The write goes through the agent, and `firestore.rules` does not move.** A foster cannot
   write `dogs` (RS-6 scoped `update` to `isStaff`), and widening that to let a foster edit a
   dog document would hand every foster their shelter's roster. The Admin SDK made the
   paragraph; the same path un-says it, gated by the existing approval modal like every other
   dangerous tool. This is the README's standing "don't fix it by loosening `firestore.rules`"
   arriving at a third site.
Correcting `CLAUDE.md` is Sharang's, not this loop's.
