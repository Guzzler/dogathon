"""Tool registry: turn plain Python functions into Claude tool definitions."""

from __future__ import annotations

import inspect
import json
import re
from dataclasses import dataclass
from typing import Any, Callable, get_type_hints

from pydantic import Field, create_model

_ARGS_HEADER = re.compile(r"^(Args|Arguments|Parameters)\s*:\s*$")
_SECTION_HEADER = re.compile(r"^(Returns|Yields|Raises|Examples?|Notes?)\s*:\s*$")
_ARG_LINE = re.compile(r"^(\*{0,2}\w+)\s*(?:\([^)]*\))?\s*:\s*(.*)$")


def _split_docstring(doc: str | None) -> tuple[str, dict[str, str]]:
    """Split a Google-style docstring into a summary and per-arg descriptions."""
    if not doc:
        return "", {}

    summary: list[str] = []
    params: dict[str, str] = {}
    current: str | None = None
    in_args = False

    for raw in inspect.cleandoc(doc).splitlines():
        line = raw.strip()
        if _ARGS_HEADER.match(line):
            in_args, current = True, None
            continue
        if _SECTION_HEADER.match(line):
            in_args, current = False, None
            continue

        if not in_args:
            summary.append(line)
        elif match := _ARG_LINE.match(line):
            current = match.group(1).lstrip("*")
            params[current] = match.group(2).strip()
        elif current and line:
            params[current] = f"{params[current]} {line}".strip()

    return "\n".join(summary).strip(), params


def _build_schema(fn: Callable[..., Any], param_docs: dict[str, str]) -> dict[str, Any]:
    """Derive a JSON schema for a function's parameters from its type hints."""
    signature = inspect.signature(fn)
    hints = get_type_hints(fn)
    fields: dict[str, Any] = {}

    for name, param in signature.parameters.items():
        if param.kind in (param.VAR_POSITIONAL, param.VAR_KEYWORD):
            continue
        annotation = hints.get(name, str)
        default = ... if param.default is inspect.Parameter.empty else param.default
        fields[name] = (annotation, Field(default, description=param_docs.get(name)))

    schema = create_model(f"{fn.__name__}_args", **fields).model_json_schema()
    schema.pop("title", None)
    for prop in schema.get("properties", {}).values():
        prop.pop("title", None)
    schema.setdefault("properties", {})
    schema.setdefault("required", [])
    return schema


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    fn: Callable[..., Any]
    dangerous: bool = False

    def spec(self) -> dict[str, Any]:
        """The tool definition as the Messages API expects it."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


def tool(
    fn: Callable[..., Any] | None = None,
    *,
    name: str | None = None,
    dangerous: bool = False,
) -> Any:
    """Expose a function to the agent. Use as ``@tool`` or ``@tool(dangerous=True)``.

    The description and parameter schema are derived from the docstring and type
    hints, so keep both accurate — Claude only sees what they say. Mark a tool
    ``dangerous=True`` when it writes to the outside world; the agent will then
    ask a human before each call.
    """

    def decorate(func: Callable[..., Any]) -> Callable[..., Any]:
        description, param_docs = _split_docstring(func.__doc__)
        func.tool = Tool(  # type: ignore[attr-defined]
            name=name or func.__name__,
            description=description,
            input_schema=_build_schema(func, param_docs),
            fn=func,
            dangerous=dangerous,
        )
        return func

    return decorate(fn) if fn is not None else decorate


class Registry:
    """The set of tools an agent can call."""

    def __init__(self, *fns: Any) -> None:
        self._tools: dict[str, Tool] = {}
        self.add(*fns)

    def add(self, *fns: Any) -> Registry:
        for item in fns:
            entry = item if isinstance(item, Tool) else getattr(item, "tool", None)
            if entry is None:
                raise TypeError(f"{item!r} is not a Tool; decorate it with @tool")
            self._tools[entry.name] = entry
        return self

    def add_module(self, module: Any) -> Registry:
        """Register every @tool-decorated function defined in a module."""
        for value in vars(module).values():
            entry = getattr(value, "tool", None)
            if isinstance(entry, Tool) and getattr(value, "__module__", None) == module.__name__:
                self._tools[entry.name] = entry
        return self

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def __len__(self) -> int:
        return len(self._tools)

    def __iter__(self):
        return iter(self._tools.values())

    def specs(self) -> list[dict[str, Any]]:
        # Sorted so the serialized tool block is byte-stable across runs, which
        # is what lets the prompt cache hit.
        return [self._tools[name].spec() for name in sorted(self._tools)]

    def invoke(self, name: str, args: dict[str, Any]) -> tuple[str, bool]:
        """Run a tool. Returns ``(output, is_error)``; never raises."""
        entry = self._tools.get(name)
        if entry is None:
            return f"No such tool: {name}. Available: {', '.join(sorted(self._tools))}", True
        try:
            result = entry.fn(**args)
        except Exception as exc:
            return f"{type(exc).__name__}: {exc}", True
        return stringify(result), False


def stringify(result: Any) -> str:
    if isinstance(result, str):
        return result
    if result is None:
        return "(no output)"
    try:
        return json.dumps(result, indent=2, default=str)
    except (TypeError, ValueError):
        return str(result)
