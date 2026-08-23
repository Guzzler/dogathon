"""Validation for the hand-authored enrichment layer.

There is deliberately no API call here. The roster is built once and committed, so the
descriptive fields — notes, traits, needs, energy — are written by hand into
`data/enrichment.json` rather than generated at import time. That means no key, no cost,
no concurrency, and no run-to-run variation in what ships.

What survives is the checking. These are the rules the hand-written text has to pass, and
they exist because the failure they prevent is a false claim on a real animal's profile.
"""

from __future__ import annotations

import re

# Compatibility with kids, dogs and cats is a safety claim. It may come only from the
# shelter's own structured field, never from prose someone wrote about the listing.
_COMPAT = re.compile(r"good\s+with\s+(kids|children|dogs|cats)", re.I)
_SALES = re.compile(r"(adoption fee|\$\d|apply at|application|fill out|call us|email us)", re.I)


def clean_chips(raw: list[str] | None, cap: int) -> list[str]:
    out: list[str] = []
    for chip in raw or []:
        chip = (chip or "").strip().strip(".")
        if not chip or len(chip) > 24:
            continue
        if any(ch.isdigit() for ch in chip) or "$" in chip:
            continue
        if chip not in out:
            out.append(chip)
    return out[:cap]


def clean_notes(notes: str | None) -> str:
    """Returns "" for anything that shouldn't ship — reject, never repair."""
    text = (notes or "").strip()
    if not text or len(text) > 240:
        return ""
    if _COMPAT.search(text) or _SALES.search(text):
        return ""
    return text


def clean_energy(value: object) -> int | None:
    """Out of range would render as `undefined` through ENERGY_WORD[n] in the UI."""
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value if 0 <= value <= 4 else None


def apply_enrichment(dog: dict, entry: dict | None) -> dict:
    """Merge one hand-written entry onto a normalised dog, dropping anything invalid.

    Precedence differs by field, and deliberately:
      * `notes` and `traits` — hand-written wins. The shelter's own `qualities` are usually
        one-word and generic; a sentence read from their description is more useful.
      * `needs` — merged. Structured flags (yard required, special needs) are facts; the
        hand-written ones are things only the description mentions. Both belong.
      * `energy_level` — the source wins. A level the shelter published is better evidence
        than anyone's reading of their prose, so this only fills a gap.
    """
    if not entry:
        return {}
    # Entries carry a `_name` so the file is readable next to the ids; it isn't data.
    out: dict = {}

    notes = clean_notes(entry.get("notes"))
    if notes:
        out["notes"] = notes

    traits = clean_chips(entry.get("traits"), 4)
    if traits:
        out["traits"] = traits

    extra_needs = clean_chips(entry.get("needs"), 3)
    if extra_needs:
        merged = list(dog.get("needs") or [])
        for need in extra_needs:
            if need not in merged:
                merged.append(need)
        out["needs"] = merged[:4]

    if dog.get("energy_level") is None:
        energy = clean_energy(entry.get("energy_level"))
        if energy is not None:
            out["energy_level"] = energy

    # Compatibility is a safety claim, so it is a structured field rather than prose, and it
    # may be set only where the shelter's own write-up says so outright ("he gets along with
    # kids, adults, and other dogs", "she'd like to avoid sharing a home"). Silence stays
    # null -- an unassessed dog must never render as "Not recommended".
    for key in ("good_with_kids", "good_with_dogs", "good_with_cats"):
        if key in entry and isinstance(entry[key], bool):
            out[key] = entry[key]

    return out


def fallback_notes(dog: dict) -> str:
    """Said plainly when there's nothing to say, rather than inventing a personality."""
    bits = [dog.get("breed", "Dog")]
    years = dog.get("age_years")
    if years is not None:
        bits.append(f"{round(years * 12)} months old" if years < 1 else f"about {years:g} years old")
    who = dog.get("shelter", {}).get("short") or "The shelter"
    return f"{', '.join(bits)}. {who} hasn't written a description for {dog['name']} yet."
