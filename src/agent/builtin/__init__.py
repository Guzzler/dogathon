"""Tools that ship with the scaffold. Drop new modules here and register them."""

from ..tools import Registry
from . import shelter, web


def registry() -> Registry:
    """Every builtin tool, plus Arcade's if a key is configured."""
    reg = Registry().add_module(shelter).add_module(web)

    from .. import arcade_tools

    if arcade_tools.available():
        reg.add(*arcade_tools.load())

    return reg


__all__ = ["registry", "shelter", "web"]
