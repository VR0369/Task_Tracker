"""Homepage widgets: motivational quote, weather, on-this-day."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..deps import get_current_user
from ..models.misc import HistoryEvent, Quote, WeatherResponse, WeatherSearchResult
from ..services import history as history_service
from ..services import quotes as quotes_service
from ..services import weather as weather_service
from ..services.weather import LocationNotFound

router = APIRouter(tags=["widgets"])


@router.get("/quotes/random", response_model=Quote)
async def random_quote(exclude: Optional[str] = None):
    return Quote(**await quotes_service.get_random_quote(exclude=exclude))


@router.get("/weather", response_model=WeatherResponse)
async def weather(
    location: Optional[str] = Query(default=None),
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    user: dict = Depends(get_current_user),
):
    # Priority: explicit lat/lon > explicit location > saved preference > default.
    if lat is None and lon is None and not location:
        location = (user.get("settings") or {}).get("weather_location") or "New York"
    try:
        data = await weather_service.get_weather(location=location, lat=lat, lon=lon)
    except LocationNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found")
    return WeatherResponse(**data)


@router.get("/weather/search", response_model=List[WeatherSearchResult])
async def weather_search(
    q: str = Query(..., min_length=1),
    user: dict = Depends(get_current_user),
):
    return [WeatherSearchResult(**r) for r in await weather_service.search_locations(q)]


@router.get("/history/on-this-day", response_model=HistoryEvent)
async def on_this_day():
    return HistoryEvent(**await history_service.get_on_this_day())
