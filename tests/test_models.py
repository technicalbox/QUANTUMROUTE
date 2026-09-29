"""Tests for Pydantic models and input validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models import Customer, Depot, OptimizationRequest, OptimizationMode, Vehicle


class TestDepot:
    def test_valid(self):
        d = Depot(latitude=17.72, longitude=83.30)
        assert d.latitude == 17.72

    def test_out_of_range_lat(self):
        with pytest.raises(ValidationError):
            Depot(latitude=91.0, longitude=83.30)

    def test_out_of_range_lon(self):
        with pytest.raises(ValidationError):
            Depot(latitude=17.72, longitude=181.0)


class TestCustomer:
    def test_valid(self):
        c = Customer(id="C1", name="Shop", latitude=17.73, longitude=83.31, demand_kg=10)
        assert c.demand_kg == 10

    def test_zero_demand_rejected(self):
        with pytest.raises(ValidationError):
            Customer(id="C1", name="Shop", latitude=17.73, longitude=83.31, demand_kg=0)

    def test_negative_demand_rejected(self):
        with pytest.raises(ValidationError):
            Customer(id="C1", name="Shop", latitude=17.73, longitude=83.31, demand_kg=-5)


class TestVehicle:
    def test_valid(self):
        v = Vehicle(id="V1", name="Van", capacity_kg=100)
        assert v.capacity_kg == 100

    def test_zero_capacity_rejected(self):
        with pytest.raises(ValidationError):
            Vehicle(id="V1", name="Van", capacity_kg=0)


class TestOptimizationRequest:
    def test_duplicate_ids_rejected(self):
        with pytest.raises(ValidationError, match="Duplicate customer IDs"):
            OptimizationRequest(
                depot=Depot(latitude=17.72, longitude=83.30),
                customers=[
                    Customer(id="C1", name="A", latitude=17.73, longitude=83.31, demand_kg=10),
                    Customer(id="C1", name="B", latitude=17.74, longitude=83.32, demand_kg=5),
                ],
                vehicles=[Vehicle(id="V1", name="Van", capacity_kg=100)],
            )

    def test_no_vehicles_rejected(self):
        with pytest.raises(ValidationError, match="At least one vehicle"):
            OptimizationRequest(
                depot=Depot(latitude=17.72, longitude=83.30),
                customers=[
                    Customer(id="C1", name="A", latitude=17.73, longitude=83.31, demand_kg=10),
                ],
                vehicles=[],
            )

    def test_no_customers_rejected(self):
        with pytest.raises(ValidationError, match="At least one customer"):
            OptimizationRequest(
                depot=Depot(latitude=17.72, longitude=83.30),
                customers=[],
                vehicles=[Vehicle(id="V1", name="Van", capacity_kg=100)],
            )

    def test_valid_request(self, demo_request):
        assert demo_request.optimization_mode == OptimizationMode.BALANCED
        assert len(demo_request.customers) == 25
