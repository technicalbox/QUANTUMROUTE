"""OSRM client with local file-based caching.

Talks to a public or self-hosted OSRM backend for:
  • Table service  → N×N distance / duration matrices
  • Route service  → step-by-step geometry for the final solution

All responses are cached to ``_osrm_cache/`` during development so repeated
demo runs don't hammer the routing server.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_CACHE_DIR = Path(__file__).resolve().parent.parent / "_osrm_cache"
_CACHE_DIR.mkdir(exist_ok=True)

_CLIENT_TIMEOUT = 60.0  # seconds


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_key(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


def _get_cached(url: str) -> dict | None:
    path = _CACHE_DIR / f"{_cache_key(url)}.json"
    if path.exists():
        logger.debug("OSRM cache HIT: %s", url[:120])
        return json.loads(path.read_text())
    return None


def _set_cached(url: str, data: dict) -> None:
    path = _CACHE_DIR / f"{_cache_key(url)}.json"
    path.write_text(json.dumps(data))
    logger.debug("OSRM cache STORE: %s", url[:120])


# ---------------------------------------------------------------------------
# Coordinate formatting
# ---------------------------------------------------------------------------

def _coords_param(coords: list[tuple[float, float]]) -> str:
    """Format (lat,lon) pairs into OSRM's ``lon,lat;…`` string."""
    return ";".join(f"{lon},{lat}" for lat, lon in coords)


# ---------------------------------------------------------------------------
# Table service
# ---------------------------------------------------------------------------

class OSRMError(Exception):
    """Raised when OSRM returns an error or is unreachable."""


async def get_distance_time_matrix(
    coords: list[tuple[float, float]],
) -> tuple[list[list[float]], list[list[float]]]:
    """Return (distance_matrix_m, duration_matrix_s) for all coord pairs.

    ``coords`` is a list of ``(latitude, longitude)`` tuples.
    Index 0 should be the depot.
    """
    coord_str = _coords_param(coords)
    url = (
        f"{settings.OSRM_BASE_URL}/table/v1/driving/{coord_str}"
        "?annotations=distance,duration"
    )

    cached = _get_cached(url)
    if cached is not None:
        return cached["distances"], cached["durations"]

    try:
        async with httpx.AsyncClient(timeout=_CLIENT_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise OSRMError(f"OSRM table request failed: {exc}") from exc

    if data.get("code") != "Ok":
        msg = data.get("message", data.get("code", "unknown"))
        raise OSRMError(f"OSRM table error: {msg}")

    distances: list[list[float]] = data["distances"]
    durations: list[list[float]] = data["durations"]

    # Check for null/None values indicating unreachable points
    for i, row in enumerate(distances):
        for j, val in enumerate(row):
            if val is None:
                raise OSRMError(
                    f"Location index {j} is unreachable from index {i}. "
                    "Check that all coordinates are on routable roads."
                )

    _set_cached(url, {"distances": distances, "durations": durations})
    return distances, durations


# ---------------------------------------------------------------------------
# Route geometry service
# ---------------------------------------------------------------------------

async def get_route_geometry(
    coords: list[tuple[float, float]],
) -> dict[str, Any]:
    """Return GeoJSON geometry for a route through the given waypoints.

    Waypoints should be in visit order (depot → stops → depot).
    """
    coord_str = _coords_param(coords)
    url = (
        f"{settings.OSRM_BASE_URL}/route/v1/driving/{coord_str}"
        "?overview=full&geometries=geojson&steps=false"
    )

    cached = _get_cached(url)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=_CLIENT_TIMEOUT) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise OSRMError(f"OSRM route request failed: {exc}") from exc

    if data.get("code") != "Ok":
        msg = data.get("message", data.get("code", "unknown"))
        raise OSRMError(f"OSRM route error: {msg}")

    route = data["routes"][0]
    geojson: dict[str, Any] = {
        "type": "Feature",
        "properties": {
            "distance_m": route["distance"],
            "duration_s": route["duration"],
        },
        "geometry": route["geometry"],
    }

    _set_cached(url, geojson)
    return geojson
