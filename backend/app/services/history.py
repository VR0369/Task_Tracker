"""On-This-Day historical events.

Mock mode returns a random event from a small curated set matched to today's
month/day (falling back to any event).

Real mode fetches a *live* event by searching the web:

1.  **Google search** (primary) — scrapes the Google results page for today's
    date and extracts "YYYY — description" style events from the snippets.
    This is the "search Google and extract" path, but it is inherently
    fragile: Google offers no keyless API, throttles/blocks datacenter IPs
    (like Render's), and changes its markup often.
2.  **byabbe.se / Wikipedia** (fallback) — a free, keyless On-This-Day API used
    automatically whenever the Google scrape yields nothing.
3.  **Curated mock** (last resort) — so the widget never renders blank.
"""

from __future__ import annotations

import html
import random
import re
from datetime import datetime
from typing import Dict, List, Tuple

import httpx

from ..config import settings

# A handful of well-known events keyed by "MM-DD".
_CURATED = {
    "07-16": [("1969", "Apollo 11 launched from Kennedy Space Center on its way to the Moon.")],
    "07-17": [("1955", "Disneyland opened to the public in Anaheim, California.")],
    "07-20": [("1969", "Apollo 11 astronauts became the first humans to walk on the Moon.")],
    "12-17": [("1903", "The Wright brothers made the first powered airplane flight.")],
    "01-01": [("1983", "The ARPANET officially switched to TCP/IP, marking the birth of the modern internet.")],
}

_FALLBACK = [
    ("1440", "Johannes Gutenberg introduced movable-type printing to Europe."),
    ("1876", "Alexander Graham Bell was granted a patent for the telephone."),
    ("1990", "The first web page was created by Tim Berners-Lee at CERN."),
    ("2007", "The first iPhone went on sale, reshaping personal computing."),
]

# A desktop User-Agent makes Google return the classic results markup rather
# than a stripped-down mobile/consent page.
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Matches "1968 — Intel is founded", "1968 - ...", "1968: ...", "1968 – ...".
_EVENT_RE = re.compile(
    r"\b(1\d{3}|20\d{2})\s*[–—:\-]+\s*([A-Z][^<>\n]{15,200}?[.!?])"
)
_TAG_RE = re.compile(r"<[^>]+>")


def _mock_event() -> Dict:
    key = datetime.utcnow().strftime("%m-%d")
    pool = _CURATED.get(key, _FALLBACK)
    year, text = random.choice(pool)
    return {"year": year, "text": text, "is_mock": True}


def _parse_google(body: str) -> List[Tuple[str, str]]:
    """Strip tags from a Google results page and pull out "YYYY — text" events."""
    text = html.unescape(_TAG_RE.sub(" ", body))
    seen: set[str] = set()
    events: List[Tuple[str, str]] = []
    for year, desc in _EVENT_RE.findall(text):
        desc = re.sub(r"\s+", " ", desc).strip()
        key = f"{year}:{desc.lower()}"
        if key in seen:
            continue
        seen.add(key)
        events.append((year, desc))
    return events


async def _google_events(today: datetime) -> List[Tuple[str, str]]:
    """Search Google for today's historical events and extract them."""
    query = f"{_MONTHS[today.month - 1]} {today.day} in history events"
    url = "https://www.google.com/search"
    params = {"q": query, "hl": "en", "num": "20"}
    headers = {"User-Agent": _UA, "Accept-Language": "en-US,en;q=0.9"}
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        resp = await client.get(url, params=params, headers=headers)
        resp.raise_for_status()
        return _parse_google(resp.text)


async def _byabbe_events(today: datetime) -> List[Tuple[str, str]]:
    """Keyless Wikipedia-backed On-This-Day API used as a fallback."""
    url = f"https://byabbe.se/on-this-day/{today.month}/{today.day}/events.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        events = resp.json().get("events", [])
    return [(e.get("year", ""), e.get("description", "")) for e in events if e.get("description")]


async def get_on_this_day() -> Dict:
    if settings.mock_history:
        return _mock_event()

    today = datetime.utcnow()

    # 1) Live Google search (primary), 2) byabbe.se/Wikipedia (fallback).
    for source in (_google_events, _byabbe_events):
        try:
            events = await source(today)
        except Exception:
            events = []
        if events:
            year, text = random.choice(events)
            return {"year": year, "text": text, "is_mock": False}

    # 3) Curated mock so the widget never renders blank.
    return _mock_event()
