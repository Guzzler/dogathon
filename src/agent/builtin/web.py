"""Minimal outward-facing tools: fetch a page, do arithmetic."""

from __future__ import annotations

import re

import httpx

from ..tools import tool

_TAG = re.compile(r"<(script|style)[^>]*>.*?</\1>|<[^>]+>", re.S | re.I)
_BLANK = re.compile(r"\n\s*\n+")


@tool
def fetch_url(url: str, max_chars: int = 8000) -> str:
    """Fetch a URL and return its text content with HTML markup stripped.

    Args:
        url: The http or https URL to fetch.
        max_chars: Truncate the result to this many characters.
    """
    if not url.startswith(("http://", "https://")):
        raise ValueError("url must start with http:// or https://")

    response = httpx.get(url, follow_redirects=True, timeout=20.0)
    response.raise_for_status()
    body = response.text

    if "html" in response.headers.get("content-type", ""):
        body = _BLANK.sub("\n\n", _TAG.sub(" ", body))
        body = "\n".join(line.strip() for line in body.splitlines() if line.strip())

    return body[:max_chars]


@tool
def calculate(expression: str) -> str:
    """Evaluate an arithmetic expression, e.g. "(1200 * 0.15) + 40".

    Args:
        expression: Arithmetic using numbers and + - * / % ( ) only.
    """
    if not re.fullmatch(r"[\d\s+\-*/%().]+", expression):
        raise ValueError("expression may only contain numbers and + - * / % ( )")
    return str(eval(expression, {"__builtins__": {}}, {}))  # noqa: S307 - input is regex-gated
