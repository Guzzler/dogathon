"""Optional Arcade.dev adapter: Gmail, Sheets, Slack, and friends as agent tools.

Entirely opt-in. With no ARCADE_API_KEY set (or arcadepy not installed) this
module reports itself unavailable and the agent runs on builtin tools alone.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from .tools import Tool

# Arcade names tools like "Gmail.SendEmail"; Anthropic requires
# ^[a-zA-Z0-9_-]{1,128}$. We sanitize whatever we get and keep a map back, which
# is correct whether or not Arcade's anthropic format already did it for us.
_ILLEGAL = re.compile(r"[^a-zA-Z0-9_-]")
_MAX_NAME = 128

DEFAULT_TOOLKITS = ("gmail", "google_sheets", "slack")

_client: Any = None
_name_map: dict[str, str] = {}
_authorized: set[tuple[str, str]] = set()


def available() -> bool:
    """Whether Arcade tools can be loaded right now."""
    if not os.environ.get("ARCADE_API_KEY"):
        return False
    try:
        import arcadepy  # noqa: F401
    except ImportError:
        return False
    return True


def user_id() -> str:
    return os.environ.get("ARCADE_USER_ID", "")


def toolkits() -> list[str]:
    configured = os.environ.get("ARCADE_TOOLKITS", "")
    if not configured:
        return list(DEFAULT_TOOLKITS)
    return [name.strip() for name in configured.split(",") if name.strip()]


def _get_client() -> Any:
    global _client
    if _client is None:
        from arcadepy import Arcade

        _client = Arcade()  # picks up ARCADE_API_KEY
    return _client


def _as_dict(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    for attr in ("model_dump", "dict", "to_dict"):
        fn = getattr(obj, attr, None)
        if callable(fn):
            try:
                if isinstance(result := fn(), dict):
                    return result
            except TypeError:
                continue
    return {k: v for k, v in vars(obj).items() if not k.startswith("_")}


def _sanitize(name: str) -> str:
    return (_ILLEGAL.sub("_", name).strip("_") or "tool")[:_MAX_NAME]


def _unique(candidate: str) -> str:
    if candidate not in _name_map:
        return candidate
    stem, suffix = candidate[: _MAX_NAME - 3], 2
    while f"{stem}_{suffix}" in _name_map:
        suffix += 1
    return f"{stem}_{suffix}"


def _make_tool(raw: Any) -> Tool | None:
    payload = _as_dict(raw)
    if isinstance(payload.get("function"), dict):
        payload = payload["function"]

    real = payload.get("name")
    if not real:
        return None

    schema = _as_dict(payload.get("input_schema") or payload.get("parameters") or {})
    schema.setdefault("type", "object")
    schema.setdefault("properties", {})

    safe = _unique(_sanitize(real))
    _name_map[safe] = real

    return Tool(
        name=safe,
        description=payload.get("description") or f"Arcade tool {real}",
        input_schema=schema,
        fn=lambda **kwargs: execute(safe, kwargs),
        # Arcade tools reach real inboxes and channels, so every one of them
        # goes through the human approval gate.
        dangerous=True,
    )


def load(names: list[str] | None = None) -> list[Tool]:
    """Load Arcade toolkits as Tools. Returns [] when Arcade isn't configured."""
    if not available():
        return []

    client = _get_client()
    tools: list[Tool] = []

    for toolkit in names or toolkits():
        try:
            page = client.tools.formatted.list(format="anthropic", toolkit=toolkit)
            raws = list(page)
        except Exception as exc:
            print(f"[arcade] skipping toolkit {toolkit!r}: {exc}")
            continue
        tools.extend(entry for raw in raws if (entry := _make_tool(raw)))

    return tools


def execute(anthropic_name: str, args: dict[str, Any]) -> str:
    """Run an Arcade tool, authorizing the user first if needed."""
    who = user_id()
    if not who:
        return "Error: set ARCADE_USER_ID before calling Arcade tools."

    real = _name_map.get(anthropic_name, anthropic_name)
    client = _get_client()

    if (real, who) not in _authorized:
        try:
            auth = client.tools.authorize(tool_name=real, user_id=who)
        except Exception as exc:
            return f"Error checking authorization for {real}: {exc}"

        if getattr(auth, "status", None) != "completed":
            url = getattr(auth, "url", None)
            if url:
                return (
                    f"{real} needs authorization first. Open this link, grant "
                    f"access, then ask me to retry:\n{url}"
                )
            return f"{real} is not authorized and Arcade returned no consent URL."
        _authorized.add((real, who))

    try:
        response = client.tools.execute(tool_name=real, input=args or {}, user_id=who)
    except Exception as exc:
        return f"Error executing {real}: {exc}"

    output = getattr(response, "output", None)
    if getattr(response, "success", None) is False:
        error = getattr(output, "error", None)
        return f"{real} failed: {getattr(error, 'message', None) or error or 'unknown error'}"

    value = getattr(output, "value", None)
    if value is None:
        return "(succeeded, no output)"
    return value if isinstance(value, str) else json.dumps(value, indent=2, default=str)
