"""Shared test fixtures and mock data."""

from __future__ import annotations

import pytest

from app.config import settings
from app.demo_data import get_demo_customers, get_demo_depot, get_demo_vehicles
from app.models import Customer, Depot, OptimizationRequest, OptimizationMode, Vehicle


@pytest.fixture(autouse=True)
def fast_solver_for_tests():
    """Default solver time limit to 2 seconds during tests for speed."""
    orig = settings.SOLVER_TIME_LIMIT
    settings.SOLVER_TIME_LIMIT = 2
    yield
    settings.SOLVER_TIME_LIMIT = orig



@pytest.fixture
def demo_depot() -> Depot:
    return get_demo_depot()


@pytest.fixture
def demo_customers() -> list[Customer]:
    return get_demo_customers()


@pytest.fixture
def demo_vehicles() -> list[Vehicle]:
    return get_demo_vehicles()


@pytest.fixture
def demo_request() -> OptimizationRequest:
    return OptimizationRequest(
        depot=get_demo_depot(),
        customers=get_demo_customers(),
        vehicles=get_demo_vehicles(),
        optimization_mode=OptimizationMode.BALANCED,
    )


@pytest.fixture
def small_distance_matrix() -> list[list[float]]:
    """5×5 symmetric distance matrix (metres) for unit tests."""
    return [
        [0,   5000, 8000, 3000, 6000],
        [5000, 0,   4000, 7000, 2000],
        [8000, 4000, 0,   6000, 5000],
        [3000, 7000, 6000, 0,   4000],
        [6000, 2000, 5000, 4000, 0   ],
    ]


@pytest.fixture
def small_duration_matrix() -> list[list[float]]:
    """5×5 symmetric duration matrix (seconds)."""
    return [
        [0,   300, 480, 180, 360],
        [300, 0,   240, 420, 120],
        [480, 240, 0,   360, 300],
        [180, 420, 360, 0,   240],
        [360, 120, 300, 240, 0  ],
    ]
