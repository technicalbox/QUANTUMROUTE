"""Main optimization pipeline.

Orchestrates:
  OSRM matrix → CVRP solver → baseline → geometry → result assembly
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.baseline import nearest_neighbour_baseline
from app.cvrp_solver import CVRPInput, CVRPSolution, solve_cvrp
from app.explainer import explain_routes
from app.models import (
    BaselineComparison,
    Customer,
    Depot,
    OptimizationMode,
    OptimizationResult,
    RouteStop,
    Vehicle,
    VehicleRoute,
)
from app.osrm_client import get_distance_time_matrix, get_route_geometry

logger = logging.getLogger(__name__)

# In-memory store for retrieving past results
_result_store: dict[str, OptimizationResult] = {}


def get_stored_result(result_id: str) -> OptimizationResult | None:
    return _result_store.get(result_id)


async def run_optimization(
    depot: Depot,
    customers: list[Customer],
    vehicles: list[Vehicle],
    mode: OptimizationMode,
) -> OptimizationResult:
    """Full pipeline: matrix → solve → geometry → result."""

    # 1. Prepare demands & capacities for early feasibility check
    total_demand_float = sum(c.demand_kg for c in customers)
    total_capacity_float = sum(v.capacity_kg for v in vehicles)
    if total_demand_float > total_capacity_float:
        raise ValueError(
            f"Total demand ({total_demand_float:.1f} kg) exceeds total vehicle capacity "
            f"({total_capacity_float:.1f} kg). The problem is infeasible."
        )

    max_capacity_float = max(v.capacity_kg for v in vehicles) if vehicles else 0.0
    oversized = [c for c in customers if c.demand_kg > max_capacity_float]
    if oversized:
        oversized_str = ", ".join(f"{c.name} ({c.demand_kg} kg)" for c in oversized)
        raise ValueError(
            f"Customer demand exceeds maximum vehicle capacity ({max_capacity_float:.0f} kg): {oversized_str}."
        )

    # Scale to integer units (e.g. 12.5 kg -> 1250) so OR-Tools enforces exact decimal constraints
    DEMAND_SCALE = 100
    demands = [0] + [int(round(c.demand_kg * DEMAND_SCALE)) for c in customers]
    capacities = [int(round(v.capacity_kg * DEMAND_SCALE)) for v in vehicles]

    # 2. Build coordinate list: depot first, then customers in order
    coords: list[tuple[float, float]] = [(depot.latitude, depot.longitude)]
    for c in customers:
        coords.append((c.latitude, c.longitude))

    # 3. Get OSRM distance/time matrices
    logger.info("Fetching OSRM distance/time matrix for %d points", len(coords))
    dist_matrix, dur_matrix = await get_distance_time_matrix(coords)

    cvrp_input = CVRPInput(
        distance_matrix=dist_matrix,
        duration_matrix=dur_matrix,
        demands=demands,
        vehicle_capacities=capacities,
        num_vehicles=len(vehicles),
        depot_index=0,
        mode=mode,
    )

    # 4. Solve CVRP
    logger.info("Solving CVRP with %d vehicles, mode=%s", len(vehicles), mode.value)
    solution: CVRPSolution = solve_cvrp(cvrp_input)

    if all(len(r) == 0 for r in solution.vehicle_routes):
        raise RuntimeError(
            f"Solver found no feasible solution (status: {solution.solver_status}). "
            "This may indicate the problem is infeasible or the time limit is too short."
        )

    # 5. Build baseline comparison
    _, bl_dist, bl_dur = nearest_neighbour_baseline(
        dist_matrix, dur_matrix, demands, capacities, len(vehicles),
    )

    opt_dist = solution.total_distance_m
    opt_dur = solution.total_duration_s

    dist_change = ((opt_dist - bl_dist) / bl_dist * 100) if bl_dist else 0.0
    time_change = ((opt_dur - bl_dur) / bl_dur * 100) if bl_dur else 0.0

    baseline = BaselineComparison(
        baseline_distance_km=round(bl_dist / 1000, 2),
        baseline_time_min=round(bl_dur / 60, 2),
        optimized_distance_km=round(opt_dist / 1000, 2),
        optimized_time_min=round(opt_dur / 60, 2),
        distance_change_pct=round(dist_change, 2),
        time_change_pct=round(time_change, 2),
    )

    # 6. Build per-vehicle routes + fetch geometry
    vehicle_routes: list[VehicleRoute] = []
    all_geojson_features: list[dict[str, Any]] = []

    for v_idx, node_indices in enumerate(solution.vehicle_routes):
        vehicle = vehicles[v_idx]
        stops: list[RouteStop] = []
        cumulative = 0.0

        for seq, node in enumerate(node_indices):
            c = customers[node - 1]  # node 0 is depot, customers are 1-indexed
            cumulative += c.demand_kg
            stops.append(RouteStop(
                sequence=seq + 1,
                customer_id=c.id,
                customer_name=c.name,
                latitude=c.latitude,
                longitude=c.longitude,
                demand_kg=c.demand_kg,
                cumulative_load_kg=round(cumulative, 2),
            ))

        load = sum(s.demand_kg for s in stops)
        util = (load / vehicle.capacity_kg * 100) if vehicle.capacity_kg else 0

        # Fetch route geometry from OSRM
        geojson = None
        if stops:
            waypoints: list[tuple[float, float]] = [
                (depot.latitude, depot.longitude),
            ]
            waypoints.extend((s.latitude, s.longitude) for s in stops)
            waypoints.append((depot.latitude, depot.longitude))
            try:
                geojson = await get_route_geometry(waypoints)
                geojson["properties"]["vehicle_id"] = vehicle.id
                geojson["properties"]["vehicle_name"] = vehicle.name
                all_geojson_features.append(geojson)
            except Exception:
                logger.warning("Could not fetch geometry for vehicle %s", vehicle.id)

        vehicle_routes.append(VehicleRoute(
            vehicle_id=vehicle.id,
            vehicle_name=vehicle.name,
            capacity_kg=vehicle.capacity_kg,
            load_kg=round(load, 2),
            utilization_pct=round(util, 1),
            distance_km=round(solution.vehicle_distances_m[v_idx] / 1000, 2),
            time_min=round(solution.vehicle_durations_s[v_idx] / 60, 2),
            stops=stops,
            route_geojson=geojson,
        ))

    vehicles_used = sum(1 for r in vehicle_routes if r.stops)

    # 7. Explanation
    explanation = explain_routes(vehicle_routes, mode, vehicles_used, len(vehicles))

    # 8. Combined GeoJSON FeatureCollection
    combined_geojson: dict[str, Any] | None = None
    if all_geojson_features:
        combined_geojson = {
            "type": "FeatureCollection",
            "features": all_geojson_features,
        }

    # 9. Assemble final result
    result = OptimizationResult(
        id=str(uuid.uuid4()),
        optimization_mode=mode,
        total_distance_km=round(opt_dist / 1000, 2),
        total_time_min=round(opt_dur / 60, 2),
        vehicles_used=vehicles_used,
        total_capacity_used_kg=round(sum(r.load_kg for r in vehicle_routes), 2),
        routes=vehicle_routes,
        baseline=baseline,
        explanation=explanation,
        depot=depot,
        geojson=combined_geojson,
    )

    _result_store[result.id] = result
    logger.info(
        "Optimization %s complete: %.1f km, %.1f min, %d vehicles",
        result.id, result.total_distance_km, result.total_time_min, vehicles_used,
    )
    return result
