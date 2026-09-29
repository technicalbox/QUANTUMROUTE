import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

maplibregl.setWorkerUrl(workerUrl);
import type { DemoScenario, VehicleRoute } from "@/types/api";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const EASE = (t: number) => t * (2 - t);

function resolveColor(v: string) {
  const m = v.match(/var\((--[^)]+)\)/);
  if (!m) return v;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() || "#0ea5e9";
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = raw;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function RouteMap({
  scenario,
  routes,
  selected,
  onSelect,
  highlightStopId = null,
  focusSelected = false,
  compact = false,
}: {
  scenario: DemoScenario;
  routes: VehicleRoute[] | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
  highlightStopId?: string | null;
  /** Fly to the selected vehicle's route instead of keeping the whole city in view. */
  focusSelected?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const stopEls = useRef<Map<string, HTMLElement>>(new Map());
  const drawnRef = useRef<string[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Map + persistent markers: created once.
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE,
      center: scenario.depot.location,
      zoom: 10.6,
      attributionControl: { compact: true },
      dragRotate: false,
      fadeDuration: 120,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    if (!compact) map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;

    const depotEl = document.createElement("div");
    depotEl.className = "qr-depot";
    new maplibregl.Marker({ element: depotEl })
      .setLngLat(scenario.depot.location)
      .setPopup(new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
        `<strong>${scenario.depot.name}</strong><br/>Depot · start and end of every route`,
      ))
      .addTo(map);

    scenario.stops.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "qr-stop";
      el.textContent = String(i + 1);
      stopEls.current.set(s.id, el);
      new maplibregl.Marker({ element: el })
        .setLngLat(s.location)
        .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
          `<strong>${s.name}</strong><br/>${s.demand} kg · ${s.serviceMin} min service`,
        ))
        .addTo(map);
    });

    const b = new maplibregl.LngLatBounds();
    [scenario.depot.location, ...scenario.stops.map((s) => s.location)].forEach((p) => b.extend(p));
    map.once("load", () => {
      readyRef.current = true;
      map.fitBounds(b, { padding: compact ? 40 : 80, duration: 0 });
      map.resize();
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      readyRef.current = false;
      stopEls.current.clear();
      map.remove();
    };
  }, [scenario, compact]);

  // Route lines: only redrawn when the routes themselves change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      drawnRef.current.forEach((id) => {
        if (map.getLayer(`qr-${id}`)) map.removeLayer(`qr-${id}`);
        if (map.getLayer(`qr-hit-${id}`)) map.removeLayer(`qr-hit-${id}`);
        if (map.getSource(`qr-${id}`)) map.removeSource(`qr-${id}`);
      });
      drawnRef.current = [];

      routes?.forEach((r) => {
        const v = scenario.vehicles.find((x) => x.id === r.vehicleId)!;
        const color = resolveColor(v.color);
        map.addSource(`qr-${r.vehicleId}`, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r.geometry } },
        });
        map.addLayer({
          id: `qr-${r.vehicleId}`,
          type: "line",
          source: `qr-${r.vehicleId}`,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": color,
            "line-width": 3.5,
            "line-opacity": 0.9,
            "line-opacity-transition": { duration: 260, delay: 0 },
            "line-width-transition": { duration: 260, delay: 0 },
          },
        });
        map.addLayer({
          id: `qr-hit-${r.vehicleId}`,
          type: "line",
          source: `qr-${r.vehicleId}`,
          paint: { "line-color": color, "line-width": 16, "line-opacity": 0 },
        });
        map.on("click", `qr-hit-${r.vehicleId}`, () => onSelectRef.current(r.vehicleId));
        map.on("mouseenter", `qr-hit-${r.vehicleId}`, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", `qr-hit-${r.vehicleId}`, () => { map.getCanvas().style.cursor = ""; });
        drawnRef.current.push(r.vehicleId);
      });

      // color the stop pins by assigned van
      stopEls.current.forEach((el) => {
        el.style.background = "";
        el.style.borderColor = "";
        el.style.color = "";
      });
      routes?.forEach((r) => {
        const color = resolveColor(scenario.vehicles.find((x) => x.id === r.vehicleId)!.color);
        r.stopIds.forEach((id) => {
          const el = stopEls.current.get(id);
          if (el) { el.style.background = color; el.style.borderColor = color; el.style.color = "white"; }
        });
      });
    };
    if (readyRef.current) draw();
    else map.once("load", draw);
  }, [routes, scenario]);

  // Selection: only tweak paint + camera, never rebuild the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    drawnRef.current.forEach((id) => {
      const dim = selected != null && selected !== id;
      if (!map.getLayer(`qr-${id}`)) return;
      map.setPaintProperty(`qr-${id}`, "line-opacity", dim ? 0.18 : 0.95);
      map.setPaintProperty(`qr-${id}`, "line-width", dim ? 2 : 4.5);
    });
    stopEls.current.forEach((el) => el.classList.remove("qr-stop-mute"));
    const active = routes?.find((r) => r.vehicleId === selected);
    if (active && routes && routes.length > 1) {
      const on = new Set(active.stopIds);
      stopEls.current.forEach((el, id) => el.classList.toggle("qr-stop-mute", !on.has(id)));
    }
    if (focusSelected && active) {
      const b = new maplibregl.LngLatBounds();
      active.geometry.forEach((p) => b.extend(p));
      map.fitBounds(b, { padding: 70, duration: 900, easing: EASE });
    }
  }, [selected, routes, focusSelected]);

  useEffect(() => {
    stopEls.current.forEach((el, id) => el.classList.toggle("qr-stop-hot", id === highlightStopId));
  }, [highlightStopId, routes]);

  return <div ref={ref} className="h-full w-full" />;
}
