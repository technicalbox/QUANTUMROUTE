import { useSyncExternalStore } from "react";
import { getDemoScenario } from "@/services/demoData";
import { optimize } from "@/services/mockApi";
import type { DemoScenario, OptimizationMode, OptimizeResponse } from "@/types/api";

/**
 * Tiny shared dispatch state so every view (Dispatch, Routes, Fleet)
 * reads the same demo scenario and the same mock optimization result.
 */
export interface DispatchState {
  scenario: DemoScenario;
  mode: OptimizationMode;
  sourceMode: "live" | "demo";
  result: OptimizeResponse | null;
  error: string | null;
  loading: boolean;
  step: number;
  selected: string;
}

export const OPTIMIZE_STEPS = [
  "Validating input",
  "Calculating road data",
  "Optimizing fleet",
  "Generating routes",
];

const scenario = getDemoScenario();

let state: DispatchState = {
  scenario,
  mode: "balanced",
  sourceMode: "live",
  result: null,
  error: null,
  loading: false,
  step: 0,
  selected: scenario.vehicles[0]!.id,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function set(patch: Partial<DispatchState>) {
  state = { ...state, ...patch };
  emit();
}

export const dispatchActions = {
  setMode: (mode: OptimizationMode) => set({ mode }),
  setSourceMode: (sourceMode: "live" | "demo") => set({ sourceMode, error: null }),
  select: (selected: string) => set({ selected }),
  clear: () => set({ result: null, error: null }),
  clearError: () => set({ error: null }),
  loadBackendDemo: async () => {
    try {
      set({ loading: true, error: null });
      const { fetchBackendDemo } = await import("@/services/mockApi");
      const backendScenario = await fetchBackendDemo();
      set({
        scenario: backendScenario,
        result: null,
        selected: backendScenario.vehicles[0]?.id || state.selected,
      });
    } catch (err: any) {
      set({ error: `Failed to load backend demo: ${err.message}` });
    } finally {
      set({ loading: false });
    }
  },
  run: async () => {
    if (state.loading) return;
    set({ loading: true, step: 0, error: null });
    const timer = setInterval(
      () => set({ step: Math.min(state.step + 1, OPTIMIZE_STEPS.length - 1) }),
      230,
    );
    try {
      const isLive = state.sourceMode === "live";
      const result = await optimize(
        {
          depot: state.scenario.depot,
          stops: state.scenario.stops,
          vehicles: state.scenario.vehicles,
          mode: state.mode,
        },
        isLive,
      );
      set({ result, error: null });
    } catch (err: any) {
      // Guardrail 2: In Live Mode, display error clearly, do not fake mock results!
      set({ error: err.message || "Optimization request failed", result: null });
    } finally {
      clearInterval(timer);
      set({ loading: false });
    }
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => state;

export function useDispatchState(): DispatchState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
