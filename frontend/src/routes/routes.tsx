import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Crosshair, Layers } from "lucide-react";
import { AppShell, ShellHeader, StatusPills } from "@/components/AppShell";
import { VehicleDrawer, etaFor } from "@/components/VehicleDrawer";
import { dispatchActions, useDispatchState } from "@/services/dispatchStore";

const RouteMap = lazy(() => import("@/components/RouteMap"));
const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const ease = [0.16, 1, 0.3, 1] as const;

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Route Map — QUANTUMROUTE" },
      { name: "description", content: "Full-screen route network for the Vijayawada and Amaravati demo fleet." },
      { property: "og:title", content: "Route Map — QUANTUMROUTE" },
      { property: "og:description", content: "Inspect every optimized van route, stop sequence and delivery pin on one map." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoutesView,
});

function RoutesView() {
  const { scenario, result, loading, selected } = useDispatchState();
  useEffect(() => { if (!result && !loading) void dispatchActions.run(); }, [result, loading]);
  const [hoverStop, setHoverStop] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const onSelect = useCallback((id: string | null) => { if (id) dispatchActions.select(id); }, []);

  const vehicle = scenario.vehicles.find((v) => v.id === selected)!;
  const route = result?.routes.find((r) => r.vehicleId === selected) ?? null;
  const stopById = useMemo(() => new Map(scenario.stops.map((s) => [s.id, s])), [scenario]);
  const listed = (route ? route.stopIds.map((id) => stopById.get(id)!) : scenario.stops)
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <AppShell>
      <ShellHeader
        title="Route Map"
        subtitle={`${scenario.city} · ${scenario.stops.length} delivery stops · Demo Scenario`}
        right={<StatusPills loading={loading} done={!!result} />}
      />
      <div className="flex min-h-0 flex-1 gap-4 px-8 pb-8">
        <motion.section
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}
          className="relative min-w-0 flex-1 overflow-hidden rounded-md bg-card shadow-soft"
        >
          <ClientOnly fallback={<div className="h-full w-full bg-muted" />}>
            <Suspense fallback={<div className="h-full w-full bg-muted" />}>
              <RouteMap
                scenario={scenario}
                routes={result?.routes ?? null}
                selected={selected}
                onSelect={onSelect}
                highlightStopId={hoverStop}
                focusSelected={focus}
              />
            </Suspense>
          </ClientOnly>
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-md bg-card/95 p-1 shadow-soft backdrop-blur">
              {scenario.vehicles.map((v) => {
                const on = v.id === selected;
                return (
                  <button
                    key={v.id}
                    onClick={() => dispatchActions.select(v.id)}
                    className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[12px] transition-colors ${on ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
                    {v.name}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setFocus((f) => !f)}
              className="pointer-events-auto flex w-fit items-center gap-1.5 rounded-md bg-card/95 px-2.5 py-1.5 text-[12px] shadow-soft backdrop-blur transition-colors hover:bg-secondary"
            >
              {focus ? <Crosshair className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              {focus ? "Focus selected van" : "Whole network"}
            </button>
          </div>
        </motion.section>

        <aside className="flex w-[340px] shrink-0 flex-col rounded-md bg-card shadow-soft">
          <div className="space-y-3 p-5 pb-3">
            <div>
              <p className="text-[12px] text-muted-foreground">{vehicle.plate}</p>
              <h2 className="mt-1 text-[17px] font-medium">{vehicle.name} stops</h2>
              <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
                {route ? `${route.stopIds.length} stops · ${fmt(route.distanceKm)} km · ${fmt(route.durationMin, 0)} min` : "Run an optimization to see the sequence"}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-sm bg-secondary px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stops"
                className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={() => setDrawer(true)}
              className="h-10 w-full rounded-sm bg-primary text-[13.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open route details
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {listed.map((s, i) => (
              <div
                key={s.id}
                onMouseEnter={() => setHoverStop(s.id)}
                onMouseLeave={() => setHoverStop(null)}
                className="grid grid-cols-[26px_1fr_auto] items-center gap-3 rounded-sm px-3 py-2.5 transition-colors hover:bg-secondary"
              >
                <span className="text-[12.5px] tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px]">{s.name}</p>
                  <p className="text-[11.5px] tabular-nums text-muted-foreground">{s.demand} kg</p>
                </div>
                <span className="text-[12px] tabular-nums text-muted-foreground">{route ? `ETA ${etaFor(route, i)}` : `${s.serviceMin} min`}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <VehicleDrawer
        open={drawer} onClose={() => setDrawer(false)}
        vehicle={vehicle} route={route} scenario={scenario} result={result}
        onHoverStop={setHoverStop}
      />
    </AppShell>
  );
}
