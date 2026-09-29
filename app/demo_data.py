"""Built-in deterministic demo dataset.

Uses real coordinates around **Visakhapatnam (Vizag), Andhra Pradesh** so the
demo works without any geocoding service.  All locations are on real streets
that OSRM can route between.
"""

from __future__ import annotations

from app.models import Customer, Depot, OptimizationRequest, OptimizationMode, Vehicle


def get_demo_depot() -> Depot:
    """Central depot near Visakhapatnam Railway Station."""
    return Depot(
        latitude=17.7215,
        longitude=83.3005,
        name="Vizag Central Depot",
    )


def get_demo_customers() -> list[Customer]:
    """25 customers spread across Visakhapatnam – varied demand weights."""
    return [
        Customer(id="C01", name="MVP Colony Store", latitude=17.7340, longitude=83.3170, demand_kg=12.5),
        Customer(id="C02", name="Dwaraka Nagar Mart", latitude=17.7260, longitude=83.3120, demand_kg=8.0),
        Customer(id="C03", name="Siripuram Grocery", latitude=17.7310, longitude=83.3260, demand_kg=15.0),
        Customer(id="C04", name="Seethammadhara Shop", latitude=17.7420, longitude=83.3080, demand_kg=6.5),
        Customer(id="C05", name="Akkayyapalem Depot", latitude=17.7380, longitude=83.2950, demand_kg=20.0),
        Customer(id="C06", name="Gajuwaka Warehouse", latitude=17.7010, longitude=83.2180, demand_kg=25.0),
        Customer(id="C07", name="Maddilapalem Store", latitude=17.7480, longitude=83.3180, demand_kg=10.0),
        Customer(id="C08", name="NAD Junction Mart", latitude=17.7280, longitude=83.2450, demand_kg=18.0),
        Customer(id="C09", name="Pendurthi Outlet", latitude=17.7760, longitude=83.2320, demand_kg=14.0),
        Customer(id="C10", name="Gopalapatnam Shop", latitude=17.7590, longitude=83.2610, demand_kg=9.5),
        Customer(id="C11", name="Asilmetta Market", latitude=17.7230, longitude=83.3050, demand_kg=7.0),
        Customer(id="C12", name="Jagadamba Centre", latitude=17.7190, longitude=83.3010, demand_kg=11.0),
        Customer(id="C13", name="Kancharapalem Hub", latitude=17.7350, longitude=83.2750, demand_kg=16.0),
        Customer(id="C14", name="Old Town Store", latitude=17.7130, longitude=83.2960, demand_kg=5.5),
        Customer(id="C15", name="Waltair Uptown", latitude=17.7290, longitude=83.3240, demand_kg=13.0),
        Customer(id="C16", name="Beach Road Kiosk", latitude=17.7170, longitude=83.3280, demand_kg=4.0),
        Customer(id="C17", name="Lawsons Bay Store", latitude=17.7210, longitude=83.3350, demand_kg=8.5),
        Customer(id="C18", name="Rushikonda Market", latitude=17.7590, longitude=83.3770, demand_kg=22.0),
        Customer(id="C19", name="Madhurawada Hub", latitude=17.7800, longitude=83.3650, demand_kg=19.0),
        Customer(id="C20", name="PM Palem Store", latitude=17.7940, longitude=83.3850, demand_kg=10.5),
        Customer(id="C21", name="Yendada Shop", latitude=17.7670, longitude=83.3510, demand_kg=7.5),
        Customer(id="C22", name="Hanumanthawaka", latitude=17.7100, longitude=83.2830, demand_kg=17.0),
        Customer(id="C23", name="Pedagantyada Mart", latitude=17.7580, longitude=83.2190, demand_kg=12.0),
        Customer(id="C24", name="Steel Plant Area", latitude=17.6800, longitude=83.1960, demand_kg=30.0),
        Customer(id="C25", name="Simhachalam Store", latitude=17.7670, longitude=83.2470, demand_kg=11.5),
    ]


def get_demo_vehicles() -> list[Vehicle]:
    """5 delivery vehicles with varying capacity."""
    return [
        Vehicle(id="V1", name="Vizag Van Alpha", capacity_kg=80.0),
        Vehicle(id="V2", name="Vizag Van Beta", capacity_kg=80.0),
        Vehicle(id="V3", name="Vizag Van Gamma", capacity_kg=70.0),
        Vehicle(id="V4", name="Vizag Van Delta", capacity_kg=70.0),
        Vehicle(id="V5", name="Vizag Mini Truck", capacity_kg=100.0),
    ]


def get_demo_request(mode: OptimizationMode = OptimizationMode.BALANCED) -> OptimizationRequest:
    """Return a fully-formed optimisation request using the demo data."""
    return OptimizationRequest(
        depot=get_demo_depot(),
        customers=get_demo_customers(),
        vehicles=get_demo_vehicles(),
        optimization_mode=mode,
    )
