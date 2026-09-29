import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Loader2, ArrowUpRight, Package, ArrowRight, Check, AlertTriangle, Activity } from "lucide-react";
import { AppShell, ShellHeader, StatusPills } from "@/components/AppShell";
import { MiniVan } from "@/components/MiniVan";
import { VehicleDrawer, etaFor } from "@/components/VehicleDrawer";
import { dispatchActions, useDispatchState, OPTIMIZE_STEPS } from "@/services/dispatchStore";
import type { OptimizationMode, VehicleRoute } from "@/types/api";

const RouteMap = lazy(() => import("@/components/RouteMap"));
const VanScene = lazy(() => import("@/components/VanScene"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QUANTUMROUTE — Delivery Control Center" },
      { name: "description", content: "Plan, optimize and dispatch multi-van delivery routes across Vijayawada and Amaravati." },
      { property: "og:title", content: "QUANTUMROUTE — Delivery Control Center" },
      { property: "og:description", content: "Fleet dispatch, optimized routes and before/after efficiency on one screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const STEPS = OPTIMIZE_STEPS;
const MODES: { v: OptimizationMode; l: string }[] = [
  { v: "distance", l: "Shortest Distance" }, { v: "time", l: "Fastest Time" }, { v: "balanced", l: "Balanced" },
];
const ease = [0.16, 1, 0.3, 1] as const;

function Dashboard() {
  const { scenario, mode, result, loading, step, selected, sourceMode, error } = useDispatchState();
  const [hoverStop, setHoverStop] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const onSelectRoute = useCallback((id: string | null) => { if (id) dispatchActions.select(id); }, []);
  const run = dispatchActions.run;
  const setMode = dispatchActions.setMode;

  const vehicle = scenario.vehicles.find((v) => v.id === selected)!;
  const route: VehicleRoute | null = result?.routes.find((r) => r.vehicleId === selected) ?? null;
  const status = loading
    ? "Optimizing…"
    : result
    ? result.backend?.includes("FastAPI") || result.solver_comparison
      ? "Live: OR-Tools + OSRM"
      : "Demo Optimization"
    : "Ready to Optimize";
  const stopById = useMemo(() => new Map(scenario.stops.map((s) => [s.id, s])), [scenario]);
  const listStops = route ? route.stopIds.map((id) => stopById.get(id)!) : scenario.stops;
  const stopVehicle = useMemo(() => {
    const m = new Map<string, string>();
    result?.routes.forEach((r) => r.stopIds.forEach((id) => m.set(id, r.vehicleId)));
    return m;
  }, [result]);

  return (
    <AppShell>
      <ShellHeader
        title="Delivery Control Center"
        subtitle={`${scenario.city} · ${sourceMode === "live" ? "Live Engine (OR-Tools CVRP + OSRM)" : "Demo Mode (Mock)"}`}
        right={
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${sourceMode === "live" ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground border"}`}>
              <Activity className="h-3 w-3" />
              {sourceMode === "live" ? "LIVE ENGINE" : "DEMO MOCK"}
            </span>
            <StatusPills loading={loading} done={!!result} />
          </div>
        }
      />

      {error && (
        <div className="mx-8 mb-4 flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 p-4 text-[13px] text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Live Optimization Error (No Silent Fallback)</p>
              <p className="mt-0.5 text-destructive/90">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatchActions.setSourceMode("demo")}
              className="rounded bg-secondary px-3 py-1.5 text-foreground hover:bg-secondary/80 font-medium"
            >
              Switch to Demo Mode
            </button>
            <button
              onClick={() => dispatchActions.clearError()}
              className="px-2 text-destructive font-bold hover:opacity-75"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 overflow-y-auto px-8 pb-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Van carousel */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {scenario.vehicles.map((v, i) => {
              const r = result?.routes.find((x) => x.vehicleId === v.id);
              const on = v.id === selected;
              return (
                <motion.button
                  key={v.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: on ? 1 : 0.62, y: 0 }}
                  whileHover={{ opacity: 1, y: -2 }}
                  transition={{ delay: i * 0.04, duration: 0.4, ease }}
                  onClick={() => (on ? setDrawer(true) : dispatchActions.select(v.id))}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-md bg-card px-5 py-4 text-left shadow-soft transition-shadow hover:shadow-lift focus-visible:outline-2 focus-visible:outline-ring ${on ? "shadow-lift" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{v.name}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{v.plate}</p>
                    <p className="mt-2 whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
                      {r ? `${r.load} / ${v.capacity} kg · ${r.stopIds.length} stops` : `${v.capacity} kg · Standby`}
                    </p>
                    <span className="mt-2 block text-[11.5px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {on ? "Click for route details" : "Click to select"}
                    </span>
                  </div>
                  <MiniVan color={v.color} className="h-9 w-[64px]" />
                  {on && <motion.span layoutId="van-underline" className="absolute inset-x-5 bottom-0 h-[2px]" style={{ background: v.color }} />}
                </motion.button>
              );
            })}
          </div>

          {/* Hero stage */}
          <section className="relative min-h-[430px] flex-1">
            <div className="absolute inset-0 -mr-4">
              <ClientOnly fallback={null}>
                <Suspense fallback={null}>
                  <VanScene color={vehicle.color} />
                </Suspense>
              </ClientOnly>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={vehicle.id}
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease }}
                className="absolute bottom-0 left-0"
              >
                <p className="mb-3 text-[13px] text-foreground/80">Vehicle information · {vehicle.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip>Load {route?.load ?? 0} / {vehicle.capacity} kg</Chip>
                  <Chip>Stops {route ? route.stopIds.length : "—"}</Chip>
                  <Chip>Distance {route ? `${fmt(route.distanceKm)} km` : "—"}</Chip>
                  <Chip>Duration {route ? `${fmt(route.durationMin, 0)} min` : "—"}</Chip>
                  <Chip>{status}</Chip>
                  <button
                    onClick={() => setDrawer(true)}
                    className="rounded-sm bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
                  >
                    Route details
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          {/* Bottom operations */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Route Map" to="/routes" sub={<span className="flex items-center gap-1.5">Central Hub <ArrowRight className="h-3 w-3" /> {scenario.stops.length} stops</span>}>
              <div className="mt-4 h-[240px] overflow-hidden rounded-sm">
                <ClientOnly fallback={<div className="h-full w-full bg-muted" />}>
                  <Suspense fallback={<div className="h-full w-full bg-muted" />}>
                    <RouteMap scenario={scenario} routes={result?.routes ?? null} selected={selected} onSelect={onSelectRoute} highlightStopId={hoverStop} compact />
                  </Suspense>
                </ClientOnly>
              </div>
            </Panel>

            <Panel title="Optimization Summary" sub="Demo values · mock optimizer">
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
                <Stat label="Total distance" value={result ? `${fmt(result.optimized.distanceKm)} km` : "—"} />
                <Stat label="Travel time" value={result ? `${fmt(result.optimized.durationMin, 0)} min` : "—"} />
                <Stat label="Vehicles used" value={result ? `${result.optimized.vehiclesUsed} of ${scenario.vehicles.length}` : "—"} />
                <Stat label="Fleet capacity used" value={result ? `${fmt(result.optimized.capacityUtilization * 100, 0)}%` : "—"} />
              </div>
              <DemandBars stops={scenario.stops} colorOf={(id) => {
                const vid = stopVehicle.get(id);
                return vid ? scenario.vehicles.find((v) => v.id === vid)!.color : undefined;
              }} selected={route ? selected : null} stopVehicle={stopVehicle} />
            </Panel>

            <Panel title="Route Efficiency" sub="Baseline vs optimized">
              <div className="mt-5 space-y-6">
                <Compare label="Distance saved" unit="km" before={result?.baseline.distanceKm} after={result?.optimized.distanceKm} />
                <Compare label="Travel time reduced" unit="min" before={result?.baseline.durationMin} after={result?.optimized.durationMin} d={0} />
              </div>
            </Panel>
          </div>
        </div>

        {/* Route planning panel */}
        <aside className="relative z-10 flex w-[380px] shrink-0 flex-col rounded-md bg-card shadow-soft">
          <div className="space-y-4 p-6 pb-4">
            <div>
              <p className="text-[12px] text-muted-foreground">{vehicle.name} · {vehicle.plate}</p>
              <h2 className="mt-1 text-[17px] font-medium">Route Planning</h2>
              <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
                {scenario.stops.length} stops · {scenario.vehicles.length} vans · {scenario.vehicles.reduce((a, v) => a + v.capacity, 0).toLocaleString()} kg fleet capacity
              </p>
            </div>

            {/* Live Engine vs Demo Mode Toggle */}
            <div className="flex items-center rounded-sm bg-secondary p-1 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => dispatchActions.setSourceMode("live")}
                className={`flex-1 rounded-[3px] py-1.5 transition-colors ${sourceMode === "live" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
              >
                ⚡ Live OR-Tools
              </button>
              <button
                type="button"
                onClick={() => dispatchActions.setSourceMode("demo")}
                className={`flex-1 rounded-[3px] py-1.5 transition-colors ${sourceMode === "demo" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
              >
                🧪 Offline Demo
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-sm bg-secondary p-1" role="radiogroup" aria-label="Optimization mode">
              {MODES.map((m) => (
                <button
                  key={m.v}
                  role="radio"
                  aria-checked={mode === m.v}
                  onClick={() => setMode(m.v)}
                  className={`relative rounded-[3px] px-1 py-2 text-[11px] whitespace-nowrap font-medium transition-colors ${mode === m.v ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {mode === m.v && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-[3px] bg-card shadow-soft" transition={{ duration: 0.3, ease }} />}
                  <span className="relative">{m.l}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={run}
                disabled={loading}
                className="flex h-11 items-center justify-center gap-2 rounded-sm bg-primary text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {loading ? "Optimizing…" : "Optimize Routes"}
              </motion.button>
              <button
                onClick={() => dispatchActions.clear()}
                disabled={!result || loading}
                className="flex h-11 items-center justify-center gap-2 rounded-sm border text-[14px] font-medium transition-colors hover:bg-secondary disabled:text-muted-foreground disabled:hover:bg-transparent"
              >
                <Trash2 className="h-4 w-4" /> Clear Plan
              </button>
            </div>
            <AnimatePresence initial={false}>
              {loading && (
                <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="space-y-1.5 overflow-hidden">
                  {STEPS.map((s, i) => (
                    <li key={s} className={`flex items-center gap-2 text-[12px] ${i <= step ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {i < step ? <Check className="h-3.5 w-3.5 text-success" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5" />}
                      {s.toUpperCase()}
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-[44px_1fr_auto] gap-x-3 border-t px-6 pb-2 pt-4 text-[12px] text-muted-foreground">
            <span>Stop</span><span>{route ? `${vehicle.name} sequence` : "Customer"}</span><span>Status</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {listStops.map((s, i) => {
              const vid = stopVehicle.get(s.id);
              const vc = vid ? scenario.vehicles.find((v) => v.id === vid)!.color : undefined;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.012, 0.25), duration: 0.3 }}
                  onMouseEnter={() => setHoverStop(s.id)}
                  onMouseLeave={() => setHoverStop(null)}
                  className="grid grid-cols-[44px_1fr_auto] items-center gap-x-3 rounded-sm px-3 py-2.5 transition-colors hover:bg-secondary"
                >
                  <span className="flex items-center gap-1.5 text-[13px] tabular-nums">
                    <Package className="h-3.5 w-3.5" style={vc ? { color: vc } : undefined} />
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px]">{s.name}</p>
                    <p className="text-[11.5px] tabular-nums text-muted-foreground">
                      {s.demand} kg{route ? ` · ETA ${etaFor(route, i)}` : ` · ${s.serviceMin} min service`}
                    </p>
                  </div>
                  <span className="text-[12.5px]">{vid ? "Assigned" : "Pending"}</span>
                </motion.div>
              );
            })}
          </div>
          {result && (
            <div className="border-t px-6 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">
                {result.backend?.includes("FastAPI")
                  ? "⚡ Google OR-Tools CVRP + OSRM Road Geometry"
                  : "🧪 Frontend Mock Optimization"}
              </p>
              <p className="mt-0.5">
                Solved in {result.computeMs} ms · Mode: {result.mode || mode} · {result.routes.filter(r => r.stopIds.length > 0).length} active vans
              </p>
              {result.solver_comparison && (
                <p className="mt-0.5 text-primary font-mono text-[10.5px]">
                  {result.solver_comparison}
                </p>
              )}
            </div>
          )}
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


function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-sm bg-card px-3.5 py-2 text-[14px] tabular-nums shadow-soft">{children}</span>;
}

function Panel({ title, sub, children, to }: { title: string; sub: React.ReactNode; children: React.ReactNode; to?: "/routes" | "/fleet" | "/quantum" }) {
  const arrow = <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease }}
      className="group rounded-md bg-card p-5 shadow-soft transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-medium">{title}</h3>
          <div className="mt-1 text-[13px] text-muted-foreground">{sub}</div>
        </div>
        {to ? <Link to={to} aria-label={`Open ${title}`} className="rounded-sm p-0.5">{arrow}</Link> : arrow}
      </div>
      {children}
    </motion.section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <motion.p key={value} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }} className="mt-1 text-[16px] font-medium tabular-nums">
        {value}
      </motion.p>
    </div>
  );
}

function DemandBars({ stops, colorOf, selected, stopVehicle }: {
  stops: { id: string; demand: number }[]; colorOf: (id: string) => string | undefined; selected: string | null; stopVehicle: Map<string, string>;
}) {
  const max = Math.max(...stops.map((s) => s.demand));
  return (
    <div className="mt-5">
      <div className="flex h-16 items-end gap-[3px]">
        {stops.map((s, i) => {
          const c = colorOf(s.id);
          const dim = selected && stopVehicle.get(s.id) !== selected;
          return (
            <motion.span
              key={s.id}
              className="flex-1 rounded-[1px]"
              initial={{ height: 0 }}
              animate={{ height: `${(s.demand / max) * 100}%`, opacity: dim ? 0.25 : 1 }}
              transition={{ delay: i * 0.012, duration: 0.5, ease }}
              style={{ background: c ?? "var(--muted-foreground)", opacity: c ? 1 : 0.3 }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Package weight per stop, colored by assigned van</p>
    </div>
  );
}

function Compare({ label, unit, before, after, d = 1 }: { label: string; unit: string; before: number | undefined; after: number | undefined; d?: number }) {
  const has = before != null && after != null;
  const pct = has && before ? ((before - after) / before) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="text-[16px] font-medium tabular-nums">
          {has ? `${fmt(Math.max(0, before - after), d)} ${unit}` : "—"}
          {has && <span className="ml-2 text-[12px] text-accent-magenta">−{fmt(Math.abs(pct), 1)}%</span>}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <Row caption="Baseline" value={has ? `${fmt(before, d)} ${unit}` : "—"} pct={has ? 100 : 0} tone="bg-muted-foreground/30" />
        <Row caption="Optimized" value={has ? `${fmt(after, d)} ${unit}` : "—"} pct={has && before ? (after / before) * 100 : 0} tone="bg-primary" />
      </div>
    </div>
  );
}

function Row({ caption, value, pct, tone }: { caption: string; value: string; pct: number; tone: string }) {
  return (
    <div className="grid grid-cols-[68px_1fr_72px] items-center gap-3 text-[11.5px]">
      <span className="text-muted-foreground">{caption}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div className={`h-full rounded-full ${tone}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease }} />
      </div>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}
