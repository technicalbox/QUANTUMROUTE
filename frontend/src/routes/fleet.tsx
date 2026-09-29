import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { AppShell, ShellHeader, StatusPills } from "@/components/AppShell";
import { MiniVan } from "@/components/MiniVan";
import { VehicleDrawer } from "@/components/VehicleDrawer";
import { dispatchActions, useDispatchState } from "@/services/dispatchStore";

const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const ease = [0.16, 1, 0.3, 1] as const;

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet — QUANTUMROUTE" },
      { name: "description", content: "Four demo delivery vans with capacity, assigned stops, distance and duration." },
      { property: "og:title", content: "Fleet — QUANTUMROUTE" },
      { property: "og:description", content: "Inspect each van's load, plate, assigned stops and optimized route summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FleetView,
});

function FleetView() {
  const { scenario, result, loading, selected } = useDispatchState();
  useEffect(() => { if (!result && !loading) void dispatchActions.run(); }, [result, loading]);
  const [drawer, setDrawer] = useState(false);
  const vehicle = scenario.vehicles.find((v) => v.id === selected)!;
  const route = result?.routes.find((r) => r.vehicleId === selected) ?? null;
  const fleetCapacity = scenario.vehicles.reduce((a, v) => a + v.capacity, 0);
  const assigned = result?.routes.reduce((a, r) => a + r.load, 0) ?? 0;

  const open = (id: string) => { dispatchActions.select(id); setDrawer(true); };

  return (
    <AppShell>
      <ShellHeader
        title="Fleet"
        subtitle={`${scenario.vehicles.length} delivery vans · ${fleetCapacity.toLocaleString()} kg total capacity · Demo Scenario`}
        right={<StatusPills loading={loading} done={!!result} />}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-8 pb-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Vans in fleet" value={`${scenario.vehicles.length}`} />
          <Kpi label="Vans used" value={result ? `${result.optimized.vehiclesUsed} of ${scenario.vehicles.length}` : "—"} />
          <Kpi label="Load assigned" value={result ? `${assigned.toLocaleString()} / ${fleetCapacity.toLocaleString()} kg` : "—"} />
          <Kpi label="Fleet capacity used" value={result ? `${fmt(result.optimized.capacityUtilization * 100, 0)}%` : "—"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {scenario.vehicles.map((v, i) => {
            const r = result?.routes.find((x) => x.vehicleId === v.id);
            const util = r ? (r.load / v.capacity) * 100 : 0;
            return (
              <motion.button
                key={v.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
                transition={{ delay: i * 0.05, duration: 0.45, ease }}
                onClick={() => open(v.id)}
                className="group rounded-md bg-card p-6 text-left shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <MiniVan color={v.color} className="h-12 w-[96px]" />
                    <div>
                      <p className="font-display text-[20px] font-medium leading-none tracking-[-0.02em]">{v.name}</p>
                      <p className="mt-2 text-[12.5px] text-muted-foreground">{v.plate}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>

                <div className="mt-6 grid grid-cols-4 gap-4">
                  <Cell label="Load" value={r ? `${r.load} / ${v.capacity} kg` : `0 / ${v.capacity} kg`} />
                  <Cell label="Stops" value={r ? `${r.stopIds.length}` : "—"} />
                  <Cell label="Distance" value={r ? `${fmt(r.distanceKm)} km` : "—"} />
                  <Cell label="Duration" value={r ? `${fmt(r.durationMin, 0)} min` : "—"} />
                </div>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: v.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(util, 100)}%` }}
                    transition={{ duration: 0.7, ease }}
                  />
                </div>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {r ? `${fmt(util, 0)}% of payload capacity · Demo Optimization` : "Standby · Ready to Optimize"}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <VehicleDrawer
        open={drawer} onClose={() => setDrawer(false)}
        vehicle={vehicle} route={route} scenario={scenario} result={result}
      />
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card p-5 shadow-soft">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[20px] font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[14px] font-medium tabular-nums">{value}</p>
    </div>
  );
}
