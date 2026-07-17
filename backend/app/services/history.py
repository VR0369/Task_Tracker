"""On-This-Day historical events.

Mock mode returns a random event from a small curated set matched to today's
month/day (falling back to any event). Real mode queries the free, keyless
byabbe.se "On This Day" API.
"""

from __future__ import annotations

import random
from datetime import datetime
from typing import Dict

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


def _mock_event() -> Dict:
    key = datetime.utcnow().strftime("%m-%d")
    pool = _CURATED.get(key, _FALLBACK)
    year, text = random.choice(pool)
    return {"year": year, "text": text, "is_mock": True}


async def get_on_this_day() -> Dict:
    if settings.mock_history:
        return _mock_event()
    try:
        today = datetime.utcnow()
        url = f"https://byabbe.se/on-this-day/{today.month}/{today.day}/events.json"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            events = resp.json().get("events", [])
        if events:
            ev = random.choice(events)
            return {"year": ev.get("year", ""), "text": ev.get("description", ""), "is_mock": False}
    except Exception:
        pass
    return _mock_event()
