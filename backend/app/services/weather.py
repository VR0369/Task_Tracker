"""Weather service.

Live data comes from **Open-Meteo** — a free, keyless API (no signup):
- ``/v1/forecast``            → current + hourly + daily
- ``geocoding-api``           → city/state search + name→coords
- ``air-quality-api``         → US AQI / PM2.5 / PM10 / ozone
- BigDataCloud reverse-geocode → coords→city name (Open-Meteo forecast has none)
- Zippopotam.us               → ZIP/postal code → city

Set ``MOCK_WEATHER=false`` to go live (no key required). Everything is returned
in one normalized shape; without connectivity the service falls back to a
deterministic mock in the identical shape, so the whole UI renders regardless.

Responses are cached in-memory (~10 min) to cut API usage and to serve as an
offline fallback if a provider is briefly unreachable.
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
FALLBACK_TTL = 120  # cooldown after a live failure (e.g. 429) — avoids retry storms
DEFAULT_LOCATION = "South Plainfiedld, NJ, USA"  # fallback if no location is given 

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
AIRQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"
ZIP_URL = "https://api.zippopotam.us"

# WMO weather code → human text. Wording is chosen so the frontend's keyword
# icon matcher (sun/clear, partly, rain, snow, drizzle, fog, thunder) resolves.
_WMO = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}

_DIRS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
         "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]

_MOCK_CITIES = [
    ("New York", "New York", "United States", 40.71, -74.01),
    ("London", "England", "United Kingdom", 51.52, -0.11),
    ("San Francisco", "California", "United States", 37.77, -122.42),
    ("Tokyo", "Tokyo", "Japan", 35.69, 139.69),
    ("Paris", "Ile-de-France", "France", 48.87, 2.33),
    ("Sydney", "New South Wales", "Australia", -33.87, 151.21),
    ("Toronto", "Ontario", "Canada", 43.70, -79.42),
    ("Berlin", "Berlin", "Germany", 52.52, 13.39),
    ("Mumbai", "Maharashtra", "India", 19.07, 72.88),
    ("Dubai", "Dubai", "United Arab Emirates", 25.07, 55.31),
    ("Singapore", "", "Singapore", 1.29, 103.86),
    ("Chicago", "Illinois", "United States", 41.85, -87.65),
]

_CONDITIONS = [
    ("Sunny", 0), ("Partly cloudy", 2), ("Cloudy", 3),
    ("Overcast", 3), ("Light rain", 61), ("Clear", 0),
]

_COORDS_RE = re.compile(r"^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$")


class LocationNotFound(Exception):
    """Raised when a location can't be resolved to coordinates."""


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
    # Open-Meteo needs no key — live whenever mock mode is off.
    return not settings.mock_weather


def _c2f(c) -> float:
    return round(float(c) * 9 / 5 + 32, 1)


def _hour_label(dt: datetime) -> str:
    return dt.strftime("%I %p").lstrip("0")


def _clock(iso: str) -> str:
    """'2026-07-18T05:48' -> '5:48 AM'."""
    try:
        return datetime.strptime(iso[:16], "%Y-%m-%dT%H:%M").strftime("%I:%M %p").lstrip("0")
    except Exception:
        return ""


def _wind_dir(deg) -> str:
    try:
        return _DIRS[int((float(deg) % 360) / 22.5 + 0.5) % 16]
    except Exception:
        return ""


def _aqi_to_epa(aqi) -> int:
    """US AQI (0–500) → US EPA index (1–6) the frontend expects."""
    if aqi is None:
        return 0
    for idx, hi in enumerate((50, 100, 150, 200, 300), start=1):
        if aqi <= hi:
            return idx
    return 6


def _resolve_q(location: Optional[str], lat, lon) -> Optional[str]:
    if lat is not None and lon is not None:
        return f"{round(float(lat), 4)},{round(float(lon), 4)}"
    if location and location.strip():
        return location.strip()
    return None


def _looks_like_coords(s: str) -> bool:
    return bool(_COORDS_RE.match(s.strip()))


# --------------------------------------------------------------------------- #
# geocoding (name/ZIP -> coords, coords -> name)
# --------------------------------------------------------------------------- #
async def _geocode_search(query: str, count: int = 8) -> List[Dict]:
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        resp = await client.get(
            GEOCODE_URL,
            params={"name": query, "count": count, "language": "en", "format": "json"},
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
    return [
        {
            "name": r.get("name", ""),
            "region": r.get("admin1", "") or "",
            "country": r.get("country", "") or "",
            "lat": r.get("latitude"),
            "lon": r.get("longitude"),
        }
        for r in results
        if r.get("latitude") is not None and r.get("longitude") is not None
    ]


async def _zip_lookup(zipcode: str, country: str = "us") -> Optional[Dict]:
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(f"{ZIP_URL}/{country}/{zipcode}")
        if resp.status_code != 200:
            return None
        j = resp.json()
        place = (j.get("places") or [None])[0]
        if not place:
            return None
        return {
            "name": place.get("place name", ""),
            "region": place.get("state", "") or place.get("state abbreviation", ""),
            "country": j.get("country", ""),
            "lat": float(place["latitude"]),
            "lon": float(place["longitude"]),
        }
    except Exception as exc:
        logger.warning("ZIP lookup failed (%s).", exc)
        return None


async def _geocode(query: str) -> Optional[Dict]:
    q = query.strip()
    if q.isdigit():  # ZIP / numeric postal code
        loc = await _zip_lookup(q)
        if loc:
            return loc
    results = await _geocode_search(q, count=1)
    return results[0] if results else None


async def _reverse_geocode(lat: float, lon: float) -> Optional[Dict]:
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(
                REVERSE_URL,
                params={"latitude": lat, "longitude": lon, "localityLanguage": "en"},
            )
            resp.raise_for_status()
            j = resp.json()
        name = j.get("city") or j.get("locality") or j.get("principalSubdivision") or "Your location"
        return {
            "name": name,
            "region": j.get("principalSubdivision", "") or "",
            "country": j.get("countryName", "") or "",
        }
    except Exception as exc:
        logger.warning("Reverse geocode failed (%s).", exc)
        return None


# --------------------------------------------------------------------------- #
# Open-Meteo forecast (live)
# --------------------------------------------------------------------------- #
async def _open_meteo(lat: float, lon: float) -> Dict:
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        wx = await client.get(
            FORECAST_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": (
                    "temperature_2m,relative_humidity_2m,apparent_temperature,"
                    "is_day,weather_code,cloud_cover,pressure_msl,"
                    "wind_speed_10m,wind_direction_10m"
                ),
                "hourly": (
                    "temperature_2m,weather_code,precipitation_probability,"
                    "is_day,visibility,uv_index"
                ),
                "daily": (
                    "weather_code,temperature_2m_max,temperature_2m_min,"
                    "precipitation_probability_max,sunrise,sunset,uv_index_max"
                ),
                "timezone": "auto",
                "wind_speed_unit": "kmh",
                "forecast_days": 7,
            },
        )
        wx.raise_for_status()

        aq_current = None
        try:  # air quality is best-effort — never fail the whole call over it
            aq = await client.get(
                AIRQ_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "us_aqi,pm2_5,pm10,ozone",
                    "timezone": "auto",
                },
            )
            aq.raise_for_status()
            aq_current = aq.json().get("current")
        except Exception as exc:
            logger.info("Air quality unavailable (%s).", exc)

    return _normalize(wx.json(), aq_current)


def _normalize(data: dict, aq: Optional[dict]) -> Dict:
    cur = data.get("current", {}) or {}
    h = data.get("hourly", {}) or {}
    d = data.get("daily", {}) or {}

    htimes: List[str] = h.get("time", []) or []
    cur_time = cur.get("time", "") or (htimes[0] if htimes else "")

    # Index of the current hour within the hourly arrays.
    now_hour = cur_time[:13]
    start = 0
    for i, t in enumerate(htimes):
        if t[:13] >= now_hour:
            start = i
            break

    def _hat(arr, i, default=0):
        try:
            v = arr[i]
            return v if v is not None else default
        except Exception:
            return default

    is_day = int(cur.get("is_day", 1) or 0)
    code = int(cur.get("weather_code", 0) or 0)

    # Current UV / visibility live in the hourly series, not `current`.
    uv = _hat(h.get("uv_index", []), start, 0)
    vis_m = _hat(h.get("visibility", []), start, 0)

    hourly = []
    codes = h.get("weather_code", [])
    temps = h.get("temperature_2m", [])
    pops = h.get("precipitation_probability", [])
    isdays = h.get("is_day", [])
    for i in range(start, min(start + 24, len(htimes))):
        try:
            dt = datetime.strptime(htimes[i][:16], "%Y-%m-%dT%H:%M")
            lbl = _hour_label(dt)
        except Exception:
            lbl = htimes[i]
        c = int(_hat(codes, i, 0))
        tc = round(float(_hat(temps, i, 0)), 1)
        hourly.append(
            {
                "time": htimes[i].replace("T", " "),
                "label": lbl,
                "temp_c": tc,
                "temp_f": _c2f(tc),
                "condition": _WMO.get(c, "—"),
                "icon": "",
                "code": c,
                "chance_of_rain": int(_hat(pops, i, 0)),
                "is_day": int(_hat(isdays, i, 1)),
            }
        )

    daily = []
    dtimes = d.get("time", []) or []
    dcodes = d.get("weather_code", [])
    dmax = d.get("temperature_2m_max", [])
    dmin = d.get("temperature_2m_min", [])
    dpop = d.get("precipitation_probability_max", [])
    for i in range(len(dtimes)):
        try:
            dname = datetime.strptime(dtimes[i], "%Y-%m-%d").strftime("%a")
        except Exception:
            dname = dtimes[i]
        c = int(_hat(dcodes, i, 0))
        hi = round(float(_hat(dmax, i, 0)), 1)
        lo = round(float(_hat(dmin, i, 0)), 1)
        daily.append(
            {
                "date": dtimes[i],
                "day_name": dname,
                "max_c": hi,
                "max_f": _c2f(hi),
                "min_c": lo,
                "min_f": _c2f(lo),
                "condition": _WMO.get(c, "—"),
                "icon": "",
                "code": c,
                "chance_of_rain": int(_hat(dpop, i, 0)),
            }
        )

    sunrise = _clock((d.get("sunrise") or [""])[0])
    sunset = _clock((d.get("sunset") or [""])[0])

    aqi = None
    if aq:
        aqi = {
            "us_epa_index": _aqi_to_epa(aq.get("us_aqi")),
            "pm2_5": aq.get("pm2_5"),
            "pm10": aq.get("pm10"),
            "o3": aq.get("ozone"),
        }

    temp_c = round(float(cur.get("temperature_2m", 0) or 0), 1)
    feels_c = round(float(cur.get("apparent_temperature", temp_c) or temp_c), 1)
    localtime = cur_time.replace("T", " ")

    return {
        "location": "",  # filled in by the caller (geocode / reverse-geocode)
        "region": "",
        "country": "",
        "lat": data.get("latitude"),
        "lon": data.get("longitude"),
        "localtime": localtime,
        "temperature_c": temp_c,
        "temperature_f": _c2f(temp_c),
        "feelslike_c": feels_c,
        "feelslike_f": _c2f(feels_c),
        "condition": _WMO.get(code, "—"),
        "condition_code": code,
        "icon": "",
        "humidity": int(cur.get("relative_humidity_2m", 0) or 0),
        "wind_kph": round(float(cur.get("wind_speed_10m", 0) or 0), 1),
        "wind_dir": _wind_dir(cur.get("wind_direction_10m", 0)),
        "wind_degree": int(cur.get("wind_direction_10m", 0) or 0),
        "pressure_mb": round(float(cur.get("pressure_msl", 0) or 0), 1),
        "visibility_km": round(float(vis_m) / 1000, 1),
        "uv": round(float(uv), 1),
        "cloud": int(cur.get("cloud_cover", 0) or 0),
        "is_day": is_day,
        "sunrise": sunrise,
        "sunset": sunset,
        "last_updated": localtime,
        "aqi": aqi,
        "hourly": hourly,
        "daily": daily,
        "is_mock": False,
    }


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
    for i in range(7):
        dd = (now + timedelta(days=i)).date()
        c, cc = rng.choice(_CONDITIONS)
        hi = round(base_temp + rng.uniform(0, 5), 1)
        lo = round(base_temp - rng.uniform(2, 8), 1)
        daily.append(
            {
                "date": dd.isoformat(),
                "day_name": dd.strftime("%a"),
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
        "wind_dir": rng.choice(_DIRS),
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
async def get_weather(location: Optional[str] = None, lat=None, lon=None) -> Dict:
    q = _resolve_q(location, lat, lon)

    if _live_enabled():
        cache_key = f"forecast:{(q or DEFAULT_LOCATION).lower()}"
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached
        try:
            if lat is not None and lon is not None:
                latf, lonf = float(lat), float(lon)
                place = await _reverse_geocode(latf, lonf) or {}
                name = place.get("name") or "Your location"
                region, country = place.get("region", ""), place.get("country", "")
            else:
                g = await _geocode(location or DEFAULT_LOCATION)
                if not g:
                    raise LocationNotFound(location or DEFAULT_LOCATION)
                latf, lonf = float(g["lat"]), float(g["lon"])
                name, region, country = g["name"], g["region"], g["country"]

            data = await _open_meteo(latf, lonf)
            data.update({"location": name, "region": region, "country": country,
                         "lat": latf, "lon": lonf})
            _cache_set(cache_key, data, FORECAST_TTL)
            return data
        except LocationNotFound:
            raise
        except Exception as exc:  # network / rate-limit (429) → degrade gracefully
            logger.warning("Open-Meteo failed (%s); serving fallback.", exc)
            # Prefer the last good (stale) reading over mock, and re-cache the
            # fallback for a short cooldown so we stop hammering a rate-limited
            # provider on every request (otherwise the expired entry is a miss
            # and each request re-hits the API → a 429 storm that never clears).
            stale = _cache_get(cache_key, allow_expired=True)
            fallback = stale if stale is not None else _mock_weather(q)
            _cache_set(cache_key, fallback, FALLBACK_TTL)
            return fallback

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
            if query.isdigit():  # ZIP / postal code
                loc = await _zip_lookup(query)
                results = [loc] if loc else []
            else:
                results = await _geocode_search(query, count=8)
            _cache_set(key, results, SEARCH_TTL)
            return results
        except Exception as exc:
            logger.warning("Geocoding failed (%s).", exc)
            return []

    return _mock_search(query)
