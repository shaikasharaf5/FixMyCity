"""Reverse geocoding for citizen-selected report locations; cached and rate limited."""
import asyncio
import os
import time
import httpx
from fastapi import APIRouter, Query, HTTPException

router = APIRouter(prefix='/api/locations', tags=['Locations'])
_lock = asyncio.Lock()
_cache = {}
_last_request = 0.0

@router.get('/reverse')
async def reverse_location(latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)):
    global _last_request
    key = (round(latitude, 5), round(longitude, 5))
    async with _lock:
        if key in _cache and time.monotonic() - _cache[key][0] < 86400:
            return {**_cache[key][1], 'latitude': latitude, 'longitude': longitude}
        await asyncio.sleep(max(0, 1.1 - (time.monotonic() - _last_request)))
        _last_request = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(os.getenv('GEOCODER_URL', 'https://nominatim.openstreetmap.org/reverse'),
                    params={'lat': latitude, 'lon': longitude, 'format': 'jsonv2', 'accept-language': 'en'},
                    headers={'User-Agent': 'CiviTrack/1.0 citizen-complaint-location'})
                response.raise_for_status()
                data = response.json()
            address = data.get('address', {})
            district = address.get('state_district') or address.get('county') or address.get('city') or address.get('town')
            place = address.get('suburb') or address.get('village') or address.get('town') or address.get('city') or district
            if not district or not place:
                raise ValueError('Place name unavailable')
            result = {'district': district, 'ward': place, 'place': ', '.join(dict.fromkeys([place, district])), 'latitude': latitude, 'longitude': longitude}
            if len(_cache) >= 1000:
                _cache.pop(next(iter(_cache)))
            _cache[key] = (time.monotonic(), result)
            return result
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, 'Place lookup unavailable. Enter the place and district manually.')
