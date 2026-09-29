import type { DemoScenario, Stop } from "@/types/api";

const NAMES = [
  "Benz Circle", "Governorpet", "Labbipet", "Patamata", "Gunadala", "Moghalrajpuram",
  "Auto Nagar", "Kanuru", "Poranki", "Tadigadapa", "Bhavanipuram", "Vidyadharapuram",
  "Tadepalli", "Undavalli", "Mangalagiri", "Thullur", "Rayapudi", "Velagapudi",
  "Nidamarru", "Krishnayapalem", "Penamaluru", "Enikepadu", "Gollapudi", "Ibrahimpatnam",
];

// Deterministic jitter (no randomness at module scope).
function jitter(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

const ANCHORS: [number, number][] = [
  [80.648, 16.5], [80.63, 16.515], [80.645, 16.495], [80.67, 16.495], [80.665, 16.52], [80.655, 16.51],
  [80.68, 16.49], [80.695, 16.48], [80.715, 16.475], [80.73, 16.465], [80.59, 16.53], [80.6, 16.52],
  [80.605, 16.48], [80.585, 16.49], [80.565, 16.43], [80.46, 16.53], [80.52, 16.53], [80.515, 16.505],
  [80.54, 16.46], [80.505, 16.49], [80.745, 16.44], [80.72, 16.51], [80.57, 16.56], [80.52, 16.6],
];

export function getDemoScenario(): DemoScenario {
  const stops: Stop[] = ANCHORS.map(([lng, lat], i) => ({
    id: `S${String(i + 1).padStart(2, "0")}`,
    name: NAMES[i] ?? `Stop ${i + 1}`,
    location: [lng + jitter(i, 1) * 0.006, lat + jitter(i, 2) * 0.006],
    // Package weight in kg.
    demand: 25 + Math.round((jitter(i, 3) + 0.5) * 85),
    serviceMin: 4 + Math.round((jitter(i, 4) + 0.5) * 6),
  }));
  return {
    city: "Vijayawada / Amaravati",
    depot: { id: "D0", name: "Vijayawada Central Hub", location: [80.6385, 16.5062] },
    stops,
    vehicles: [
      { id: "V1", name: "Van 1", plate: "AP16 TX 4021", capacity: 500, color: "var(--route-1)" },
      { id: "V2", name: "Van 2", plate: "AP16 TX 4087", capacity: 550, color: "var(--route-2)" },
      { id: "V3", name: "Van 3", plate: "AP39 LG 1190", capacity: 480, color: "var(--route-3)" },
      { id: "V4", name: "Van 4", plate: "AP39 LG 1205", capacity: 600, color: "var(--route-4)" },
    ],
  };
}
