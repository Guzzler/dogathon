"""Interactive REPL: `uv run agent`, or `uv run agent "do the thing"`."""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm

from .builtin import registry
from .loop import Agent
from .tools import stringify

console = Console()

BANNER = "[bold]dogathon agent[/bold]  ·  /tools  /reset  /quit"


def _approve(name: str, args: dict) -> bool:
    console.print(
        Panel(
            stringify(args),
            title=f"[yellow]approve[/yellow] {name}",
            border_style="yellow",
        )
    )
    return Confirm.ask("  run it?", default=False, console=console)


def _render(agent: Agent, message: str) -> None:
    thinking_open = False
    text_open = False

    for event in agent.run(message):
        if event.kind == "thinking":
            if not thinking_open:
                console.print("\n[dim italic]thinking[/dim italic]", end="")
                thinking_open = True
            console.print(f"[dim italic]{event.text}[/dim italic]", end="")

        elif event.kind == "text":
            if thinking_open:
                console.print("\n")
                thinking_open = False
            if not text_open:
                text_open = True
            console.print(event.text, end="", highlight=False)

        elif event.kind == "tool_call":
            if thinking_open or text_open:
                console.print()
                thinking_open = text_open = False
            console.print(f"[cyan]→ {event.name}[/cyan] [dim]{stringify(event.args)}[/dim]")

        elif event.kind == "tool_result":
            colour = "red" if event.is_error else "green"
            body = event.text if len(event.text) <= 600 else event.text[:600] + " …"
            console.print(f"[{colour}]← {body}[/{colour}]\n")

        elif event.kind == "error":
            console.print(f"\n[bold red]{event.text}[/bold red]")

        elif event.kind == "turn_end":
            console.print("\n")


def main() -> int:
    load_dotenv()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        console.print("[bold red]ANTHROPIC_API_KEY is not set.[/bold red] Copy .env.example to .env.")
        return 1

    reg = registry()
    agent = Agent(reg, approve=_approve)

    if len(sys.argv) > 1:
        _render(agent, " ".join(sys.argv[1:]))
        return 0

    console.print(Panel(BANNER, border_style="blue"))
    console.print(f"[dim]{len(reg)} tools loaded[/dim]\n")

    while True:
        try:
            message = console.input("[bold blue]›[/bold blue] ").strip()
        except (EOFError, KeyboardInterrupt):
            console.print()
            return 0

        if not message:
            continue
        if message in ("/quit", "/exit"):
            return 0
        if message == "/reset":
            agent.reset()
            console.print("[dim]history cleared[/dim]\n")
            continue
        if message == "/tools":
            for entry in sorted(reg, key=lambda t: t.name):
                flag = " [yellow](needs approval)[/yellow]" if entry.dangerous else ""
                summary = entry.description.split("\n")[0]
                console.print(f"  [bold]{entry.name}[/bold]{flag} — [dim]{summary}[/dim]")
            console.print()
            continue

        _render(agent, message)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
