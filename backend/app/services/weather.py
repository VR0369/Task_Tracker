"""Weather service.

Live data comes from WeatherAPI.com (one ``forecast.json`` call → current +
hourly + daily + air quality; ``search.json`` → autocomplete). Set
``MOCK_WEATHER=false`` and ``WEATHERAPI_API_KEY`` to go live. Without a key the
service returns a deterministic mock in the identical normalized shape, so the
whole UI (hourly scroll, forecast, AQI, …) renders with zero credentials.

Responses are cached in-memory (~10 min) to cut API usage and to serve as an
offline fallback if the provider is briefly unreachable.
"""

from __future__ import annotations

import hashlib
import logging
import math
import random
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx

from ..config import settings

logger = logging.getLogger("task_tracker.weather")

FORECAST_TTL = 600  # seconds (10 min)
SEARCH_TTL = 300  # seconds (5 min)
DEFAULT_LOCATION = "New York"

# (display text, WeatherAPI condition code) — used by the mock generator.
_CONDITIONS = [
    ("Sunny", 1000),
    ("Partly Cloudy", 1003),
    ("Cloudy", 1006),
    ("Overcast", 1009),
    ("Light Rain", 1183),
    ("Clear", 1000),
]

_MOCK_CITIES = [
    ("New York", "New York", "United States of America", 40.71, -74.01),
    ("London", "City of London, Greater London", "United Kingdom", 51.52, -0.11),
    ("San Francisco", "California", "United States of America", 37.77, -122.42),
    ("Tokyo", "Tokyo", "Japan", 35.69, 139.69),
    ("Paris", "Ile-de-France", "France", 48.87, 2.33),
    ("Sydney", "New South Wales", "Australia", -33.87, 151.21),
    ("Toronto", "Ontario", "Canada", 43.70, -79.42),
    ("Berlin", "Berlin", "Germany", 52.52, 13.39),
    ("Mumbai", "Maharashtra", "India", 19.07, 72.88),
    ("Dubai", "Dubai", "United Arab Emirates", 25.07, 55.31),
    ("Singapore", "", "Singapore", 1.29, 103.86),
    ("Chicago", "Illinois", "United States of America", 41.85, -87.65),
]

_COORDS_RE = re.compile(r"^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$")


class LocationNotFound(Exception):
    """Raised when the provider can't resolve the requested location."""


# --------------------------------------------------------------------------- #
# tiny in-memory TTL cache
# --------------------------------------------------------------------------- #
_cache: Dict[str, tuple] = {}


def _cache_get(key: str, allow_expired: bool = False):
    hit = _cache.get(key)
    if not hit:
        return None
    expiry, value = hit
    if allow_expired or expiry > time.time():
        return value
    return None


def _cache_set(key: str, value, ttl: int) -> None:
    _cache[key] = (time.time() + ttl, value)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _live_enabled() -> bool:
    return not settings.mock_weather and bool(settings.weatherapi_api_key)


def _c2f(c: float) -> float:
    return round(c * 9 / 5 + 32, 1)


def _icon(url: str) -> str:
    if url and url.startswith("//"):
        return "https:" + url
    return url or ""


def _hour_label(dt: datetime) -> str:
    return dt.strftime("%I %p").lstrip("0")


def _resolve_q(location: Optional[str], lat, lon) -> Optional[str]:
    if lat is not None and lon is not None:
        return f"{round(float(lat), 4)},{round(float(lon), 4)}"
    if location and location.strip():
        return location.strip()
    return None


def _looks_like_coords(s: str) -> bool:
    return bool(_COORDS_RE.match(s.strip()))


# --------------------------------------------------------------------------- #
# WeatherAPI.com (live)
# --------------------------------------------------------------------------- #
def _normalize(data: dict) -> Dict:
    loc = data.get("location", {})
    cur = data.get("current", {})
    fdays = data.get("forecast", {}).get("forecastday", [])

    # Rolling next-24h from the location's local "now".
    now_epoch = loc.get("localtime_epoch") or cur.get("last_updated_epoch") or 0
    all_hours: List[dict] = []
    for day in fdays:
        all_hours.extend(day.get("hour", []))
    all_hours.sort(key=lambda h: h.get("time_epoch", 0))
    upcoming = [h for h in all_hours if h.get("time_epoch", 0) >= now_epoch - 1800][:24]
    if not upcoming:
        upcoming = all_hours[:24]

    hourly = []
    for h in upcoming:
        cond = h.get("condition", {})
        try:
            lbl = _hour_label(datetime.strptime(h["time"], "%Y-%m-%d %H:%M"))
        except Exception:
            lbl = h.get("time", "")
        hourly.append(
            {
                "time": h.get("time", ""),
                "label": lbl,
                "temp_c": h.get("temp_c", 0),
                "temp_f": h.get("temp_f", 0),
                "condition": cond.get("text", ""),
                "icon": _icon(cond.get("icon", "")),
                "code": cond.get("code", 0),
                "chance_of_rain": int(h.get("chance_of_rain", 0)),
                "is_day": int(h.get("is_day", 1)),
            }
        )

    daily = []
    for d in fdays:
        day = d.get("day", {})
        cond = day.get("condition", {})
        try:
            dname = datetime.strptime(d["date"], "%Y-%m-%d").strftime("%a")
        except Exception:
            dname = d.get("date", "")
        daily.append(
            {
                "date": d.get("date", ""),
                "day_name": dname,
                "max_c": day.get("maxtemp_c", 0),
                "max_f": day.get("maxtemp_f", 0),
                "min_c": day.get("mintemp_c", 0),
                "min_f": day.get("mintemp_f", 0),
                "condition": cond.get("text", ""),
                "icon": _icon(cond.get("icon", "")),
                "code": cond.get("code", 0),
                "chance_of_rain": int(day.get("daily_chance_of_rain", 0)),
            }
        )

    astro = fdays[0].get("astro", {}) if fdays else {}
    aq = cur.get("air_quality") or {}
    cur_cond = cur.get("condition", {})
    aqi = None
    if aq:
        aqi = {
            "us_epa_index": int(aq.get("us-epa-index", 0) or 0),
            "pm2_5": aq.get("pm2_5"),
            "pm10": aq.get("pm10"),
            "o3": aq.get("o3"),
        }

    return {
        "location": loc.get("name", ""),
        "region": loc.get("region", ""),
        "country": loc.get("country", ""),
        "lat": loc.get("lat"),
        "lon": loc.get("lon"),
        "localtime": loc.get("localtime", ""),
        "temperature_c": cur.get("temp_c", 0),
        "temperature_f": cur.get("temp_f", 0),
        "feelslike_c": cur.get("feelslike_c", cur.get("temp_c", 0)),
        "feelslike_f": cur.get("feelslike_f", cur.get("temp_f", 0)),
        "condition": cur_cond.get("text", ""),
        "condition_code": cur_cond.get("code", 0),
        "icon": _icon(cur_cond.get("icon", "")),
        "humidity": int(cur.get("humidity", 0)),
        "wind_kph": cur.get("wind_kph", 0),
        "wind_dir": cur.get("wind_dir", ""),
        "wind_degree": int(cur.get("wind_degree", 0)),
        "pressure_mb": cur.get("pressure_mb", 0),
        "visibility_km": cur.get("vis_km", 0),
        "uv": cur.get("uv", 0),
        "cloud": int(cur.get("cloud", 0)),
        "is_day": int(cur.get("is_day", 1)),
        "sunrise": astro.get("sunrise", ""),
        "sunset": astro.get("sunset", ""),
        "last_updated": cur.get("last_updated", ""),
        "aqi": aqi,
        "hourly": hourly,
        "daily": daily,
        "is_mock": False,
    }


async def _weatherapi(q: str) -> Dict:
    base = settings.weatherapi_base_url
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{base}/forecast.json",
            params={
                "key": settings.weatherapi_api_key,
                "q": q,
                "days": 3,  # free plan max; upgrades cleanly on a paid key
                "aqi": "yes",
                "alerts": "no",
            },
        )
    if resp.status_code == 400:
        code = None
        try:
            code = resp.json().get("error", {}).get("code")
        except Exception:
            pass
        if code == 1006:
            raise LocationNotFound(q)
    resp.raise_for_status()
    return _normalize(resp.json())


# --------------------------------------------------------------------------- #
# mock (deterministic, same shape as live)
# --------------------------------------------------------------------------- #
def _mock_weather(q: Optional[str]) -> Dict:
    raw = q or DEFAULT_LOCATION
    name = "Your location" if _looks_like_coords(raw) else raw.title()
    seed = int(hashlib.md5(raw.lower().encode()).hexdigest(), 16) % 100000
    rng = random.Random(seed)

    base_temp = round(rng.uniform(6, 30), 1)
    condition, code = rng.choice(_CONDITIONS)
    now = datetime.now()

    hourly = []
    for i in range(24):
        t = now + timedelta(hours=i)
        c, cc = rng.choice(_CONDITIONS)
        tc = round(base_temp + 4 * math.sin(i / 24 * 2 * math.pi) + rng.uniform(-1, 1), 1)
        hourly.append(
            {
                "time": t.strftime("%Y-%m-%d %H:00"),
                "label": _hour_label(t),
                "temp_c": tc,
                "temp_f": _c2f(tc),
                "condition": c,
                "icon": "",
                "code": cc,
                "chance_of_rain": rng.randint(0, 80),
                "is_day": 1 if 6 <= t.hour <= 19 else 0,
            }
        )

    daily = []
    for i in range(3):
        d = (now + timedelta(days=i)).date()
        c, cc = rng.choice(_CONDITIONS)
        hi = round(base_temp + rng.uniform(0, 5), 1)
        lo = round(base_temp - rng.uniform(2, 8), 1)
        daily.append(
            {
                "date": d.isoformat(),
                "day_name": d.strftime("%a"),
                "max_c": hi,
                "max_f": _c2f(hi),
                "min_c": lo,
                "min_f": _c2f(lo),
                "condition": c,
                "icon": "",
                "code": cc,
                "chance_of_rain": rng.randint(0, 80),
            }
        )

    feels = round(base_temp + rng.uniform(-2, 2), 1)
    is_day = 1 if 6 <= now.hour <= 19 else 0
    return {
        "location": name,
        "region": "",
        "country": "",
        "lat": None,
        "lon": None,
        "localtime": now.strftime("%Y-%m-%d %H:%M"),
        "temperature_c": base_temp,
        "temperature_f": _c2f(base_temp),
        "feelslike_c": feels,
        "feelslike_f": _c2f(feels),
        "condition": condition,
        "condition_code": code,
        "icon": "",
        "humidity": rng.randint(35, 85),
        "wind_kph": round(rng.uniform(3, 28), 1),
        "wind_dir": rng.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
        "wind_degree": rng.randint(0, 359),
        "pressure_mb": round(rng.uniform(1000, 1025), 1),
        "visibility_km": round(rng.uniform(6, 12), 1),
        "uv": rng.randint(0, 9),
        "cloud": rng.randint(0, 100),
        "is_day": is_day,
        "sunrise": "06:12 AM",
        "sunset": "07:58 PM",
        "last_updated": now.strftime("%Y-%m-%d %H:%M"),
        "aqi": {
            "us_epa_index": rng.randint(1, 4),
            "pm2_5": round(rng.uniform(2, 40), 1),
            "pm10": round(rng.uniform(5, 60), 1),
            "o3": round(rng.uniform(10, 80), 1),
        },
        "hourly": hourly,
        "daily": daily,
        "is_mock": True,
    }


def _mock_search(query: str) -> List[Dict]:
    ql = query.lower()
    out = []
    for name, region, country, lat, lon in _MOCK_CITIES:
        if ql in name.lower() or ql in country.lower():
            out.append(
                {"name": name, "region": region, "country": country, "lat": lat, "lon": lon}
            )
    return out[:8]


# --------------------------------------------------------------------------- #
# public API
# --------------------------------------------------------------------------- #
async def get_weather(
    location: Optional[str] = None, lat=None, lon=None
) -> Dict:
    q = _resolve_q(location, lat, lon)

    if _live_enabled():
        key = f"forecast:{(q or DEFAULT_LOCATION).lower()}"
        cached = _cache_get(key)
        if cached is not None:
            return cached
        try:
            data = await _weatherapi(q or DEFAULT_LOCATION)
            _cache_set(key, data, FORECAST_TTL)
            return data
        except LocationNotFound:
            raise
        except Exception as exc:  # network / key / rate-limit → degrade gracefully
            logger.warning("WeatherAPI failed (%s); serving fallback.", exc)
            stale = _cache_get(key, allow_expired=True)
            if stale is not None:
                return stale

    return _mock_weather(q)


async def search_locations(query: str) -> List[Dict]:
    query = (query or "").strip()
    if len(query) < 2:
        return []

    if _live_enabled():
        key = f"search:{query.lower()}"
        cached = _cache_get(key)
        if cached is not None:
            return cached
        try:
            base = settings.weatherapi_base_url
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(
                    f"{base}/search.json",
                    params={"key": settings.weatherapi_api_key, "q": query},
                )
                resp.raise_for_status()
                results = [
                    {
                        "name": i.get("name", ""),
                        "region": i.get("region", ""),
                        "country": i.get("country", ""),
                        "lat": i.get("lat"),
                        "lon": i.get("lon"),
                    }
                    for i in resp.json()
                ]
            _cache_set(key, results, SEARCH_TTL)
            return results
        except Exception as exc:
            logger.warning("WeatherAPI search failed (%s).", exc)
            return []

    return _mock_search(query)
