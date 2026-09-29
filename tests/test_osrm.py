"""Tests for OSRM response parsing (mocked – no live HTTP calls)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.osrm_client import OSRMError, get_distance_time_matrix, get_route_geometry


@pytest.fixture
def mock_table_response():
    """Realistic OSRM /table response for 3 points."""
    return {
        "code": "Ok",
        "distances": [
            [0, 1234.5, 5678.9],
            [1234.5, 0, 3456.7],
            [5678.9, 3456.7, 0],
        ],
        "durations": [
            [0, 120.0, 300.0],
            [120.0, 0, 200.0],
            [300.0, 200.0, 0],
        ],
    }


@pytest.fixture
def mock_route_response():
    """Realistic OSRM /route response."""
    return {
        "code": "Ok",
        "routes": [{
            "distance": 12345.6,
            "duration": 789.0,
            "geometry": {
                "type": "LineString",
                "coordinates": [[83.30, 17.72], [83.31, 17.73], [83.32, 17.74]],
            },
        }],
    }


class TestTableParsing:
    @pytest.mark.asyncio
    async def test_parses_distances_and_durations(self, mock_table_response):
        with patch("app.osrm_client._get_cached", return_value=None), \
             patch("app.osrm_client._set_cached"):
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = mock_table_response
            mock_resp.raise_for_status.return_value = None
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)

            with patch("httpx.AsyncClient", return_value=mock_client):
                dists, durs = await get_distance_time_matrix([
                    (17.72, 83.30), (17.73, 83.31), (17.74, 83.32),
                ])

            assert len(dists) == 3
            assert len(durs) == 3
            assert dists[0][1] == 1234.5
            assert durs[0][2] == 300.0

    @pytest.mark.asyncio
    async def test_unreachable_raises(self):
        bad_response = {
            "code": "Ok",
            "distances": [[0, None], [None, 0]],
            "durations": [[0, None], [None, 0]],
        }
        with patch("app.osrm_client._get_cached", return_value=None), \
             patch("app.osrm_client._set_cached"):
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = bad_response
            mock_resp.raise_for_status.return_value = None
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)

            with patch("httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(OSRMError, match="unreachable"):
                    await get_distance_time_matrix([(17.72, 83.30), (0, 0)])

    @pytest.mark.asyncio
    async def test_osrm_error_code_raises(self):
        error_response = {"code": "InvalidQuery", "message": "bad request"}
        with patch("app.osrm_client._get_cached", return_value=None):
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = error_response
            mock_resp.raise_for_status.return_value = None
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)

            with patch("httpx.AsyncClient", return_value=mock_client):
                with pytest.raises(OSRMError, match="bad request"):
                    await get_distance_time_matrix([(17.72, 83.30)])


class TestRouteParsing:
    @pytest.mark.asyncio
    async def test_parses_geojson(self, mock_route_response):
        with patch("app.osrm_client._get_cached", return_value=None), \
             patch("app.osrm_client._set_cached"):
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = mock_route_response
            mock_resp.raise_for_status.return_value = None
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)

            with patch("httpx.AsyncClient", return_value=mock_client):
                geojson = await get_route_geometry([
                    (17.72, 83.30), (17.73, 83.31), (17.72, 83.30),
                ])

            assert geojson["type"] == "Feature"
            assert geojson["geometry"]["type"] == "LineString"
            assert geojson["properties"]["distance_m"] == 12345.6
