# Archive — `real-data-and-shelters.md`, RS-10 (2026-09-02)

Verbatim snapshot of RS-10's design section and its queue item, taken in RS-10's own PR the
moment that doc's edits crossed the README's ~400-line threshold. Per the README's 2026-09-02
rule: **after a `[large]` item ships, its design answer and its queue item are two tellings of
one story, and the shipped code is a third** — the working doc keeps the shortest.

Archives are append-only. If something here turns out to be wrong, correct the working doc and
say so there.

## The design section, as it stood

## Settled 2026-08-31 — RS-10's spec: split the two approval checklists by `owner`

`applications/{id}.checklist` (written by staff, RS-5) and
`fosters/{uid}.approvalChecklist` (written by the foster and by the agent) are two
unjoined copies of the same list, so neither side can see the other's ticks. The
decision: **split by `ChecklistItem.owner`, one writer per field** — shelter-owned
items live on the application, foster-owned ones stay on the foster document, and
each view composes the displayed list out of both. Not a mirror (PH-16 pinned
`checklist` on the foster branch of the update rule precisely to stop that, and a
mirror is last-write-wins by construction) and not the full migration to the
application as sole source of truth — that is M2's deferred work and it touches every
guest/`LOCAL_MODE` path where no application document exists at all. The `owner` split
is the first half of that migration, not a detour around it. Full reasoning, the two
rejected alternatives and the three hazards it leaves for whoever builds it are in the
[2026-09-01 archive](archive/real-data-and-shelters-2026-09-01.md); the operative spec
is RS-10 in the queue below.

## The queue item, as it stood

- **RS-10 `[large]` (ungated 2026-08-31 — RS-5 shipped; marked large 2026-09-02) — join the
  two approval checklists by `owner`. A complete execute run.** It was already this size and
  merely unlabelled — a hook, both foster views composed from two sources, an agent tool
  constrained, and a four-case test — which is the same labelling gap RS-6 had (README,
  "The `[large]` slot"). It is the only `[large]` item in the top-priority doc. The design section above is the spec and the reasoning; this is the
  work. Today `applications/{id}.checklist` and `fosters/{uid}.approvalChecklist`
  are two unjoined copies, so RS-5's inbox and the foster's Match view cannot see
  each other's ticks. Split by `ChecklistItem.owner` — one writer per field —
  rather than mirroring or migrating.
  - Add `web/src/hooks/useApplication.ts`: `where("fosterId","==",uid)` +
    `where("dogId","==",matchedDogId)`. Two equalities, no `orderBy`, **no
    composite index needed** — do not add one to `firestore.indexes.json`.
  - `MatchView.tsx` composes its list: `owner: "foster"` entries from
    `foster.approvalChecklist`, `owner: "shelter"` entries from the application's
    `checklist`. Use `checklistOwner(id)` (`web/src/checklists.ts:13`) for records
    predating the field, same as it does today. Foster ticks keep going through
    `patchFoster()`; nothing here writes `applications`.
  - **The badge and the pickup gate are the payoff, and they are different
    gates** (`CLAUDE.md`, "Match: who owns which approval step"). "Shelter
    approved you as a foster" now tracks real shelter action; pickup still
    unlocks on the whole list. Don't collapse them.
  - **No application, no change.** Guests and `LOCAL_MODE` have no
    `applications` row, and `DemoShelterPanel` must keep working — fall back to
    the foster doc's shelter-owned entries exactly as today.
  - Constrain `update_checklist` in `src/agent/builtin/foster.py` to foster-owned
    ids in the same PR: it writes `approvalChecklist` wholesale and would
    otherwise tick a step the foster doc no longer owns.
  - `SavedView.tsx:157`'s Applications timeline reads the same field and must not
    disagree with Match — route it through the same composition, don't duplicate
    it.
  - Verify: `npm run build`/`test`/`lint` green; a unit test over the composition
    covering all four cases (no application, foster-only ticks, shelter-only
    ticks, both); in `LOCAL_MODE` the Demo Shelter panel still moves the badge.
    The signed-in two-party path needs a real shelter account and stays
    unverified — say so in the ledger row.

