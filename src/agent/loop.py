"""The agent loop: call Claude, run whatever tools it asks for, repeat."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Iterator, Literal

import anthropic

from .tools import Registry

DEFAULT_MODEL = "claude-opus-4-7"
DEFAULT_SYSTEM = (
    "You are a capable agent with access to tools. Prefer taking action with the "
    "tools you have over describing what the user could do themselves. Chain "
    "several tools together when a task needs it, and check your work before "
    "reporting success. If a tool fails, read the error and try a different "
    "approach rather than repeating the same call. When you genuinely lack a "
    "tool for something, say so plainly instead of pretending to have done it."
)

EventKind = Literal["text", "thinking", "tool_call", "tool_result", "turn_end", "error"]


@dataclass
class Event:
    """One thing that happened during a run, streamed out as it happens."""

    kind: EventKind
    text: str = ""
    name: str = ""
    args: dict[str, Any] = field(default_factory=dict)
    is_error: bool = False


class ApprovalDenied(Exception):
    pass


class Agent:
    """A conversation with Claude in which tools actually get run.

    The message history lives on the instance, so repeated ``run()`` calls
    continue the same conversation.
    """

    def __init__(
        self,
        registry: Registry,
        *,
        system: str = DEFAULT_SYSTEM,
        model: str = DEFAULT_MODEL,
        max_tokens: int = 64000,
        effort: str = "high",
        thinking: bool = True,
        max_turns: int = 25,
        approve: Callable[[str, dict[str, Any]], bool] | None = None,
        client: anthropic.Anthropic | None = None,
    ) -> None:
        self.registry = registry
        self.system = system
        self.model = model
        self.max_tokens = max_tokens
        self.effort = effort
        self.thinking = thinking
        self.max_turns = max_turns
        self.approve = approve
        self.client = client or anthropic.Anthropic()
        self.messages: list[dict[str, Any]] = []

    def reset(self) -> None:
        self.messages = []

    def _request(self) -> Any:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": self.system,
            "messages": self.messages,
            "tools": self.registry.specs(),
            "output_config": {"effort": self.effort},
            # Rolling breakpoint: caches the longest stable prefix of tools +
            # system + history, so each extra turn re-reads instead of re-paying.
            "cache_control": {"type": "ephemeral"},
        }
        if self.thinking:
            kwargs["thinking"] = {"type": "adaptive", "display": "summarized"}
        return self.client.messages.stream(**kwargs)

    def run(self, user_message: str) -> Iterator[Event]:
        """Send a message and drive the tool loop until Claude is done."""
        self.messages.append({"role": "user", "content": user_message})

        for _ in range(self.max_turns):
            try:
                with self._request() as stream:
                    for chunk in stream:
                        if chunk.type != "content_block_delta":
                            continue
                        delta = chunk.delta
                        if delta.type == "text_delta":
                            yield Event("text", text=delta.text)
                        elif delta.type == "thinking_delta":
                            yield Event("thinking", text=delta.thinking)
                    reply = stream.get_final_message()
            except anthropic.APIError as exc:
                yield Event("error", text=f"API error: {exc}", is_error=True)
                return

            # Append the raw blocks, not just the text: thinking blocks and
            # tool_use blocks both have to survive into the next request.
            self.messages.append({"role": "assistant", "content": reply.content})

            calls = [b for b in reply.content if b.type == "tool_use"]
            if not calls:
                yield Event("turn_end")
                return

            results = []
            for call in calls:
                args = dict(call.input or {})
                yield Event("tool_call", name=call.name, args=args)

                entry = self.registry.get(call.name)
                if entry and entry.dangerous and self.approve and not self.approve(call.name, args):
                    output, is_error = "The human declined this action.", True
                else:
                    output, is_error = self.registry.invoke(call.name, args)

                yield Event("tool_result", name=call.name, text=output, is_error=is_error)
                block: dict[str, Any] = {
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": output,
                }
                if is_error:
                    block["is_error"] = True
                results.append(block)

            self.messages.append({"role": "user", "content": results})

        yield Event(
            "error",
            text=f"Stopped after {self.max_turns} turns without finishing.",
            is_error=True,
        )
