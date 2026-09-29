import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Atom, AlertTriangle, Cpu, GitBranch, RotateCcw } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, ShellHeader } from "@/components/AppShell";
import { Slider } from "@/components/ui/slider";
import { getDemoScenario } from "@/services/demoData";
import { quantumDemoMock, runLiveQuantumDemo } from "@/services/mockApi";
import type { QuantumDemoResponse } from "@/types/api";

export const Route = createFileRoute("/quantum")({
  head: () => ({
    meta: [
      { title: "Quantum Lab — QUANTUMROUTE" },
      { name: "description", content: "Educational Qiskit + QAOA demonstration on a 4-stop routing subproblem. Demo values only." },
      { property: "og:title", content: "Quantum Lab — QUANTUMROUTE" },
      { property: "og:description", content: "Explore how QAOA encodes a small routing problem. Illustrative demo, not experimental results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuantumLab,
});

const SUB = ["S01", "S02", "S03", "S04"];
const SHOTS = 1024;
const ease = [0.16, 1, 0.3, 1] as const;
const DEFAULT_G = [0.8, 1.2];
const DEFAULT_B = [0.4, 0.3];

function QuantumLab() {
  const scenario = useMemo(() => getDemoScenario(), []);
  const [gamma, setGamma] = useState(DEFAULT_G);
  const [beta, setBeta] = useState(DEFAULT_B);
  const [isRunningLive, setIsRunningLive] = useState(false);
  const [liveResult, setLiveResult] = useState<QuantumDemoResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const localRes = useMemo(
    () => quantumDemoMock({ stopIds: SUB, p: 2, gamma, beta, shots: SHOTS }, scenario.stops, scenario.depot.location),
    [gamma, beta, scenario],
  );

  const res = liveResult || localRes;
  const name = (id: string) => scenario.stops.find((s) => s.id === id)?.name ?? id;
  const best = res.distribution[0]?.bitstring;

  const handleRunLive = async () => {
    setIsRunningLive(true);
    setErrorMsg(null);
    try {
      const live = await runLiveQuantumDemo({
        stopIds: SUB,
        p: 1,
        gamma,
        beta,
        shots: SHOTS,
      });
      setLiveResult(live);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to execute QAOA on Qiskit Aer backend.");
    } finally {
      setIsRunningLive(false);
    }
  };

  return (
    <AppShell>
      <ShellHeader
        title="Quantum Routing Lab"
        subtitle="Qiskit + QAOA on a 4-stop routing subproblem · separate from the live classical optimizer"
        right={
          <>
            <div className="flex items-center gap-2 rounded-md bg-card px-3.5 py-2.5 text-[13px] shadow-soft">
              <span className={`h-2 w-2 rounded-full ${liveResult ? "bg-emerald-500" : "bg-accent-magenta"}`} />
              {liveResult ? "Qiskit Aer Simulator (Live)" : "Simulated Demo"}
            </div>
            <button
              onClick={handleRunLive}
              disabled={isRunningLive}
              className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Cpu className="h-4 w-4" />
              {isRunningLive ? "Simulating on Aer…" : "Run on Qiskit Aer (Live)"}
            </button>
          </>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-8 pb-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Problem scale" value={`1 depot + ${SUB.length} stops`} />
          <Kpi label="Qubit footprint" value="16 qubits (4×4)" />
          <Kpi label="Ansatz depth" value="p = 1 (Aer)" />
          <Kpi label="Sampling budget" value={`${SHOTS.toLocaleString()} shots`} />
        </div>

        {errorMsg && (
          <div className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 p-4 text-[13px] text-destructive">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        <div className="flex gap-3 rounded-md bg-card p-5 shadow-soft">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-warning" />
          <div className="text-[13px] leading-relaxed text-muted-foreground space-y-1">
            <p>
              <strong>16-Qubit Formulation:</strong> The 4 customer stops are mapped to a 4×4 binary variable grid:{" "}
              <code className="text-[12px] bg-secondary px-1 py-0.5 rounded">x(i, t) = 1</code> if stop <em>i</em> is visited at step <em>t</em>.
              Because the central depot is fixed at the start and end of the tour,{" "}
              <strong className="text-foreground">4 stops × 4 positions = 16 binary variables / qubits</strong>.
            </p>
            <p className="text-[12px]">
              {liveResult
                ? "Showing real measured output from the Qiskit Aer local quantum simulator compared against Google OR-Tools on the exact same 4-stop instance. No quantum advantage is claimed."
                : "Click 'Run on Qiskit Aer (Live)' to execute the 16-qubit QAOA circuit on the FastAPI Qiskit Aer backend and compare directly against Google OR-Tools."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: GitBranch, n: "01", t: "Routing subproblem", d: `Depot plus 4 stops — ${SUB.map(name).join(", ")} — isolated for quantum variational analysis.` },
            { icon: Cpu, n: "02", t: "16-Qubit QUBO", d: "4 stops × 4 steps = 16 qubits with one-hot constraints and quadratic distance costs." },
            { icon: Atom, n: "03", t: "QAOA on Qiskit Aer", d: "Simulates parameter optimization (COBYLA) and samples the quantum statevector into bitstring frequencies." },
          ].map((c, i) => (
            <motion.div
              key={c.t}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.45, ease }}
              className="relative overflow-hidden rounded-md bg-card p-5 shadow-soft transition-shadow hover:shadow-lift"
            >
              <div className="flex items-center justify-between">
                <c.icon className="h-[18px] w-[18px] text-accent-cyan" />
                <span className="text-[11px] tabular-nums text-muted-foreground">{c.n}</span>
              </div>
              <p className="mt-4 text-[15px] font-medium">{c.t}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{c.d}</p>
              {i < 2 && <span className="absolute right-0 top-1/2 hidden h-px w-4 bg-border md:block" />}
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}
            className="rounded-md bg-card p-5 shadow-soft"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-medium">Variational parameters</h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground">Adjust angles to reshape the state distribution</p>
              </div>
              <button
                onClick={() => { setGamma(DEFAULT_G); setBeta(DEFAULT_B); setLiveResult(null); }}
                className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>
            <div className="mt-5 space-y-6">
              {[0, 1].map((l) => (
                <div key={l} className="space-y-3">
                  <p className="text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Layer {l + 1}</p>
                  <Param label="γ (cost)" value={gamma[l] ?? 0} max={Math.PI} onChange={(v) => { setLiveResult(null); setGamma((g) => g.map((x, i) => (i === l ? v : x))); }} />
                  <Param label="β (mixer)" value={beta[l] ?? 0} max={Math.PI / 2} onChange={(v) => { setLiveResult(null); setBeta((b) => b.map((x, i) => (i === l ? v : x))); }} />
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.45, ease }}
            className="rounded-md bg-card p-5 shadow-soft"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-medium">Sampled state distribution</h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {liveResult ? "Qiskit Aer Simulator measured distribution" : "Simulated distribution"} · 16 qubits
                </p>
              </div>
              <span className="rounded-sm bg-secondary px-2.5 py-1.5 text-[11.5px] text-muted-foreground">{SHOTS.toLocaleString()} shots</span>
            </div>
            <div className="mt-5 h-[260px]">
              <ResponsiveContainer>
                <BarChart data={res.distribution.map((d) => ({ ...d, p: +(d.probability * 100).toFixed(2) }))} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <XAxis dataKey="bitstring" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} angle={-35} textAnchor="end" height={54} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="%" tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)" }}
                    contentStyle={{ borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, boxShadow: "none" }}
                    formatter={(v: number) => [`${v}%`, "Probability"]}
                  />
                  <Bar dataKey="p" radius={[3, 3, 0, 0]}>
                    {res.distribution.map((d) => (
                      <Cell key={d.bitstring} fill={d.bitstring === best ? "var(--accent-magenta)" : "var(--border)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Compare title="QAOA (Qiskit Aer)" order={res.bestOrder.map(name)} cost={res.quantumCost} tone="var(--accent-magenta)" isLive={!!liveResult} />
              <Compare title="Google OR-Tools" order={res.classicalOrder.map(name)} cost={res.classicalCost} tone="var(--accent-cyan)" isLive={!!liveResult} />
            </div>
            <p className="mt-4 text-[11.5px] text-muted-foreground">
              {res.note || "No speed or quality advantage is claimed. Both figures are measured on the same 4-stop subproblem."}
            </p>
          </motion.section>
        </div>
      </div>
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

function Param({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <Slider value={[value]} min={0} max={max} step={0.01} onValueChange={([v]) => onChange(v ?? 0)} />
    </div>
  );
}

function Compare({ title, order, cost, tone }: { title: string; order: string[]; cost: number; tone: string }) {
  return (
    <div className="rounded-sm border p-4">
      <p className="flex items-center gap-2 text-[12px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
        {title}
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">Depot → {order.join(" → ")} → Depot</p>
      <p className="mt-2 text-[18px] font-medium tabular-nums">
        {cost.toFixed(2)} km <span className="text-[11px] font-normal text-muted-foreground">illustrative</span>
      </p>
    </div>
  );
}
