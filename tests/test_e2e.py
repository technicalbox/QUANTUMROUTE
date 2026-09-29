"""End-to-end test: demo data → mocked OSRM → OR-Tools → full result.

Uses mocked OSRM responses so the test runs offline and deterministically.
"""

from __future__ import annotations

import math
from unittest.mock import AsyncMock, patch

import pytest

from app.demo_data import get_demo_customers, get_demo_depot, get_demo_vehicles
from app.models import OptimizationMode
from app.optimizer import run_optimization


def _make_synthetic_matrices(n: int):
    """Create synthetic distance/duration matrices using haversine-ish values."""
    from app.demo_data import get_demo_customers, get_demo_depot

    depot = get_demo_depot()
    customers = get_demo_customers()
    coords = [(depot.latitude, depot.longitude)] + [
        (c.latitude, c.longitude) for c in customers
    ]

    def haversine_m(lat1, lon1, lat2, lon2):
        R = 6371000
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    dist = [[0.0] * n for _ in range(n)]
    dur = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            d = haversine_m(coords[i][0], coords[i][1], coords[j][0], coords[j][1])
            # Road distance ≈ 1.3× haversine, time ≈ d/30kmh
            dist[i][j] = d * 1.3
            dur[i][j] = (d * 1.3) / (30 * 1000 / 3600)  # seconds

    return dist, dur


@pytest.mark.asyncio
async def test_full_pipeline():
    """End-to-end: demo data → mock OSRM → OR-Tools → result validation."""
    depot = get_demo_depot()
    customers = get_demo_customers()
    vehicles = get_demo_vehicles()
    n = 1 + len(customers)

    dist, dur = _make_synthetic_matrices(n)

    mock_geojson = {
        "type": "Feature",
        "properties": {"distance_m": 10000, "duration_s": 600},
        "geometry": {
            "type": "LineString",
            "coordinates": [[83.30, 17.72], [83.31, 17.73]],
        },
    }

    with patch("app.optimizer.get_distance_time_matrix", new_callable=AsyncMock) as mock_matrix, \
         patch("app.optimizer.get_route_geometry", new_callable=AsyncMock) as mock_geom:
        mock_matrix.return_value = (dist, dur)
        mock_geom.return_value = mock_geojson.copy()

        result = await run_optimization(
            depot=depot,
            customers=customers,
            vehicles=vehicles,
            mode=OptimizationMode.BALANCED,
        )

    # ---- Structural assertions ----
    assert result.id  # UUID assigned
    assert result.optimization_mode == OptimizationMode.BALANCED
    assert result.total_distance_km > 0
    assert result.total_time_min > 0
    assert result.vehicles_used > 0
    assert result.vehicles_used <= len(vehicles)

    # All customers served
    served_ids = set()
    for route in result.routes:
        for stop in route.stops:
            served_ids.add(stop.customer_id)
    expected_ids = {c.id for c in customers}
    assert served_ids == expected_ids, f"Missing: {expected_ids - served_ids}"

    # Capacity not exceeded
    for route in result.routes:
        assert route.load_kg <= route.capacity_kg

    # Baseline comparison present
    assert result.baseline.baseline_distance_km > 0
    assert result.baseline.optimized_distance_km > 0

    # Explanation present
    assert result.explanation.summary
    assert len(result.explanation.vehicle_explanations) == result.vehicles_used

    # GeoJSON present
    assert result.geojson is not None
    assert result.geojson["type"] == "FeatureCollection"
