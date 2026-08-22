"""A small, general tool-calling agent built on Claude."""

from .loop import Agent, Event
from .tools import Registry, Tool, tool

__all__ = ["Agent", "Event", "Registry", "Tool", "tool"]
