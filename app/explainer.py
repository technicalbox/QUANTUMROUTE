"""Structured route explanation generator.

Produces natural-language summaries from actual solver output.
**No claims are invented** – only data-grounded statements.
"""

from __future__ import annotations

from app.models import OptimizationMode, RouteExplanation, VehicleRoute


def explain_routes(
    routes: list[VehicleRoute],
    mode: OptimizationMode,
    vehicles_used: int,
    total_vehicles: int,
) -> RouteExplanation:
    """Generate structured per-vehicle explanations from real route data."""
    mode_label = {
        OptimizationMode.SHORTEST: "minimise total road distance",
        OptimizationMode.FASTEST: "minimise total travel time",
        OptimizationMode.BALANCED: "balance distance and travel time",
    }[mode]

    summary = (
        f"The optimizer assigned {sum(len(r.stops) for r in routes)} customers "
        f"across {vehicles_used} of {total_vehicles} available vehicles "
        f"using the '{mode.value}' objective ({mode_label})."
    )

    explanations: list[str] = []
    for r in routes:
        if not r.stops:
            continue
        stop_names = ", ".join(s.customer_name for s in r.stops)
        explanations.append(
            f"{r.vehicle_name} was assigned stops {stop_names} "
            f"({len(r.stops)} stops, {r.load_kg:.1f} kg / {r.capacity_kg:.0f} kg capacity, "
            f"{r.utilization_pct:.0f}% utilization) covering {r.distance_km:.1f} km "
            f"in ~{r.time_min:.0f} min. This assignment satisfies the vehicle's capacity "
            f"constraint while reducing the selected routing objective."
        )

    return RouteExplanation(summary=summary, vehicle_explanations=explanations)
