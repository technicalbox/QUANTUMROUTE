"""Pydantic data models for QuantumRoute API.

All request/response schemas live here so they stay consistent across
the codebase and auto-generate OpenAPI docs.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OptimizationMode(str, Enum):
    """Supported routing objectives."""
    SHORTEST = "shortest"
    FASTEST = "fastest"
    BALANCED = "balanced"


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------

class Depot(BaseModel):
    """Central depot location – every route starts and ends here."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    name: str = "Depot"


class Customer(BaseModel):
    """A delivery stop with location and demand."""
    id: str
    name: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    demand_kg: float = Field(..., gt=0, description="Delivery weight in kg")


class Vehicle(BaseModel):
    """A delivery vehicle with a weight capacity."""
    id: str
    name: str
    capacity_kg: float = Field(..., gt=0, description="Maximum payload in kg")


class OptimizationRequest(BaseModel):
    """Full input payload for POST /api/optimize."""
    depot: Depot
    customers: list[Customer]
    vehicles: list[Vehicle]
    optimization_mode: OptimizationMode = OptimizationMode.BALANCED

    @field_validator("customers")
    @classmethod
    def unique_customer_ids(cls, v: list[Customer]) -> list[Customer]:
        ids = [c.id for c in v]
        if len(ids) != len(set(ids)):
            dupes = [i for i in ids if ids.count(i) > 1]
            raise ValueError(f"Duplicate customer IDs: {set(dupes)}")
        return v

    @field_validator("vehicles")
    @classmethod
    def at_least_one_vehicle(cls, v: list[Vehicle]) -> list[Vehicle]:
        if not v:
            raise ValueError("At least one vehicle is required")
        return v

    @field_validator("customers")
    @classmethod
    def at_least_one_customer(cls, v: list[Customer]) -> list[Customer]:
        if not v:
            raise ValueError("At least one customer is required")
        return v


# ---------------------------------------------------------------------------
# Output models
# ---------------------------------------------------------------------------

class RouteStop(BaseModel):
    """A single stop in a vehicle's route."""
    sequence: int
    customer_id: str
    customer_name: str
    latitude: float
    longitude: float
    demand_kg: float
    cumulative_load_kg: float


class VehicleRoute(BaseModel):
    """One vehicle's complete route with metrics."""
    vehicle_id: str
    vehicle_name: str
    capacity_kg: float
    load_kg: float
    utilization_pct: float = Field(..., description="Capacity utilization 0-100")
    distance_km: float
    time_min: float
    stops: list[RouteStop]
    route_geojson: dict[str, Any] | None = None


class BaselineComparison(BaseModel):
    """Side-by-side comparison with a simple deterministic baseline."""
    baseline_distance_km: float
    baseline_time_min: float
    optimized_distance_km: float
    optimized_time_min: float
    distance_change_pct: float
    time_change_pct: float
    note: str = (
        "Baseline uses a simple nearest-neighbour heuristic for demonstration. "
        "It is not a globally optimal or scientifically authoritative reference."
    )


class RouteExplanation(BaseModel):
    """Structured natural-language explanation of the solver output."""
    summary: str
    vehicle_explanations: list[str]


class OptimizationResult(BaseModel):
    """Complete response for POST /api/optimize."""
    id: str
    optimization_mode: OptimizationMode
    total_distance_km: float
    total_time_min: float
    vehicles_used: int
    total_capacity_used_kg: float
    routes: list[VehicleRoute]
    baseline: BaselineComparison
    explanation: RouteExplanation
    depot: Depot
    geojson: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Quantum demo models
# ---------------------------------------------------------------------------

class QuantumDistributionItem(BaseModel):
    """Bitstring sample result from QAOA."""
    bitstring: str
    probability: float
    cost: float


class QuantumDemoResult(BaseModel):
    """Result of the small quantum routing experiment."""
    problem_size: int
    qaoa_best_route: list[int]
    qaoa_cost: float
    classical_best_route: list[int]
    classical_cost: float
    qubits: int = 16
    formulation: str = (
        "4 customer stops × 4 possible positions = 16 binary variables / qubits (depot fixed at step 0)"
    )
    classical_solver: str = "Google OR-Tools"
    distribution: list[QuantumDistributionItem] = Field(default_factory=list)
    note: str = (
        "This is a small demonstration. No quantum advantage is claimed."
    )


# ---------------------------------------------------------------------------
# V1 models matching Lovable UI contracts
# ---------------------------------------------------------------------------

class V1Depot(BaseModel):
    """Depot for v1 endpoints, accepting either [lon, lat] or latitude/longitude."""
    id: str = "D0"
    name: str = "Central Depot"
    location: list[float] | None = None
    latitude: float | None = None
    longitude: float | None = None

    def get_coords(self) -> tuple[float, float]:
        """Return (latitude, longitude)."""
        if self.latitude is not None and self.longitude is not None:
            return self.latitude, self.longitude
        if self.location and len(self.location) == 2:
            # location is [lon, lat] per GeoJSON / MapLibre convention
            return self.location[1], self.location[0]
        raise ValueError("Depot must specify valid coordinates")


class V1Stop(BaseModel):
    """Customer stop for v1 endpoints."""
    id: str
    name: str
    location: list[float] | None = None
    latitude: float | None = None
    longitude: float | None = None
    demand: float | None = None
    demand_kg: float | None = None
    serviceMin: float = 0.0

    def get_coords(self) -> tuple[float, float]:
        """Return (latitude, longitude)."""
        if self.latitude is not None and self.longitude is not None:
            return self.latitude, self.longitude
        if self.location and len(self.location) == 2:
            return self.location[1], self.location[0]
        raise ValueError(f"Stop {self.id} must specify valid coordinates")

    def get_demand(self) -> float:
        d = self.demand if self.demand is not None else self.demand_kg
        if d is None or d <= 0:
            raise ValueError(f"Stop {self.id} must have positive demand")
        return float(d)


class V1Vehicle(BaseModel):
    """Vehicle for v1 endpoints."""
    id: str
    name: str
    plate: str = ""
    capacity: float | None = None
    capacity_kg: float | None = None
    color: str = "#0ea5e9"

    def get_capacity(self) -> float:
        c = self.capacity if self.capacity is not None else self.capacity_kg
        if c is None or c <= 0:
            raise ValueError(f"Vehicle {self.id} must have positive capacity")
        return float(c)


class V1DemoScenario(BaseModel):
    """Demo scenario matching Lovable UI contract."""
    city: str
    depot: V1Depot
    stops: list[V1Stop]
    vehicles: list[V1Vehicle]


class V1OptimizeRequest(BaseModel):
    """Request payload for POST /api/v1/optimize."""
    depot: V1Depot
    stops: list[V1Stop] = Field(default_factory=list)
    customers: list[V1Stop] = Field(default_factory=list)
    vehicles: list[V1Vehicle]
    mode: str = "balanced"

    def get_all_stops(self) -> list[V1Stop]:
        return self.stops if self.stops else self.customers


class V1VehicleRoute(BaseModel):
    """Optimized route for a single vehicle in v1 format."""
    vehicleId: str
    stopIds: list[str]
    geometry: list[list[float]]  # list of [lon, lat] coordinates for MapLibre
    distanceKm: float
    durationMin: float
    load: float


class V1RouteMetrics(BaseModel):
    """Aggregated route metrics in v1 format."""
    distanceKm: float
    durationMin: float
    vehiclesUsed: int
    capacityUtilization: float


class V1OptimizeResponse(BaseModel):
    """Response payload for POST /api/v1/optimize."""
    mode: str
    solver: str = "ortools-cvrp"
    backend: str = "FastAPI + Google OR-Tools + OSRM"
    solver_comparison: str = "Google OR-Tools CVRP (Guided Local Search) vs Naive Vehicle Partitioning"
    routes: list[V1VehicleRoute]
    baseline: V1RouteMetrics
    optimized: V1RouteMetrics
    baselineRoutes: list[V1VehicleRoute]
    computeMs: int
    explanation: RouteExplanation | None = None


class V1QuantumDemoRequest(BaseModel):
    """Request payload for POST /api/v1/quantum/demo."""
    stopIds: list[str] = Field(default_factory=lambda: ["S01", "S02", "S03", "S04"])
    p: int = 1
    gamma: list[float] = Field(default_factory=lambda: [0.8])
    beta: list[float] = Field(default_factory=lambda: [0.4])
    shots: int = 500


class V1QuantumDemoResponse(BaseModel):
    """Response payload for POST /api/v1/quantum/demo."""
    isDemo: bool = True
    backend: str = "FastAPI + Qiskit Aer"
    qubits: int = 16
    classical_solver: str = "Google OR-Tools"
    formulation: str = (
        "4 customer stops × 4 possible positions = 16 binary variables / qubits (depot fixed at step 0)"
    )
    solver_comparison: str = "QAOA (Qiskit Aer) vs Google OR-Tools RoutingModel"
    distribution: list[QuantumDistributionItem]
    bestOrder: list[str]
    classicalOrder: list[str]
    classicalCost: float
    quantumCost: float
    note: str = (
        "Educational Qiskit Aer simulation on 16 qubits. No quantum advantage is claimed."
    )
