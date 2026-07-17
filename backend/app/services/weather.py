"""Weather service — mock generator by default, real AccuWeather when a key is set.

AccuWeather requires two calls: a location-search to resolve a city into a
location key, then a current-conditions call. Both are implemented; set
``MOCK_WEATHER=false`` and ``ACCUWEATHER_API_KEY`` to use them.
"""

from __future__ import annotations

import hashlib
import random
from typing import Dict, Optional

import httpx

from ..config import settings

_CONDITIONS = [
    ("Sunny", "01d"),
    ("Partly Cloudy", "02d"),
    ("Cloudy", "03d"),
    ("Light Rain", "10d"),
    ("Clear", "01n"),
    ("Windy", "50d"),
]


def _mock_weather(location: str) -> Dict:
    # Deterministic-ish per city so it feels stable within a session.
    seed = int(hashlib.md5(location.lower().encode()).hexdigest(), 16) % 1000
    rng = random.Random(seed)
    temp_c = round(rng.uniform(6, 30), 1)
    condition, icon = rng.choice(_CONDITIONS)
    forecast = []
    for i in range(1, 6):
        c, ic = rng.choice(_CONDITIONS)
        hi = round(temp_c + rng.uniform(-2, 5), 1)
        lo = round(temp_c - rng.uniform(2, 8), 1)
        forecast.append(
            {"day_offset": i, "high_c": hi, "low_c": lo, "condition": c, "icon": ic}
        )
    return {
        "location": location.title(),
        "temperature_c": temp_c,
        "temperature_f": round(temp_c * 9 / 5 + 32, 1),
        "humidity": rng.randint(35, 85),
        "wind_kph": round(rng.uniform(3, 28), 1),
        "condition": condition,
        "icon": icon,
        "is_mock": True,
        "forecast": forecast,
    }


async def _accuweather(location: str) -> Optional[Dict]:
    key = settings.accuweather_api_key
    base = settings.accuweather_base_url
    async with httpx.AsyncClient(timeout=10) as client:
        loc_resp = await client.get(
            f"{base}/locations/v1/cities/search",
            params={"apikey": key, "q": location},
        )
        loc_resp.raise_for_status()
        locations = loc_resp.json()
        if not locations:
            return None
        loc = locations[0]
        loc_key = loc["Key"]

        cur_resp = await client.get(
            f"{base}/currentconditions/v1/{loc_key}",
            params={"apikey": key, "details": "true"},
        )
        cur_resp.raise_for_status()
        cur = cur_resp.json()[0]

    temp_c = cur["Temperature"]["Metric"]["Value"]
    return {
        "location": f'{loc["LocalizedName"]}, {loc.get("Country", {}).get("ID", "")}'.strip(", "),
        "temperature_c": temp_c,
        "temperature_f": cur["Temperature"]["Imperial"]["Value"],
        "humidity": cur.get("RelativeHumidity", 0),
        "wind_kph": cur.get("Wind", {}).get("Speed", {}).get("Metric", {}).get("Value", 0),
        "condition": cur.get("WeatherText", "—"),
        "icon": str(cur.get("WeatherIcon", "01d")),
        "is_mock": False,
        "forecast": [],
    }


async def get_weather(location: str) -> Dict:
    if not settings.mock_weather and settings.accuweather_api_key:
        try:
            data = await _accuweather(location)
            if data:
                return data
        except Exception:
            # Graceful degradation: fall back to mock if the API is unreachable.
            pass
    return _mock_weather(location)
