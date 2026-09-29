import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { useRef, useState } from "react";
import type { Group } from "three";

function cssColor(token: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const m = token.match(/var\((--[^)]+)\)/);
  const raw = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim() : token;
  if (!raw) return fallback;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallback;
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

const CLAY = "#e9e9e7";
const CLAY_DARK = "#d6d6d3";

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.46, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.46, 0.46, 0.3, 32]} />
        <meshStandardMaterial color="#cfcfcc" roughness={0.9} />
      </mesh>
      <mesh position={[0, z > 0 ? 0.16 : -0.16, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.02, 24]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.5} metalness={0.2} />
      </mesh>
    </group>
  );
}

function Van({ accent, hovered }: { accent: string; hovered: boolean }) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y += ((hovered ? 0.08 : 0) - g.position.y) * 0.06;
    const target = Math.PI + 0.28 + Math.sin(t * 0.25) * 0.08 + (hovered ? 0.1 : 0);
    g.rotation.y += (target - g.rotation.y) * 0.05;
  });

  return (
    <group ref={group} rotation={[0, Math.PI + 0.28, 0]}>
      {/* cargo box */}
      <mesh position={[-0.7, 1.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 2.1, 2]} />
        <meshStandardMaterial color={CLAY} roughness={0.7} />
      </mesh>
      {/* panel seams */}
      {[-1.6, -0.7, 0.2].map((x) => (
        <mesh key={x} position={[x, 1.55, 1.005]}>
          <boxGeometry args={[0.012, 1.9, 0.01]} />
          <meshStandardMaterial color={CLAY_DARK} />
        </mesh>
      ))}
      {/* accent stripe */}
      {[1.01, -1.01].map((z) => (
        <mesh key={z} position={[-0.7, 0.72, z]}>
          <boxGeometry args={[3.58, 0.08, 0.01]} />
          <meshStandardMaterial color={accent} roughness={0.4} />
        </mesh>
      ))}
      {/* cab */}
      <mesh position={[1.62, 1.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 1.25, 1.96]} />
        <meshStandardMaterial color={CLAY} roughness={0.7} />
      </mesh>
      {/* hood */}
      <mesh position={[2.3, 0.82, 0]} castShadow>
        <boxGeometry args={[0.5, 0.65, 1.9]} />
        <meshStandardMaterial color={CLAY} roughness={0.7} />
      </mesh>
      {/* windshield */}
      <mesh position={[2.12, 1.48, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.06, 0.8, 1.8]} />
        <meshStandardMaterial color="#b9bcc0" roughness={0.2} metalness={0.3} />
      </mesh>
      {/* side windows */}
      {[0.985, -0.985].map((z) => (
        <mesh key={z} position={[1.7, 1.42, z]}>
          <boxGeometry args={[0.6, 0.5, 0.02]} />
          <meshStandardMaterial color="#c4c7ca" roughness={0.2} metalness={0.3} />
        </mesh>
      ))}
      {/* chassis */}
      <mesh position={[0.3, 0.5, 0]}>
        <boxGeometry args={[4.9, 0.22, 1.8]} />
        <meshStandardMaterial color={CLAY_DARK} roughness={0.8} />
      </mesh>
      <Wheel x={1.7} z={0.9} />
      <Wheel x={1.7} z={-0.9} />
      <Wheel x={-1.55} z={0.9} />
      <Wheel x={-1.55} z={-0.9} />
    </group>
  );
}

export default function VanScene({ color }: { color: string }) {
  const [hovered, setHovered] = useState(false);
  const accent = cssColor(color, "#2a7fb8");
  return (
    <div className="h-full w-full" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0.4, 2.0, 7.6], fov: 32 }} gl={{ antialias: true, powerPreference: "low-power", alpha: true }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 8, 6]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-6, 3, -4]} intensity={0.4} />
        <group position={[0, -0.9, 0]}>
          <Van accent={accent} hovered={hovered} />
          <ContactShadows position={[0, 0, 0]} opacity={0.28} scale={14} blur={2.8} far={4} />
        </group>
      </Canvas>
    </div>
  );
}
