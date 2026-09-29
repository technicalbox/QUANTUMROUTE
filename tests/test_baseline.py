"""Tests for baseline comparison logic."""

from __future__ import annotations

from app.baseline import nearest_neighbour_baseline


class TestBaseline:
    def test_all_customers_assigned(self, small_distance_matrix, small_duration_matrix):
        demands = [0, 10, 15, 8, 12]
        capacities = [50, 50]
        routes, dist, dur = nearest_neighbour_baseline(
            small_distance_matrix, small_duration_matrix,
            demands, capacities, 2,
        )
        all_nodes = []
        for r in routes:
            all_nodes.extend(r)
        assert set(all_nodes) == {1, 2, 3, 4}

    def test_capacity_respected(self, small_distance_matrix, small_duration_matrix):
        demands = [0, 10, 15, 8, 12]
        capacities = [20, 30]
        routes, _, _ = nearest_neighbour_baseline(
            small_distance_matrix, small_duration_matrix,
            demands, capacities, 2,
        )
        for v_idx, route in enumerate(routes):
            load = sum(demands[n] for n in route)
            assert load <= capacities[v_idx]

    def test_positive_metrics(self, small_distance_matrix, small_duration_matrix):
        demands = [0, 10, 15, 8, 12]
        capacities = [50, 50]
        _, dist, dur = nearest_neighbour_baseline(
            small_distance_matrix, small_duration_matrix,
            demands, capacities, 2,
        )
        assert dist > 0
        assert dur > 0

    def test_empty_when_no_capacity(self, small_distance_matrix, small_duration_matrix):
        demands = [0, 100, 100, 100, 100]
        capacities = [10, 10]
        routes, _, _ = nearest_neighbour_baseline(
            small_distance_matrix, small_duration_matrix,
            demands, capacities, 2,
        )
        # Can't serve any customer
        all_nodes = []
        for r in routes:
            all_nodes.extend(r)
        assert len(all_nodes) == 0
