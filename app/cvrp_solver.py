"""Capacitated Vehicle Routing Problem (CVRP) solver using Google OR-Tools.

Supports three objective modes:
  • shortest  – minimise total road distance
  • fastest   – minimise total travel time
  • balanced  – minimise a weighted combination of normalised distance & time

The solver is given an explicit time limit (from config) and will return the
best solution found even if the limit is reached.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Sequence

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from app.config import settings
from app.models import OptimizationMode

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Solver data container
# ---------------------------------------------------------------------------

@dataclass
class CVRPInput:
    """Everything OR-Tools needs to solve the CVRP."""
    distance_matrix: list[list[float]]   # metres
    duration_matrix: list[list[float]]   # seconds
    demands: list[int]                   # kg (index 0 = depot = 0)
    vehicle_capacities: list[int]        # kg per vehicle
    num_vehicles: int
    depot_index: int = 0
    mode: OptimizationMode = OptimizationMode.BALANCED


@dataclass
class CVRPSolution:
    """Parsed solver output."""
    vehicle_routes: list[list[int]]         # node indices per vehicle
    vehicle_distances_m: list[float] = field(default_factory=list)
    vehicle_durations_s: list[float] = field(default_factory=list)
    vehicle_loads_kg: list[float] = field(default_factory=list)
    total_distance_m: float = 0.0
    total_duration_s: float = 0.0
    solver_status: str = ""


# ---------------------------------------------------------------------------
# Cost matrix builder
# ---------------------------------------------------------------------------

def _build_cost_matrix(
    dist: list[list[float]],
    dur: list[list[float]],
    mode: OptimizationMode,
) -> list[list[int]]:
    """Return an integer cost matrix according to the chosen objective.

    OR-Tools needs integer costs, so we scale appropriately.
    """
    n = len(dist)
    if mode == OptimizationMode.SHORTEST:
        # Cost = distance in metres (already suitable scale)
        return [[int(dist[i][j]) for j in range(n)] for i in range(n)]

    if mode == OptimizationMode.FASTEST:
        # Cost = duration in seconds
        return [[int(dur[i][j]) for j in range(n)] for i in range(n)]

    # BALANCED – normalise both to [0, 10_000] then average
    max_d = max(dist[i][j] for i in range(n) for j in range(n) if i != j) or 1
    max_t = max(dur[i][j] for i in range(n) for j in range(n) if i != j) or 1
    scale = 10_000
    cost = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            nd = (dist[i][j] / max_d) * scale
            nt = (dur[i][j] / max_t) * scale
            cost[i][j] = int((nd + nt) / 2)
    return cost


# ---------------------------------------------------------------------------
# Public solver function
# ---------------------------------------------------------------------------

def solve_cvrp(inp: CVRPInput) -> CVRPSolution:
    """Solve the CVRP and return the best solution found within the time limit."""
    n = len(inp.distance_matrix)
    cost = _build_cost_matrix(inp.distance_matrix, inp.duration_matrix, inp.mode)

    manager = pywrapcp.RoutingIndexManager(n, inp.num_vehicles, inp.depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # ---- Transit cost callback ----
    def cost_callback(from_idx: int, to_idx: int) -> int:
        from_node = manager.IndexToNode(from_idx)
        to_node = manager.IndexToNode(to_idx)
        return cost[from_node][to_node]

    cost_cb_idx = routing.RegisterTransitCallback(cost_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(cost_cb_idx)

    # ---- Distance callback (for tracking) ----
    def dist_callback(from_idx: int, to_idx: int) -> int:
        return int(inp.distance_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)])

    dist_cb_idx = routing.RegisterTransitCallback(dist_callback)
    routing.AddDimension(dist_cb_idx, 0, 10_000_000, True, "Distance")

    # ---- Duration callback (for tracking) ----
    def dur_callback(from_idx: int, to_idx: int) -> int:
        return int(inp.duration_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)])

    dur_cb_idx = routing.RegisterTransitCallback(dur_callback)
    routing.AddDimension(dur_cb_idx, 0, 10_000_000, True, "Duration")

    # ---- Capacity constraint ----
    def demand_callback(idx: int) -> int:
        return inp.demands[manager.IndexToNode(idx)]

    demand_cb_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_cb_idx,
        0,  # no slack
        inp.vehicle_capacities,
        True,  # start at zero
        "Capacity",
    )

    # ---- Search parameters ----
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = settings.SOLVER_TIME_LIMIT

    # ---- Solve ----
    solution = routing.SolveWithParameters(search_params)

    status_map = {
        0: "ROUTING_NOT_SOLVED",
        1: "ROUTING_SUCCESS",
        2: "ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED",
        3: "ROUTING_FAIL",
        4: "ROUTING_FAIL_TIMEOUT",
        5: "ROUTING_INVALID",
        6: "ROUTING_INFEASIBLE",
    }
    status = status_map.get(routing.status(), f"UNKNOWN({routing.status()})")
    logger.info("OR-Tools solver status: %s", status)

    if solution is None:
        return CVRPSolution(
            vehicle_routes=[[] for _ in range(inp.num_vehicles)],
            solver_status=status,
        )

    # ---- Extract routes ----
    result = CVRPSolution(
        vehicle_routes=[],
        solver_status=status,
    )

    dist_dim = routing.GetDimensionOrDie("Distance")
    dur_dim = routing.GetDimensionOrDie("Duration")

    for v in range(inp.num_vehicles):
        route: list[int] = []
        idx = routing.Start(v)
        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            if node != inp.depot_index:
                route.append(node)
            idx = solution.Value(routing.NextVar(idx))

        # Distance & duration from dimension cumulative values
        end_idx = idx
        v_dist = solution.Value(dist_dim.CumulVar(end_idx))
        v_dur = solution.Value(dur_dim.CumulVar(end_idx))
        v_load = sum(inp.demands[n] for n in route)

        result.vehicle_routes.append(route)
        result.vehicle_distances_m.append(float(v_dist))
        result.vehicle_durations_s.append(float(v_dur))
        result.vehicle_loads_kg.append(float(v_load))

    result.total_distance_m = sum(result.vehicle_distances_m)
    result.total_duration_s = sum(result.vehicle_durations_s)

    return result
