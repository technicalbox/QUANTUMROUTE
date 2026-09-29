// API contracts for the future FastAPI backend.
// POST /api/v1/optimize        -> OptimizeResponse   (classical: OSRM -> OR-Tools CVRP -> OSRM route geometry)
// GET  /api/v1/demo            -> DemoScenario
// POST /api/v1/quantum/demo    -> QuantumDemoResponse (Qiskit + QAOA, small subproblem only)

export type LngLat = [number, number];
export type OptimizationMode = "distance" | "time" | "balanced";

export interface Depot { id: string; name: string; location: LngLat }
/** `demand` is package weight in kg. */
export interface Stop { id: string; name: string; location: LngLat; demand: number; serviceMin: number }
/** `capacity` is payload capacity in kg. */
export interface Vehicle { id: string; name: string; plate: string; capacity: number; color: string }

export interface DemoScenario { city: string; depot: Depot; stops: Stop[]; vehicles: Vehicle[] }

export interface OptimizeRequest {
  depot: Depot;
  stops: Stop[];
  vehicles: Vehicle[];
  mode: OptimizationMode;
}

export interface VehicleRoute {
  vehicleId: string;
  stopIds: string[];
  geometry: LngLat[];
  distanceKm: number;
  durationMin: number;
  /** Assigned load in kg. */
  load: number;
}

export interface RouteMetrics {
  distanceKm: number;
  durationMin: number;
  vehiclesUsed: number;
  /** Assigned load as a share of total fleet capacity, 0-1. */
  capacityUtilization: number;
}

export interface OptimizeResponse {
  mode: OptimizationMode;
  solver: "ortools-cvrp" | "mock-classical";
  routes: VehicleRoute[];
  baseline: RouteMetrics;
  optimized: RouteMetrics;
  baselineRoutes: VehicleRoute[];
  computeMs: number;
  explanation?: {
    summary: string;
    vehicle_explanations: string[];
  };
}

export interface QuantumDemoRequest { stopIds: string[]; p: number; gamma: number[]; beta: number[]; shots: number }
export interface QuantumDemoResponse {
  isDemo: true;
  backend: "qiskit-aer" | "frontend-mock";
  qubits: number;
  formulation?: string;
  solver_comparison?: string;
  distribution: { bitstring: string; probability: number; cost: number }[];
  bestOrder: string[];
  classicalOrder: string[];
  classicalCost: number;
  quantumCost: number;
  note?: string;
}
