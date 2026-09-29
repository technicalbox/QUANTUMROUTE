import httpx
import json

def test_all():
    print("=================== 1. BACKEND VERIFICATION ===================")
    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0)
    
    r_health = client.get("/api/health")
    print(f"[OK] GET /api/health -> {r_health.status_code}: {r_health.json()}")
    assert r_health.status_code == 200

    r_demo = client.get("/api/v1/demo")
    print(f"[OK] GET /api/v1/demo -> {r_demo.status_code}: {len(r_demo.json()['stops'])} stops, {len(r_demo.json()['vehicles'])} vehicles")
    assert r_demo.status_code == 200
    demo_data = r_demo.json()

    print("\nTesting QAOA 16-Qubit Simulation vs Google OR-Tools on identical 4-stop subproblem...")
    r_quantum = client.post("/api/v1/quantum/demo", json={
        "stopIds": ["S01", "S02", "S03", "S04"],
        "p": 1,
        "gamma": [0.8],
        "beta": [0.4],
        "shots": 1024
    })
    print(f"[OK] POST /api/v1/quantum/demo -> {r_quantum.status_code}")
    assert r_quantum.status_code == 200
    q_data = r_quantum.json()
    print(f"     Qubits: {q_data.get('qubits')}")
    print(f"     Formulation: {q_data.get('formulation')}")
    print(f"     QAOA optimal order: {q_data.get('bestOrder')} (cost: {q_data.get('quantumCost')} km)")
    print(f"     Classical solver: {q_data.get('classical_solver')}")
    print(f"     OR-Tools optimal order: {q_data.get('classicalOrder')} (cost: {q_data.get('classicalCost')} km)")
    print(f"     Solver comparison: {q_data.get('solver_comparison')}")
    print(f"     Sampled bitstrings count: {len(q_data.get('distribution', []))}")
    print(f"     Note: {q_data.get('note')}")

    print("\nTesting Full 24-Stop Multi-Vehicle CVRP with OR-Tools + OSRM Road Geometry...")
    r_opt = client.post("/api/v1/optimize", json={
        "depot": demo_data["depot"],
        "stops": demo_data["stops"],
        "vehicles": demo_data["vehicles"],
        "mode": "balanced"
    })
    print(f"[OK] POST /api/v1/optimize -> {r_opt.status_code}")
    assert r_opt.status_code == 200
    opt_data = r_opt.json()
    print(f"     Backend engine: {opt_data.get('backend')}")
    print(f"     Compute time: {opt_data.get('computeMs')} ms")
    print(f"     Optimized distance: {opt_data['optimized']['distanceKm']} km (Baseline: {opt_data['baseline']['distanceKm']} km)")
    print(f"     Optimized duration: {opt_data['optimized']['durationMin']} min (Baseline: {opt_data['baseline']['durationMin']} min)")
    print(f"     Vehicles used: {opt_data['optimized']['vehiclesUsed']} of {len(demo_data['vehicles'])}")
    for r in opt_data["routes"]:
        print(f"     - Vehicle {r['vehicleId']}: {len(r['stopIds'])} stops, {r['load']} kg load, {r['distanceKm']:.1f} km, {len(r['geometry'])} road-snapped GeoJSON points")
        assert len(r['geometry']) > len(r['stopIds']), "OSRM road geometry must contain intermediate road coordinates"

    print("\n=================== 2. FRONTEND VERIFICATION ===================")
    fe_client = httpx.Client(base_url="http://localhost:3000", timeout=30.0)
    for path in ["/", "/routes", "/fleet", "/quantum"]:
        r_fe = fe_client.get(path)
        print(f"[OK] GET {path} -> {r_fe.status_code} ({len(r_fe.text)} bytes HTML rendered)")
        assert r_fe.status_code == 200
        assert "QUANTUMROUTE" in r_fe.text or "Delivery Control Center" in r_fe.text or "Quantum Lab" in r_fe.text

    print("\n=================== ALL E2E VERIFICATIONS PASSED! ===================")

if __name__ == "__main__":
    test_all()
