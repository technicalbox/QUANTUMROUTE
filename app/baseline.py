"""Simple deterministic baseline for comparison.

Uses a nearest-neighbour heuristic with round-robin vehicle assignment.
This is intentionally simple so the OR-Tools solution can show improvement.

**No claim is made that this baseline is optimal or authoritative.**
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def nearest_neighbour_baseline(
    distance_matrix: list[list[float]],
    duration_matrix: list[list[float]],
    demands: list[int],
    vehicle_capacities: list[int],
    num_vehicles: int,
    depot_index: int = 0,
) -> tuple[list[list[int]], float, float]:
    """Assign customers to vehicles using greedy nearest-neighbour.

    Returns
    -------
    routes : list of node-index lists (one per vehicle, excluding depot)
    total_distance_m : sum of route distances in metres
    total_duration_s : sum of route durations in seconds
    """
    n = len(distance_matrix)
    visited = {depot_index}
    routes: list[list[int]] = [[] for _ in range(num_vehicles)]
    loads = [0] * num_vehicles
    current = [depot_index] * num_vehicles  # current position per vehicle

    # Round-robin: cycle through vehicles, each picks its nearest unvisited
    while len(visited) < n:
        progress = False
        for v in range(num_vehicles):
            best_node = -1
            best_dist = float("inf")
            for j in range(n):
                if j in visited:
                    continue
                if loads[v] + demands[j] > vehicle_capacities[v]:
                    continue
                d = distance_matrix[current[v]][j]
                if d < best_dist:
                    best_dist = d
                    best_node = j
            if best_node >= 0:
                routes[v].append(best_node)
                loads[v] += demands[best_node]
                current[v] = best_node
                visited.add(best_node)
                progress = True
        if not progress:
            # Remaining customers can't fit – stop
            logger.warning(
                "Baseline couldn't assign %d customers due to capacity",
                n - len(visited),
            )
            break

    # Calculate metrics
    total_dist = 0.0
    total_dur = 0.0
    for v, route in enumerate(routes):
        if not route:
            continue
        # depot → first
        total_dist += distance_matrix[depot_index][route[0]]
        total_dur += duration_matrix[depot_index][route[0]]
        for i in range(len(route) - 1):
            total_dist += distance_matrix[route[i]][route[i + 1]]
            total_dur += duration_matrix[route[i]][route[i + 1]]
        # last → depot
        total_dist += distance_matrix[route[-1]][depot_index]
        total_dur += duration_matrix[route[-1]][depot_index]

    return routes, total_dist, total_dur
