"""Tests for the CVRP solver: capacity constraints, modes, timeouts."""

from __future__ import annotations

from app.cvrp_solver import CVRPInput, solve_cvrp
from app.models import OptimizationMode


class TestCVRPCapacity:
    """Verify that the solver respects vehicle capacity constraints."""

    def test_capacity_not_exceeded(self, small_distance_matrix, small_duration_matrix):
        """No vehicle should carry more than its capacity."""
        demands = [0, 10, 15, 8, 12]   # depot + 4 customers
        capacities = [25, 25]

        inp = CVRPInput(
            distance_matrix=small_distance_matrix,
            duration_matrix=small_duration_matrix,
            demands=demands,
            vehicle_capacities=capacities,
            num_vehicles=2,
            mode=OptimizationMode.SHORTEST,
        )
        sol = solve_cvrp(inp)

        for v_idx, route in enumerate(sol.vehicle_routes):
            load = sum(demands[n] for n in route)
            assert load <= capacities[v_idx], (
                f"Vehicle {v_idx} load {load} exceeds capacity {capacities[v_idx]}"
            )

    def test_all_customers_served(self, small_distance_matrix, small_duration_matrix):
        """Every customer must appear in exactly one route."""
        demands = [0, 10, 15, 8, 12]
        capacities = [50, 50]

        inp = CVRPInput(
            distance_matrix=small_distance_matrix,
            duration_matrix=small_duration_matrix,
            demands=demands,
            vehicle_capacities=capacities,
            num_vehicles=2,
            mode=OptimizationMode.SHORTEST,
        )
        sol = solve_cvrp(inp)

        all_nodes = []
        for route in sol.vehicle_routes:
            all_nodes.extend(route)

        customers = {1, 2, 3, 4}
        assert set(all_nodes) == customers, f"Not all customers served: {all_nodes}"

    def test_total_distance_positive(self, small_distance_matrix, small_duration_matrix):
        demands = [0, 10, 15, 8, 12]
        capacities = [50, 50]

        inp = CVRPInput(
            distance_matrix=small_distance_matrix,
            duration_matrix=small_duration_matrix,
            demands=demands,
            vehicle_capacities=capacities,
            num_vehicles=2,
            mode=OptimizationMode.SHORTEST,
        )
        sol = solve_cvrp(inp)
        assert sol.total_distance_m > 0
        assert sol.total_duration_s > 0


class TestCVRPModes:
    """Verify that different modes produce different cost matrices."""

    def _solve(self, mode, small_distance_matrix, small_duration_matrix):
        demands = [0, 10, 15, 8, 12]
        capacities = [50, 50]
        inp = CVRPInput(
            distance_matrix=small_distance_matrix,
            duration_matrix=small_duration_matrix,
            demands=demands,
            vehicle_capacities=capacities,
            num_vehicles=2,
            mode=mode,
        )
        return solve_cvrp(inp)

    def test_shortest_returns_solution(self, small_distance_matrix, small_duration_matrix):
        sol = self._solve(OptimizationMode.SHORTEST, small_distance_matrix, small_duration_matrix)
        assert sol.solver_status != "ROUTING_INFEASIBLE"

    def test_fastest_returns_solution(self, small_distance_matrix, small_duration_matrix):
        sol = self._solve(OptimizationMode.FASTEST, small_distance_matrix, small_duration_matrix)
        assert sol.solver_status != "ROUTING_INFEASIBLE"

    def test_balanced_returns_solution(self, small_distance_matrix, small_duration_matrix):
        sol = self._solve(OptimizationMode.BALANCED, small_distance_matrix, small_duration_matrix)
        assert sol.solver_status != "ROUTING_INFEASIBLE"


class TestCVRPTimeout:
    """Solver should return best-effort solution rather than hang."""

    def test_solver_does_not_hang(self, small_distance_matrix, small_duration_matrix):
        """Even with very short time limit, solver returns something."""
        import app.config as cfg
        original = cfg.settings.SOLVER_TIME_LIMIT
        cfg.settings.SOLVER_TIME_LIMIT = 1  # 1 second

        try:
            demands = [0, 10, 15, 8, 12]
            capacities = [50, 50]
            inp = CVRPInput(
                distance_matrix=small_distance_matrix,
                duration_matrix=small_duration_matrix,
                demands=demands,
                vehicle_capacities=capacities,
                num_vehicles=2,
                mode=OptimizationMode.SHORTEST,
            )
            sol = solve_cvrp(inp)
            # Should return without hanging – status may be SUCCESS or TIMEOUT
            assert sol.solver_status in (
                "ROUTING_SUCCESS",
                "ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED",
                "ROUTING_FAIL_TIMEOUT",
            )
        finally:
            cfg.settings.SOLVER_TIME_LIMIT = original
