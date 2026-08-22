# Pawthway

A guided, Tinder-style foster journey app — Onboarding → Discovery → Match →
Care Plan → Post Foster — built on a small, general tool-calling agent on
Claude. Write a normal Python function, decorate it, and the agent can call
it — the JSON schema comes from your type hints and docstring, so there's no
schema to hand-maintain.

Built for [Dogathon](https://luma.com/rklrsomo).

**Live demo:** https://pawthway-hackathon.web.app

See [CLAUDE.md](./CLAUDE.md) for the full architecture writeup (Firebase
Hosting + Firestore + Cloud Run), phase ownership, and env var setup.

## Setup

```bash
uv sync
cp .env.example .env    # add your ANTHROPIC_API_KEY
cd web && npm install && cp .env.example .env   # add Firebase web config
```

## Run

```bash
uv run agent                              # REPL
uv run agent "which dogs are adoptable?"  # one-shot
```

In the REPL: `/tools` lists what's loaded, `/reset` clears history, `/quit` exits.

## Web demo

A React chat UI that's easier to demo than the terminal — it shows tool calls
and their results live as cards, and pops a modal to approve or deny anything
`dangerous`.

```bash
uv run agent-server        # backend: SSE bridge on :8000
cd web && npm install && npm run dev   # frontend: :5173
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the
backend, so there's no CORS setup to think about. The backend is intentionally
single-session (one `Agent`, one pending approval slot) — right for a live
demo on a laptop, not for multiple concurrent users.

Seed Firestore with the sample dog roster and the demo `fosters/annie` doc
(needs `gcloud auth application-default login` once, or `FIREBASE_PROJECT_ID`
set):

```bash
uv run python scripts/seed_firestore.py
```

```
web/src/
  api.ts               fetch + SSE-frame parsing for /chat, /tools, /approve
  App.tsx              chat state machine: turns, streaming, approval flow
  components/
    TurnView.tsx        renders a user or assistant turn, with thinking toggle
    ToolCallCard.tsx     one tool call: name, args, status, result
    ApprovalModal.tsx    approve/deny UI for dangerous tool calls
    Sidebar.tsx          tool list, health banner, new-conversation button
```

The event protocol mirrors `agent.loop.Event` over SSE (`text`, `thinking`,
`tool_call`, `tool_result`, `turn_end`, `error`) — `src/agent/server.py` just
serializes each `Event` as one `event: <kind>\ndata: <json>\n\n` frame. The
frontend already knows which tools are `dangerous` from `GET /tools`, so it
opens the approval modal itself on a `tool_call` event rather than needing a
separate signal from the backend.

## Adding a tool

```python
from agent.tools import tool

@tool
def check_kennel(kennel_id: str, include_history: bool = False) -> dict:
    """Look up the current occupant and condition of a kennel.

    Args:
        kennel_id: Kennel label, e.g. "B-12".
        include_history: Also return the last 30 days of occupants.
    """
    return {...}
```

The docstring summary becomes the tool description and each `Args:` entry becomes
a parameter description — Claude reads both to decide when and how to call it, so
they're worth writing carefully. Parameters without defaults are required.

Register it by adding the module to `src/agent/builtin/__init__.py`, or build a
registry yourself:

```python
from agent import Agent, Registry

agent = Agent(Registry(check_kennel, other_tool))
for event in agent.run("is B-12 free?"):
    print(event.kind, event.text)
```

## Approval gate

Tools marked `@tool(dangerous=True)` pause for a human y/n before each call, with
the arguments shown. Use it for anything that writes, sends, or spends. Every
Arcade tool is gated this way by default.

The gate is just a callback — `Agent(registry, approve=fn)` where `fn(name, args)
-> bool`. Pass `approve=None` to run unattended, or supply your own policy (allow
-listing, Slack round-trip, spend caps).

## Arcade.dev tools

[Arcade](https://arcade.dev) provides pre-built, OAuth-handling tools for Gmail,
Google Sheets, Slack and more. It's optional and off unless configured:

```bash
uv sync --extra arcade
```

```bash
ARCADE_API_KEY=arc_...
ARCADE_USER_ID=you@example.com
ARCADE_TOOLKITS=gmail,google_sheets,slack   # optional, this is the default
```

They then load automatically alongside the builtins. The first call to an
unauthorized tool returns a consent URL instead of failing — open it, grant
access, and ask the agent to retry.

Arcade names tools `Gmail.SendEmail`, which the Messages API rejects (no dots
allowed), so the adapter sanitizes names and keeps a map back to the real ones.

## Deploy

Everything lives in the `pawthway-hackathon` GCP/Firebase project (Blaze plan,
needed for Cloud Run):

```bash
# Agent backend -> Cloud Run
gcloud run deploy pawthway-agent --source . --project=pawthway-hackathon \
  --region=us-central1 --allow-unauthenticated \
  --set-env-vars=ANTHROPIC_API_KEY=<key>

# put the printed Service URL into web/.env as VITE_AGENT_URL, then:

# Frontend -> Firebase Hosting, Firestore rules
cd web && npm run build && cd ..
firebase deploy --only hosting,firestore:rules --project=pawthway-hackathon
```

## Layout

```
src/agent/
  tools.py             @tool decorator, Registry, schema generation
  loop.py              Agent — streaming, tool dispatch, approval gate
  cli.py               REPL
  server.py            FastAPI SSE bridge for the web demo
  arcade_tools.py      Arcade adapter (optional)
  firestore_client.py  Firebase Admin SDK init
  builtin/             shelter.py, foster.py, care.py, adoption.py, web.py
scripts/seed_firestore.py   one-time Firestore seed (dogs.json -> `dogs`, plus fosters/annie)
data/dogs.json         sample roster used to seed Firestore
web/
  src/firebase.ts      Firebase Web SDK init
  src/hooks/           useFoster, useDogs, useCareLog — Firestore reads/writes
  src/phases/          Hub, Onboarding, Discovery, Match, CarePlan, PostFoster views
```

## Notes

Runs on `claude-opus-4-7` with adaptive thinking and `effort="high"`. Both are
constructor arguments on `Agent` — drop to `effort="low"` for simple, high-volume
work, or raise to `"max"` when correctness matters more than cost.

Prompt caching is on via a rolling breakpoint, so multi-turn conversations re-read
the tool definitions and history at a discount rather than re-paying each turn.
Tool specs are emitted in sorted order to keep that cache prefix byte-stable.
