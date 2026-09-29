"""V1 API endpoints matching Lovable UI contracts.

Mounted at /api/v1:
  • POST /api/v1/optimize       -> V1OptimizeResponse
  • GET  /api/v1/demo           -> V1DemoScenario or V1OptimizeResponse
  • POST /api/v1/quantum/demo   -> V1QuantumDemoResponse
"""

from __future__ import annotations

import logging
import time
import traceback
from typing import Any

from fastapi import APIRouter, HTTPException

from app.demo_data import get_demo_request
from app.models import (
    Customer,
    Depot,
    OptimizationMode,
    V1DemoScenario,
    V1OptimizeRequest,
    V1OptimizeResponse,
    V1QuantumDemoRequest,
    V1QuantumDemoResponse,
    V1RouteMetrics,
    V1VehicleRoute,
    Vehicle,
)
from app.optimizer import run_optimization
from app.osrm_client import OSRMError
from app.quantum_demo import run_quantum_demo_v1

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["v1"])


def _map_mode(mode_str: str) -> OptimizationMode:
    m = mode_str.lower().strip()
    if m in ("distance", "shortest"):
        return OptimizationMode.SHORTEST
    if m in ("time", "fastest"):
        return OptimizationMode.FASTEST
    return OptimizationMode.BALANCED


@router.post("/optimize", response_model=V1OptimizeResponse)
async def optimize_v1(request: V1OptimizeRequest):
    """Solve CVRP for Lovable UI request and return V1 response format."""
    t0 = time.perf_counter()

    try:
        depot_lat, depot_lon = request.depot.get_coords()
        depot = Depot(
            latitude=depot_lat,
            longitude=depot_lon,
            name=request.depot.name,
        )

        all_stops = request.get_all_stops()
        if not all_stops:
            raise HTTPException(status_code=422, detail="At least one stop/customer is required.")

        customers: list[Customer] = []
        for s in all_stops:
            s_lat, s_lon = s.get_coords()
            customers.append(Customer(
                id=s.id,
                name=s.name,
                latitude=s_lat,
                longitude=s_lon,
                demand_kg=s.get_demand(),
            ))

        if not request.vehicles:
            raise HTTPException(status_code=422, detail="At least one vehicle is required.")

        vehicles: list[Vehicle] = [
            Vehicle(
                id=v.id,
                name=v.name,
                capacity_kg=v.get_capacity(),
            )
            for v in request.vehicles
        ]

        mode = _map_mode(request.mode)

        # Execute optimization
        res = await run_optimization(
            depot=depot,
            customers=customers,
            vehicles=vehicles,
            mode=mode,
        )

        fleet_capacity = sum(v.capacity_kg for v in vehicles)

        # Build V1 routes
        v1_routes: list[V1VehicleRoute] = []
        for r in res.routes:
            coords: list[list[float]] = []
            if r.route_geojson and "geometry" in r.route_geojson:
                coords = r.route_geojson["geometry"].get("coordinates", [])

            # Fallback geometry if OSRM linestring unavailable
            if not coords and r.stops:
                coords = [[depot.longitude, depot.latitude]]
                coords.extend([s.longitude, s.latitude] for s in r.stops)
                coords.append([depot.longitude, depot.latitude])

            v1_routes.append(V1VehicleRoute(
                vehicleId=r.vehicle_id,
                stopIds=[s.customer_id for s in r.stops],
                geometry=coords,
                distanceKm=r.distance_km,
                durationMin=r.time_min,
                load=r.load_kg,
            ))

        # Baseline routes
        per_vehicle = max(1, (len(customers) + len(vehicles) - 1) // len(vehicles))
        baseline_routes: list[V1VehicleRoute] = []
        for i, v in enumerate(vehicles):
            v_stops = customers[i * per_vehicle : (i + 1) * per_vehicle]
            b_coords = [[depot.longitude, depot.latitude]]
            b_coords.extend([s.longitude, s.latitude] for s in v_stops)
            b_coords.append([depot.longitude, depot.latitude])
            b_load = sum(s.demand_kg for s in v_stops)

            baseline_routes.append(V1VehicleRoute(
                vehicleId=v.id,
                stopIds=[s.id for s in v_stops],
                geometry=b_coords,
                distanceKm=round(res.baseline.baseline_distance_km / len(vehicles), 2),
                durationMin=round(res.baseline.baseline_time_min / len(vehicles), 2),
                load=round(b_load, 2),
            ))

        total_demand = sum(c.demand_kg for c in customers)
        cap_util = round(total_demand / fleet_capacity, 4) if fleet_capacity > 0 else 0.0

        compute_ms = int(round((time.perf_counter() - t0) * 1000))

        return V1OptimizeResponse(
            mode=request.mode,
            solver="ortools-cvrp",
            routes=v1_routes,
            baseline=V1RouteMetrics(
                distanceKm=res.baseline.baseline_distance_km,
                durationMin=res.baseline.baseline_time_min,
                vehiclesUsed=min(len(vehicles), len(customers)),
                capacityUtilization=cap_util,
            ),
            optimized=V1RouteMetrics(
                distanceKm=res.total_distance_km,
                durationMin=res.total_time_min,
                vehiclesUsed=res.vehicles_used,
                capacityUtilization=cap_util,
            ),
            baselineRoutes=baseline_routes,
            computeMs=compute_ms,
            explanation=res.explanation,
        )

    except OSRMError as exc:
        raise HTTPException(status_code=502, detail=f"OSRM error: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("V1 Optimize failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}") from exc


@router.get("/demo")
async def demo_v1(run: bool = False, mode: str = "balanced"):
    """Get the built-in demo scenario matching Lovable UI DemoScenario contract."""
    from app.demo_data import get_demo_request
    req = get_demo_request(_map_mode(mode))

    # Format as Lovable UI DemoScenario
    demo_scenario = {
        "city": "Visakhapatnam / Coast",
        "depot": {
            "id": "D0",
            "name": req.depot.name,
            "location": [req.depot.longitude, req.depot.latitude],
        },
        "stops": [
            {
                "id": c.id,
                "name": c.name,
                "location": [c.longitude, c.latitude],
                "demand": c.demand_kg,
                "serviceMin": 5,
            }
            for c in req.customers
        ],
        "vehicles": [
            {
                "id": v.id,
                "name": v.name,
                "plate": f"AP39 {v.id} 100{i+1}",
                "capacity": v.capacity_kg,
                "color": f"var(--route-{i+1})",
            }
            for i, v in enumerate(req.vehicles)
        ],
    }

    if not run:
        return demo_scenario

    # If run=true requested, run and return V1OptimizeResponse
    v1_req = V1OptimizeRequest(
        depot=demo_scenario["depot"],
        stops=demo_scenario["stops"],
        vehicles=demo_scenario["vehicles"],
        mode=mode,
    )
    return await optimize_v1(v1_req)


@router.post("/quantum/demo", response_model=V1QuantumDemoResponse)
async def quantum_demo_v1_endpoint(request: V1QuantumDemoRequest | None = None):
    """Run small 4-stop QAOA subproblem vs Google OR-Tools routing model."""
    try:
        stop_ids = request.stopIds if request else ["S01", "S02", "S03", "S04"]
        shots = request.shots if request else 500
        return run_quantum_demo_v1(stop_ids=stop_ids, shots=shots)
    except Exception as exc:
        logger.error("Quantum demo v1 failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Quantum demo failed: {exc}") from exc
