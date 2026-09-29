# QuantumRoute 🚚⚡

**AI-powered last-mile delivery and vehicle-routing optimizer** for UC-038.

Solves multi-vehicle Capacitated Vehicle Routing Problems (CVRP) using real road-network data and Google OR-Tools, with an optional quantum computing demonstration via Qiskit.

---

## Architecture

```
Frontend (map)
  │
  ▼
FastAPI  ──►  OSRM (road network)
  │              │
  │              ▼
  │        Distance / Time Matrix
  │              │
  │              ▼
  │        OR-Tools CVRP Solver
  │              │
  │              ▼
  │        Optimized Routes
  │              │
  │              ▼
  │        OSRM Route Geometry
  │              │
  ▼              ▼
OptimizationResult (JSON + GeoJSON)
```

**Quantum Path** (isolated):
```
5-node TSP → QUBO → QAOA (Qiskit Aer) → Classical comparison
```

---

## Quick Start

### Local (Python)

```bash
# 1. Clone and enter directory
cd quantumroute

# 2. Create virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
# source .venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy env and configure
copy .env.example .env       # Windows
# cp .env.example .env       # Linux/Mac

# 5. Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit **http://localhost:8000/docs** for the interactive Swagger UI.

### Docker

```bash
docker compose up --build
```

One command. App available at **http://localhost:8000**.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OSRM_BASE_URL` | `http://router.project-osrm.org` | OSRM routing server URL |
| `APP_ENV` | `development` | `development` or `production` |
| `SOLVER_TIME_LIMIT` | `20` | OR-Tools solver time limit in seconds |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/demo` | Run the built-in 25-customer demo |
| `POST` | `/api/optimize` | Solve CVRP with user-supplied data |
| `GET` | `/api/optimization/{id}` | Retrieve a past result |
| `POST` | `/api/quantum/demo` | Run the quantum TSP experiment |

### `GET /api/demo`

Runs the full optimization pipeline with the built-in Visakhapatnam dataset.

**Query parameters:**
- `mode` – `shortest`, `fastest`, or `balanced` (default: `balanced`)

**Example:**
```
GET http://localhost:8000/api/demo?mode=fastest
```

### `POST /api/optimize`

**Request body:**
```json
{
  "depot": {
    "latitude": 17.7215,
    "longitude": 83.3005,
    "name": "Vizag Central Depot"
  },
  "customers": [
    {
      "id": "C01",
      "name": "MVP Colony Store",
      "latitude": 17.7340,
      "longitude": 83.3170,
      "demand_kg": 12.5
    }
  ],
  "vehicles": [
    {
      "id": "V1",
      "name": "Vizag Van Alpha",
      "capacity_kg": 80.0
    }
  ],
  "optimization_mode": "balanced"
}
```

**Response:** Full `OptimizationResult` with routes, metrics, GeoJSON, baseline comparison, and explanation.

### `POST /api/quantum/demo`

Runs a 5-node TSP experiment:
- QUBO formulation → QAOA on Qiskit Aer simulator
- Classical brute-force comparison
- Returns both costs and routes

No quantum advantage is claimed.

---

## Optimization Modes

| Mode | Objective |
|---|---|
| `shortest` | Minimise total road distance |
| `fastest` | Minimise total travel time |
| `balanced` | Minimise normalised combination of distance and time |

---

## Running Tests

```bash
# All tests (OSRM is mocked – no network needed)
pytest

# Verbose with coverage
pytest -v

# Specific test file
pytest tests/test_cvrp.py
```

---

## Project Structure

```
quantumroute/
├── app/
│   ├── main.py            # FastAPI entry point
│   ├── config.py          # Environment configuration
│   ├── models.py          # Pydantic data models
│   ├── demo_data.py       # Built-in 25-customer Vizag dataset
│   ├── osrm_client.py     # OSRM Table + Route integration + cache
│   ├── cvrp_solver.py     # OR-Tools CVRP solver
│   ├── baseline.py        # Nearest-neighbour baseline heuristic
│   ├── optimizer.py       # Main optimization pipeline
│   ├── explainer.py       # Route explanation generator
│   ├── quantum_demo.py    # Qiskit QAOA TSP experiment
│   └── routes/
│       ├── health.py      # GET /api/health
│       ├── optimize.py    # GET /api/demo, POST /api/optimize, GET /api/optimization/{id}
│       └── quantum.py     # POST /api/quantum/demo
├── tests/
│   ├── conftest.py        # Shared fixtures
│   ├── test_models.py     # Input validation tests
│   ├── test_cvrp.py       # Solver capacity/timeout tests
│   ├── test_osrm.py       # OSRM parsing tests (mocked)
│   ├── test_baseline.py   # Baseline logic tests
│   ├── test_api.py        # FastAPI endpoint tests
│   └── test_e2e.py        # Full pipeline end-to-end test
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pyproject.toml
├── .env.example
└── README.md
```

---

## Known Limitations

1. **OSRM dependency** – The public OSRM server (`router.project-osrm.org`) has rate limits. For production, self-host OSRM with regional data.
2. **Quantum demo** – The 5-node QAOA experiment is educational only. It does not scale to production routing sizes and no quantum advantage is claimed.
3. **In-memory result store** – Past optimization results are stored in memory and lost on restart. For persistence, swap `_result_store` for SQLite or a database.
4. **Solver time limit** – The default 20-second limit may not find the global optimum for large instances. It returns the best solution found.
5. **OSRM cache** – File-based cache in `_osrm_cache/` grows indefinitely. Clear it periodically or when coordinates change.
6. **No authentication** – This is a hackathon demo. Add API keys or OAuth before any real deployment.
7. **Baseline** – The nearest-neighbour heuristic is intentionally simple. It is not a scientifically authoritative reference point.

---

## License

Hackathon project – UC-038.
