import { AnimatePresence, motion } from "motion/react";
import { X, MapPin, Clock, Package, Gauge } from "lucide-react";
import { MiniVan } from "@/components/MiniVan";
import type { DemoScenario, OptimizeResponse, Vehicle, VehicleRoute } from "@/types/api";

const ease = [0.16, 1, 0.3, 1] as const;
const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export function etaFor(route: VehicleRoute, i: number) {
  const mins = Math.round(((i + 1) / route.stopIds.length) * route.durationMin);
  const t = 9 * 60 + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function VehicleDrawer({
  open, onClose, vehicle, route, scenario, result, onHoverStop,
}: {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  route: VehicleRoute | null;
  scenario: DemoScenario;
  result: OptimizeResponse | null;
  onHoverStop?: (id: string | null) => void;
}) {
  const stopById = new Map(scenario.stops.map((s) => [s.id, s]));
  const util = vehicle && route ? (route.load / vehicle.capacity) * 100 : 0;

  return (
    <AnimatePresence>
      {open && vehicle && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/15"
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-card shadow-lift"
            role="dialog"
            aria-label={`${vehicle.name} route details`}
          >
            <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
              <div className="flex items-center gap-4">
                <MiniVan color={vehicle.color} className="h-11 w-[88px]" />
                <div>
                  <h2 className="font-display text-[22px] font-medium leading-none tracking-[-0.02em]">{vehicle.name}</h2>
                  <p className="mt-2 text-[12.5px] text-muted-foreground">{vehicle.plate} · {vehicle.capacity} kg capacity</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-b px-6 py-5">
              <Field icon={Package} label="Load assigned" value={route ? `${route.load} / ${vehicle.capacity} kg` : "—"} />
              <Field icon={MapPin} label="Assigned stops" value={route ? `${route.stopIds.length}` : "—"} />
              <Field icon={Gauge} label="Route distance" value={route ? `${fmt(route.distanceKm)} km` : "—"} />
              <Field icon={Clock} label="Route duration" value={route ? `${fmt(route.durationMin, 0)} min` : "—"} />
            </div>

            <div className="border-b px-6 py-4">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-muted-foreground">Capacity utilization</span>
                <span className="tabular-nums">{fmt(util, 0)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: vehicle.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(util, 100)}%` }}
                  transition={{ duration: 0.7, ease }}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {!route && (
                <p className="px-3 py-6 text-[13px] text-muted-foreground">
                  No route assigned yet. Run Optimize Routes on the dispatch board to build a demo plan.
                </p>
              )}
              {route?.stopIds.map((id, i) => {
                const s = stopById.get(id)!;
                return (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.025, 0.3), duration: 0.35, ease }}
                    onMouseEnter={() => onHoverStop?.(id)}
                    onMouseLeave={() => onHoverStop?.(null)}
                    className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-sm px-3 py-2.5 transition-colors hover:bg-secondary"
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-primary-foreground tabular-nums"
                      style={{ background: vehicle.color }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px]">{s.name}</p>
                      <p className="text-[11.5px] tabular-nums text-muted-foreground">{s.demand} kg · {s.serviceMin} min service</p>
                    </div>
                    <span className="text-[12.5px] tabular-nums text-muted-foreground">ETA {etaFor(route, i)}</span>
                  </motion.div>
                );
              })}
            </div>

            {route && (
              <div className="border-t px-6 py-4">
                <p className="text-[12px] font-medium">Why this route?</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Stops were grouped by geographic cluster around {scenario.depot.name}, kept inside {vehicle.name}&apos;s{" "}
                  {vehicle.capacity} kg limit, then the sequence was improved for{" "}
                  {result?.mode === "distance" ? "shortest distance" : result?.mode === "time" ? "fastest time" : "a balanced load"}.
                  Demo values from the mock optimizer.
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 text-[16px] font-medium tabular-nums">{value}</p>
    </div>
  );
}
