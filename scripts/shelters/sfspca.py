"""Scrape the SF SPCA's adoptable dogs.

Chosen after the alternatives fell over: Petfinder's API was decommissioned in December
2025, RescueGroups needs a key granted by a human, and both only carry adoption listings.
The SF SPCA publishes more than either — their pages are server-rendered (no browser
needed), the descriptions are written by staff who know the dog, and they mark which dogs
are currently in a foster home.

Enumeration comes from their own sitemap rather than the JavaScript-rendered listing page,
which is both more reliable and gentler on them. 32 URLs, fetched once, slowly.
"""

from __future__ import annotations

import re
import time
from typing import Any

import httpx

SITEMAP = "https://www.sfspca.org/sfspca-adoption-sitemap.xml"
UA = "Pawthway/1.0 (foster matching demo; contact via github.com/Guzzler/dogathon)"

# One organisation, two campuses. Coordinates are the real street addresses.
CAMPUS = {
    "id": "sfspca-mission",
    "name": "SF SPCA Mission Campus",
    "short": "SF SPCA",
    "address": "201 Alabama St, San Francisco",
    "lat": 37.7663,
    "lng": -122.4122,
}

# Their sitemap mixes dogs and cats. Breed is the cleanest separator — cat breeds are
# distinctive, and a wrong guess here would put a cat in a dog app.
# Their sitemap mixes dogs and cats, and a cat in a dog app is the worst possible miss.
# Two independent checks, because neither is sufficient alone: a cat-breed list (finite and
# well known) and the write-up's own vocabulary. "Domestic Medium Hair" needs the optional
# space; "Turkish Van" is a cat despite sounding like nothing in particular.
_CAT_BREED = re.compile(
    r"(?i)\b(domestic\s+(short|medium|long)\s*hair|siamese|tabby|persian|maine\s+coon|"
    r"ragdoll|ragamuffin|bengal|sphynx|russian\s+blue|calico|tortoiseshell|abyssinian|"
    r"american\s+shorthair|exotic\s+shorthair|turkish\s+(van|angora)|himalayan|burmese|"
    r"birman|manx|cymric|devon\s+rex|cornish\s+rex|selkirk\s+rex|scottish\s+fold|"
    r"norwegian\s+forest|siberian\s+forest|savannah|ocicat|balinese|somali|snowshoe|"
    r"chartreux|korat|singapura|tonkinese|havana\s+brown|american\s+curl|munchkin|"
    r"japanese\s+bobtail|egyptian\s+mau|oriental\s+shorthair|laperm|nebelung|"
    r"pixie[- ]?bob|toyger|chausie|bombay|british\s+shorthair)\b"
)
_CAT_WORDS = re.compile(r"(?i)\b(cat|cats|kitten|kittens|feline|litter\s?box)\b")
_DOG_WORDS = re.compile(r"(?i)\b(dog|dogs|pup|puppy|canine|leash|walks?)\b")

# They record foster placement in prose, not as a field, and phrase it several ways.
_IN_FOSTER = re.compile(
    r"(?i)(currently in a foster home|in a foster home|foster (parent|mom|dad|family|home)s?)"
)

_TAG = re.compile(r"(?s)<[^>]+>")
_FACT = re.compile(
    r"<strong>\s*([A-Za-z ]+?)\s*:\s*</strong>\s*([^<]*)", re.I
)
# The write-up is the post body. The text-editor widgets on the page are the newsletter
# sign-up and the footer, so targeting those picks up boilerplate instead.
_BODY = re.compile(
    r'(?s)elementor-widget-theme-post-content.*?<div class="elementor-widget-container">(.*)'
)
_PARA = re.compile(r"(?s)<p[^>]*>(.*?)</p>")


def _clean(raw: str) -> str:
    text = (
        raw.replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
        .replace("&#8217;", "'").replace("&#8216;", "'").replace("&nbsp;", " ")
        .replace("&lt;", "<").replace("&gt;", ">").replace("&hellip;", "…")
        .replace("&#8211;", "–").replace("&#8212;", "—")
    )
    return re.sub(r"\s+", " ", _TAG.sub(" ", text)).strip()


# The write-up runs into the facts block and the calls to action; cut there.
_TAIL = re.compile(r"(?i)\s*(Age:\s*\d|Not ready to adopt\?|Help me get seen|Share my profile)")
# Every second dog opens with this, and it says nothing about the dog.
_SPONSOR = re.compile(
    r"(?i)^\s*(This dog.s )?adoption fee (has been|is) generously sponsored!?\s*"
)


def _trim(text: str) -> str:
    cut = _TAIL.search(text)
    if cut:
        text = text[: cut.start()]
    return _SPONSOR.sub("", text).strip()


def dog_urls(client: httpx.Client) -> list[str]:
    r = client.get(SITEMAP)
    r.raise_for_status()
    return re.findall(r"<loc>([^<]+)</loc>", r.text)


def parse(html: str, url: str) -> dict[str, Any] | None:
    """One adoption page -> a raw record, or None if it isn't an adoptable dog.

    Returns the shelter's own values verbatim. Turning them into a Dog happens in
    normalize(), so this stays a faithful reading of the page.
    """
    title = re.search(r'<title>([^<]+)</title>', html)
    name = re.sub(r"\s*[-–]\s*San Francisco SPCA\s*$", "", title.group(1)).strip() if title else ""
    if not name:
        return None

    facts = {k.strip().lower(): _clean(v) for k, v in _FACT.findall(html)}
    breed = facts.get("breed", "")
    if _CAT_BREED.search(breed):
        return None

    description = ""
    body = _BODY.search(html)
    if body:
        # Paragraphs only, and stop once we've left the post body into the page furniture.
        paras = []
        for raw in _PARA.findall(body.group(1)[:12000]):
            text = _clean(raw)
            if not text:
                continue
            if re.search(r"(?i)(join our community|501 \(c\)|privacy policy|EIN:)", text):
                break
            paras.append(text)
        description = " ".join(paras).strip()
    description = _trim(description)
    if len(description) < 40:
        description = ""

    # Second species check, now that we have the write-up. Catches cat breeds the list
    # doesn't know; a tie or a silent description falls through to the breed check alone.
    if description and len(_CAT_WORDS.findall(description)) > len(_DOG_WORDS.findall(description)):
        return None

    photo = re.search(r'og:image"\s+content="([^"]+)"', html)

    return {
        "source_url": url,
        "name": name,
        "age": facts.get("age", ""),
        "weight": facts.get("weight", ""),
        "gender": facts.get("gender", ""),
        "breed": breed,
        "description": description,
        "photo": photo.group(1) if photo else "",
        # They say so in the write-up rather than as a field.
        "in_foster": bool(_IN_FOSTER.search(description)),
    }


def scrape(delay: float = 1.0, limit: int | None = None) -> list[dict]:
    """Fetch every adoptable dog. One request per second — they're a small non-profit."""
    out: list[dict] = []
    with httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=30.0) as client:
        urls = dog_urls(client)
        if limit:
            urls = urls[:limit]
        for i, url in enumerate(urls, 1):
            try:
                r = client.get(url)
                r.raise_for_status()
            except Exception as exc:
                print(f"  [{i}/{len(urls)}] {url} -> {type(exc).__name__}")
                continue
            record = parse(r.text, url)
            if record:
                out.append(record)
            print(f"  [{i}/{len(urls)}] {record['name'] if record else '(not a dog)'}")
            time.sleep(delay)
    return out


# ---- raw record -> Pawthway Dog -------------------------------------------------------

_AGE = re.compile(r"(?:(\d+)\s*y)?[,\s]*(?:(\d+)\s*m)?", re.I)
_WEIGHT = re.compile(r"(\d+)\s*lbs?(?:[;,\s]+(\d+)\s*oz)?", re.I)


def parse_age_years(raw: str) -> float | None:
    """"4 y, 6 m" -> 4.5. Under a year matters: age_years < 1 drives the puppy tag."""
    m = _AGE.search(raw or "")
    if not m or not (m.group(1) or m.group(2)):
        return None
    years = int(m.group(1) or 0) + int(m.group(2) or 0) / 12
    return round(years, 2) if years else None


def parse_weight_lbs(raw: str) -> int | None:
    """"61 lbs; 4 oz" -> 61. Ounces are noise at this resolution."""
    m = _WEIGHT.search(raw or "")
    return int(m.group(1)) if m else None


def size_from_weight(lbs: int | None) -> str | None:
    """Mirrors sizeFromWeight() in web/src/lib/dog.ts — keep the thresholds in step."""
    if lbs is None:
        return None
    return "small" if lbs < 25 else "medium" if lbs <= 45 else "large"


def to_dog(raw: dict) -> dict[str, Any]:
    """A scraped record as a Dog. Only what the page actually said.

    Compatibility, energy, traits and needs are deliberately absent here — they live in
    data/enrichment.json, written by hand from each write-up, so that reading a shelter's
    prose stays a reviewed step rather than a regex guessing at safety claims.
    """
    weight = parse_weight_lbs(raw["weight"])
    age = parse_age_years(raw["age"])
    slug = raw["source_url"].rstrip("/").rsplit("/", 1)[-1]

    dog: dict[str, Any] = {
        "id": f"sfspca-{slug}",
        "name": raw["name"],
        "breed": raw["breed"] or "Mixed breed",
        "status": "available",
        # Nobody assessed these on the page; the enrichment fills them in where the
        # write-up says so explicitly.
        "good_with_kids": None,
        "good_with_dogs": None,
        "good_with_cats": None,
        "notes": "",
        "shelter": CAMPUS,
        "shelter_id": CAMPUS["id"],
        "source": "sfspca",
        "source_url": raw["source_url"],
    }
    if age is not None:
        dog["age_years"] = age
    if weight is not None:
        dog["weight_lbs"] = weight
        dog["size"] = size_from_weight(weight)
    if raw["photo"]:
        dog["photo_urls"] = [raw["photo"]]
    if raw["in_foster"]:
        # They already have someone. Surfaced as a status, not used to hide the dog.
        dog["in_foster_home"] = True

    return dog
