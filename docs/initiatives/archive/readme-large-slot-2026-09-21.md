# README.md — the thirteenth `[large]`-slot entry, verbatim (archived 2026-09-21)

Moved out of the working README when the fourteenth was added, to keep it under the ~400-line ceiling. Text unchanged.

- **2026-09-20 — the thirteenth link: the *other language's* write sites.** Taking PH-25's parting
  note (`save_intake` still defaults to `""`) found that three consecutive censuses had enumerated
  only **the UI's** writes. The agent's `@tool(dangerous=True)` functions write the same documents
  through the Admin SDK, around `firestore.rules` and around every helper the screens use — and
  `record_swipe(liked=True)` turned out to be an **application no shelter can see**: it sets
  `matchedDogId` and `phase` without `createApplication()`, so RS-5's inbox never hears of it. That
  is PH-26. Two things generalise:
  - **A census is bounded by the language it was run in.** Every grep behind PH-23/24/25 was over
    `web/src`. The backend is the same app writing the same document, and nothing in the method
    would ever have reached it. **When a write-site census comes back clean, re-run it over
    `src/agent` before believing it.**
  - **The right answer to "should the second implementation learn the rule?" is often "should it
    exist?"** The lead asked whether `save_intake` should get PH-24's omission rule; the design
    answer removes it, because it has no screen twin. A rule for when a tool may write is in
    `production-hardening.md`: **every write an agent tool makes must already be a write some
    screen makes** — same fields, guards and side effects.
  - With it, **the lead was half wrong again.** It said the Hub printed the stale size word; the Hub
    reads the number, and the only reader of the word is the agent. The defect was real and its
    victim was misnamed — which is the 2026-09-12 rule, "a lead is a measurement too".
