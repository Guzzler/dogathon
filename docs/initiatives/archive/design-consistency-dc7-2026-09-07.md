# Archive — design-consistency.md, DC-7's settled section (snapshot 2026-09-07)

Verbatim snapshot of the `## Settled — what `App.css` was, and why it is gone` section as it
stood after DC-7 shipped (PR #67). Compressed to a pointer in the working doc on 2026-09-07 per
the README's rule that a shipped item's design section and its ledger row are two tellings of
one story. **Read the working doc for anything current** — this snapshot's closing claim that
the app is "two stylesheets" was already wrong when it was written; the correction is in the
working doc, not here. Archives are append-only.

---

## Settled — what `App.css` was, and why it is gone (2026-09-06; shipped the same day)

**DC-7 shipped this.** The measurement below is preserved as the reasoning; the outcome is
that `web/src/App.css` no longer exists, `Sidebar.tsx` and `components/Checklist.tsx` are
deleted, and the app is two stylesheets (`pawthway.css` then `theme.css`) plus `index.css`'s
element reset. Both files now open with a header comment naming what depends on the order.

The open question this run answered is one the doc had never asked: **there are three
stylesheets, they are loaded in a fixed order, and nothing says which of them is live.**
`App.tsx:25-27` imports `App.css`, `pawthway.css`, `theme.css` in that order and
`main.tsx` imports `index.css` (29 lines of `html`/`body`/`#root` reset — not in scope
below). `CLAUDE.md` records the order as load-bearing for `.btn`; PR #60's ledger row
records a second case (`.shelter .btn` beats `.screen .btn` only by sitting lower in
`theme.css`). Two hazards of the same shape, both discovered by being bitten.

It was measured rather than guessed — every `className` literal and template string in
`web/src/**/*.tsx` against every selector in each file:

- **`App.css` is 627 lines and three classes of it are live.** `.btn`, `.btn--primary`
  and `.btn--ghost` — 67, 11 and 16 uses. They are the *base* layer that `theme.css`'s
  `.screen .btn`, `.phone-body .btn--ghost`, `.sharesheet .btn` and `.shelter .btn` all
  override, so they are load-bearing and stay.
- **Everything else in it is the pre-Pawthway scaffold's desktop agent UI**, reachable
  only through `components/Sidebar.tsx` — which **nothing imports** (`grep -rn "from
  .*Sidebar"` → zero hits). That covers `.sidebar*`, `.tool-list*`, `.badge*`,
  `.banner*`, `.brand-lockup*`, `.app`, and the whole dead chat stack (`.bubble*`,
  `.turn*`, `.tool-card*`, `.chat-header*`, `.modal*`, `.composer*`, `.status-pill*`,
  `.thinking-block`, `.empty-state*`, `.btn--approve`, `.btn--deny`). The live agent UI
  uses `theme.css` exclusively: `TurnView` is `.msg*`, `ToolCallCard` is `.activity*`,
  `ApprovalModal` is `.approve*`.
- **`components/Checklist.tsx` is dead too** — `MatchView` renders its own local
  `ChecklistSection`.
- **Two dead selectors leak into a live surface by name.** `.chat` and `.chat__scroll`
  are the *only* selectors defined in two files (`App.css:137,233` and
  `theme.css:281,320`), at identical specificity. `MatchView`/`MatchChatView` render
  `.chat`, so the live chat screen is currently resolved by import order — and it
  inherits `min-width:0` from `App.css`, which `theme.css`'s `.chat` does not set. That
  is the PR #11 failure mode with the two halves reversed: not a repaint nobody reviewed,
  but a *deletion* that would silently change a live screen.

**The decision: one stylesheet, and the order stops mattering.** Not a repaint — no token,
no font and no color value changes, which is what keeps this inside the parked list below
rather than in violation of it. DC-7 builds it.
