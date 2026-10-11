# PH-35 spec — archived verbatim 2026-10-10, the day it shipped

From `production-hardening.md`'s Task queue, as execute read it.

- [ ] **PH-35 — the adoption page invites enquiries about a dog that is gone (found by plan
  2026-10-10, at `03e308e`).** PH-32's predicate walked to the journey's end, the same way RS-22
  walked RS-21's: the page stays up while the application is `approved` — and, once RS-22 ships,
  `completed` — **whatever the dog's status**, because nothing on it reads the status at all.
  `PublishedAdoptionView` (`phases/postfoster/PublicAdoptionView.tsx:32-48`) takes the dog from an
  unfiltered `useDogs()` snapshot, and `AdoptionProfileBody`'s contact card
  (`AdoptionProfile.tsx:257-264`) prints *Adoption enquiries go through the shelter. They'll arrange
  a meet-and-greet.* for any dog with a known org. So after **Mark adopted** — which RS-22 makes the
  ordinary end of a foster — every link the foster sent keeps inviting strangers to enquire about a
  dog who has gone home; after **Retire**, about one the shelter took down.
  **Design answer: the page states the listing; it does not come down.** The foster's notes are
  history and stay true after adoption, the link is already in people's inboxes, and PH-32's gate is
  about *who authorized* the page, not whether the dog is free — so **no rules edit**, and no
  dog-status read in `publishAuthorized()`. What changes is the one sentence that is a claim about
  availability. Reuse `offRoster()` (`lib/applicationView.ts:454`), the predicate RS-20 already uses
  for exactly these two statuses: in the contact card, `adopted` → *{name} has been adopted through
  {shelter}.* and `retired` → *{shelter} isn't listing {name} right now.*, each **replacing** the
  enquiry line (name and address stay — they are the shelter's record). Every other status keeps the
  line: `foster`, `medical_hold` and `ready_for_adoption` are still adoptable through the shelter.
  The card is shared, so Post Foster's own preview says the same — the sender sees what the reader
  sees (PH-32). **Not in scope:** the page's closing *Interested in fostering a dog like {name}?*
  card is about Pawthway, not this dog, and stays. **Verify:** an `AdoptionProfile` render test per
  branch (`adopted`, `retired`, `available`, and `shelter: null` still rendering no card), asserting
  the enquiry sentence is absent on the first two; `tsc -b`, build, lint at `main`'s 8. Small; a
  natural rider on RS-22, whose **Mark adopted** is what makes it reachable on every journey.

