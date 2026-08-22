# dogathon agent

A small, general tool-calling agent on Claude. Write a normal Python function,
decorate it, and the agent can call it — the JSON schema comes from your type
hints and docstring, so there's no schema to hand-maintain.

Built for [Dogathon](https://luma.com/rklrsomo), but there's nothing dog-specific
in the core. Swap the demo tools for yours.

## Setup

```bash
uv sync
cp .env.example .env    # add your ANTHROPIC_API_KEY
```

## Run

```bash
uv run agent                              # REPL
uv run agent "which dogs are adoptable?"  # one-shot
```

In the REPL: `/tools` lists what's loaded, `/reset` clears history, `/quit` exits.

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

## Layout

```
src/agent/
  tools.py         @tool decorator, Registry, schema generation
  loop.py          Agent — streaming, tool dispatch, approval gate
  cli.py           REPL
  arcade_tools.py  Arcade adapter (optional)
  builtin/         demo tools: shelter roster, fetch_url, calculate
data/dogs.json     sample roster the demo tools read and write
```

## Notes

Runs on `claude-opus-4-7` with adaptive thinking and `effort="high"`. Both are
constructor arguments on `Agent` — drop to `effort="low"` for simple, high-volume
work, or raise to `"max"` when correctness matters more than cost.

Prompt caching is on via a rolling breakpoint, so multi-turn conversations re-read
the tool definitions and history at a discount rather than re-paying each turn.
Tool specs are emitted in sorted order to keep that cache prefix byte-stable.
