// Frontend mock of the classical pipeline (OSRM -> OR-Tools CVRP -> OSRM geometry).
// Swap `optimize` for a fetch to POST /api/v1/optimize when the FastAPI backend is live.
import type {
  LngLat, OptimizeRequest, OptimizeResponse, RouteMetrics, Stop, VehicleRoute,
  QuantumDemoRequest, QuantumDemoResponse,
} from "@/types/api";

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) || "http://127.0.0.1:8000";

export function haversineKm(a: LngLat, b: LngLat) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * 1.3; // road detour factor
}

const SPEED_KMH = 24;

function routeCost(pts: LngLat[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineKm(pts[i - 1]!, pts[i]!);
  return d;
}

function twoOpt(order: Stop[], depot: LngLat) {
  let best = order.slice();
  const cost = (o: Stop[]) => routeCost([depot, ...o.map((s) => s.location), depot]);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++)
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (cost(cand) < cost(best) - 1e-9) { best = cand; improved = true; }
      }
  }
  return best;
}

function buildRoute(vehicleId: string, stops: Stop[], depot: LngLat): VehicleRoute {
  const geometry: LngLat[] = [depot, ...stops.map((s) => s.location), depot];
  const distanceKm = routeCost(geometry);
  const service = stops.reduce((a, s) => a + s.serviceMin, 0);
  return {
    vehicleId, stopIds: stops.map((s) => s.id), geometry,
    distanceKm, durationMin: (distanceKm / SPEED_KMH) * 60 + service,
    load: stops.reduce((a, s) => a + s.demand, 0),
  };
}

function metrics(routes: VehicleRoute[], fleetCapacity: number): RouteMetrics {
  const used = routes.filter((r) => r.stopIds.length > 0);
  return {
    distanceKm: routes.reduce((a, r) => a + r.distanceKm, 0),
    durationMin: routes.reduce((a, r) => a + r.durationMin, 0),
    vehiclesUsed: used.length,
    capacityUtilization: fleetCapacity ? routes.reduce((a, r) => a + r.load, 0) / fleetCapacity : 0,
  };
}

export async function mockOptimize(req: OptimizeRequest): Promise<OptimizeResponse> {
  const t0 = performance.now();
  const d = req.depot.location;
  const n = req.vehicles.length;

  // Baseline: stops in listed order, chunked evenly across vehicles.
  const per = Math.ceil(req.stops.length / n);
  const baselineRoutes = req.vehicles.map((v, i) =>
    buildRoute(v.id, req.stops.slice(i * per, (i + 1) * per), d));

  // Sweep clustering by polar angle, capacity-aware, then 2-opt per vehicle.
  const angle = (s: Stop) => Math.atan2(s.location[1] - d[1], s.location[0] - d[0]);
  const sorted = [...req.stops].sort((a, b) => angle(a) - angle(b));
  const buckets: Stop[][] = req.vehicles.map(() => []);
  const target = req.stops.reduce((a, s) => a + s.demand, 0) / n;
  let vi = 0, load = 0;
  for (const s of sorted) {
    const cap = req.vehicles[vi]!.capacity;
    const limit = req.mode === "distance" ? cap : Math.min(cap, target * (req.mode === "time" ? 1.02 : 1.12));
    if (load + s.demand > limit && vi < n - 1) { vi++; load = 0; }
    buckets[vi]!.push(s); load += s.demand;
  }
  const routes = req.vehicles.map((v, i) => buildRoute(v.id, twoOpt(buckets[i]!, d), d));

  const fleetCapacity = req.vehicles.reduce((a, v) => a + v.capacity, 0);
  await new Promise((r) => setTimeout(r, 600));
  return {
    mode: req.mode, solver: "mock-classical", routes, baselineRoutes,
    baseline: metrics(baselineRoutes, fleetCapacity), optimized: metrics(routes, fleetCapacity),
    computeMs: Math.round(performance.now() - t0),
  };
}

/**
 * Fetch built-in demo scenario from FastAPI backend.
 */
export async function fetchBackendDemo(): Promise<DemoScenario> {
  const res = await fetch(`${API_BASE}/api/v1/demo?run=false`);
  if (!res.ok) {
    throw new Error(`Failed to load backend demo: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Optimize routes.
 * In Live Mode, sends request to FastAPI (OSRM + OR-Tools CVRP).
 * If the backend fails in Live Mode, throws immediately — never silently falls back to mock!
 */
export async function optimize(req: OptimizeRequest, liveMode: boolean = true): Promise<OptimizeResponse> {
  if (liveMode) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/optimize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errorJson.detail || `Optimization failed with status ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      // Guardrail 2: Do NOT silently return mock data in Live Mode. Raise clearly.
      console.error("[QuantumRoute] Live optimization failed:", err);
      throw new Error(err.message || "Failed to connect to FastAPI backend on " + API_BASE);
    }
  }
  return mockOptimize(req);
}

/**
 * Execute 16-qubit QAOA experiment.
 * In Live Mode, queries FastAPI Qiskit Aer backend with Google OR-Tools comparison.
 */
export async function runLiveQuantumDemo(req: QuantumDemoRequest): Promise<QuantumDemoResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/quantum/demo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(errorJson.detail || `Quantum demo failed with status ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.error("[QuantumRoute] Live quantum demo failed:", err);
    throw new Error(err.message || "Failed to connect to Quantum backend on " + API_BASE);
  }
}

// ---- Quantum Lab Mock (fallback only for local offline demo) ----
export function quantumDemoMock(req: QuantumDemoRequest, stops: Stop[], depot: LngLat): QuantumDemoResponse {
  const sub = req.stopIds.map((id) => stops.find((s) => s.id === id)!).filter(Boolean);
  const perms: Stop[][] = [];
  const permute = (arr: Stop[], acc: Stop[] = []) => {
    if (!arr.length) { perms.push(acc); return; }
    arr.forEach((s, i) => permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...acc, s]));
  };
  permute(sub);
  const cost = (o: Stop[]) => routeCost([depot, ...o.map((s) => s.location), depot]);
  const costs = perms.map(cost);
  const min = Math.min(...costs), max = Math.max(...costs);
  const g = req.gamma.reduce((a, b) => a + b, 0), b = req.beta.reduce((a, c) => a + c, 0);
  const sharp = 1 + 6 * Math.abs(Math.sin(g) * Math.cos(b)) * req.p;
  const w = costs.map((c) => Math.exp(-sharp * (c - min) / (max - min || 1)));
  const Z = w.reduce((a, c) => a + c, 0);
  const dist = perms.map((p, i) => ({
    bitstring: p.map((s) => sub.indexOf(s).toString(2).padStart(2, "0")).join(""),
    probability: w[i]! / Z, cost: costs[i]!, order: p,
  })).sort((a, c) => c.probability - a.probability);

  const nn: Stop[] = []; let cur = depot; const left = [...sub];
  while (left.length) {
    left.sort((a, c) => haversineKm(cur, a.location) - haversineKm(cur, c.location));
    const nx = left.shift()!; nn.push(nx); cur = nx.location;
  }
  return {
    isDemo: true,
    backend: "frontend-mock",
    qubits: 16,
    formulation: "4 customer stops × 4 possible positions = 16 binary variables / qubits (depot fixed at step 0)",
    solver_comparison: "Simulated QAOA vs Classical Nearest Neighbour",
    distribution: dist.slice(0, 12).map(({ bitstring, probability, cost }) => ({ bitstring, probability, cost })),
    bestOrder: (dist[0]?.order ?? []).map((s) => s.id),
    classicalOrder: nn.map((s) => s.id),
    classicalCost: cost(nn),
    quantumCost: dist[0]?.cost ?? 0,
    note: "Browser simulation. Connect backend for live Qiskit Aer output.",
  };
}
