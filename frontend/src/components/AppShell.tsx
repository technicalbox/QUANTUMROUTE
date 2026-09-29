import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Truck, Map as MapIcon, Atom, Route as RouteIcon } from "lucide-react";

const item =
  "group relative flex h-10 w-10 items-center justify-center rounded-md bg-card text-muted-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-lift";
const active = { className: "!text-foreground ring-1 ring-accent-magenta" };

function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[52px] z-50 whitespace-nowrap rounded-sm bg-primary px-2 py-1 text-[11px] text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
      {label}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <nav className="flex w-[72px] shrink-0 flex-col items-center gap-3 py-6">
        <Link to="/" className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-label="QUANTUMROUTE">
          <RouteIcon className="h-5 w-5" />
        </Link>
        <Link to="/" className={item} activeOptions={{ exact: true }} activeProps={active} aria-label="Dispatch">
          <LayoutDashboard className="h-[18px] w-[18px]" /><Tip label="Dispatch" />
        </Link>
        <span className="h-6 w-px bg-border" />
        <Link to="/routes" className={item} activeProps={active} aria-label="Routes">
          <MapIcon className="h-[18px] w-[18px]" /><Tip label="Route Map" />
        </Link>
        <Link to="/fleet" className={item} activeProps={active} aria-label="Fleet">
          <Truck className="h-[18px] w-[18px]" /><Tip label="Fleet" />
        </Link>
        <span className="h-6 w-px bg-border" />
        <Link to="/quantum" className={item} activeProps={active} aria-label="Quantum Lab">
          <Atom className="h-[18px] w-[18px]" /><Tip label="Quantum Lab" />
        </Link>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function ShellHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-6 px-8 pb-5 pt-7">
      <div>
        <h1 className="font-display text-[34px] font-medium leading-none tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-2.5 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}

export function StatusPills({ loading, done }: { loading: boolean; done: boolean }) {
  const status = loading ? "Optimizing…" : done ? "Demo Optimization" : "Ready to Optimize";
  return (
    <>
      <div className="flex items-center gap-2 rounded-md bg-card px-3.5 py-2.5 text-[13px] shadow-soft">
        <span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-warning" : done ? "bg-success" : "bg-muted-foreground"}`} />
        {status}
      </div>
      <div className="rounded-md bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground shadow-soft">Mock API</div>
    </>
  );
}
