"""API-level tests using FastAPI TestClient."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestHealthEndpoint:
    def test_health(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


class TestOptimizeEndpoint:
    def test_missing_depot_returns_422(self):
        resp = client.post("/api/optimize", json={
            "customers": [
                {"id": "C1", "name": "A", "latitude": 17.73, "longitude": 83.31, "demand_kg": 10}
            ],
            "vehicles": [
                {"id": "V1", "name": "Van", "capacity_kg": 100}
            ],
        })
        assert resp.status_code == 422

    def test_duplicate_ids_returns_422(self):
        resp = client.post("/api/optimize", json={
            "depot": {"latitude": 17.72, "longitude": 83.30},
            "customers": [
                {"id": "C1", "name": "A", "latitude": 17.73, "longitude": 83.31, "demand_kg": 10},
                {"id": "C1", "name": "B", "latitude": 17.74, "longitude": 83.32, "demand_kg": 5},
            ],
            "vehicles": [
                {"id": "V1", "name": "Van", "capacity_kg": 100}
            ],
        })
        assert resp.status_code == 422

    def test_invalid_coords_returns_422(self):
        resp = client.post("/api/optimize", json={
            "depot": {"latitude": 999, "longitude": 83.30},
            "customers": [
                {"id": "C1", "name": "A", "latitude": 17.73, "longitude": 83.31, "demand_kg": 10}
            ],
            "vehicles": [
                {"id": "V1", "name": "Van", "capacity_kg": 100}
            ],
        })
        assert resp.status_code == 422

    def test_no_customers_returns_422(self):
        resp = client.post("/api/optimize", json={
            "depot": {"latitude": 17.72, "longitude": 83.30},
            "customers": [],
            "vehicles": [
                {"id": "V1", "name": "Van", "capacity_kg": 100}
            ],
        })
        assert resp.status_code == 422

    def test_impossible_total_capacity_returns_422(self):
        resp = client.post("/api/optimize", json={
            "depot": {"latitude": 17.72, "longitude": 83.30},
            "customers": [
                {"id": "C1", "name": "A", "latitude": 17.73, "longitude": 83.31, "demand_kg": 60},
                {"id": "C2", "name": "B", "latitude": 17.74, "longitude": 83.32, "demand_kg": 50},
            ],
            "vehicles": [
                {"id": "V1", "name": "Van", "capacity_kg": 100}
            ],
        })
        assert resp.status_code == 422
        assert "exceeds total vehicle capacity" in resp.text

    def test_impossible_individual_customer_demand_returns_422(self):
        resp = client.post("/api/optimize", json={
            "depot": {"latitude": 17.72, "longitude": 83.30},
            "customers": [
                {"id": "C1", "name": "Heavy cargo", "latitude": 17.73, "longitude": 83.31, "demand_kg": 150},
            ],
            "vehicles": [
                {"id": "V1", "name": "Van 1", "capacity_kg": 100},
                {"id": "V2", "name": "Van 2", "capacity_kg": 100},
            ],
        })
        assert resp.status_code == 422
        assert "exceeds maximum vehicle capacity" in resp.text


class TestDemoEndpoint:
    def test_demo_inspect(self):
        resp = client.get("/api/demo?run=false")
        assert resp.status_code == 200
        data = resp.json()
        assert "depot" in data
        assert len(data["customers"]) == 25
        assert len(data["vehicles"]) == 5
        assert data["depot"]["name"] == "Vizag Central Depot"



class TestOptimizationRetrieval:
    def test_not_found(self):
        resp = client.get("/api/optimization/nonexistent-id")
        assert resp.status_code == 404


class TestQuantumEndpoint:
    def test_quantum_demo_endpoint(self):
        resp = client.post("/api/quantum/demo")
        assert resp.status_code == 200
        data = resp.json()
        assert data["problem_size"] == 5
        assert len(data["qaoa_best_route"]) == 6
        assert len(data["classical_best_route"]) == 6
        assert data["qaoa_cost"] > 0
        assert data["classical_cost"] > 0
        assert "no quantum advantage" in data["note"].lower()
