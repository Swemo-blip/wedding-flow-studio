"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Shared candlelit dinner-table dressing, used by BOTH dinner scenes (the
// immersive twin in church-scene.tsx and the /reception drag-to-reseat editor)
// so the evening room reads the same everywhere. Emissive flames + bloom only —
// never a pointLight per table (the room's ceiling pendants carry the light),
// so a hall full of tables stays mobile-safe.

export type TablescapeColors = {
  accent: string;
  candle: string;
  cloth: string;
  floral: string;
};

// The seated planning figures are short (~0.8 m), so the table sits a touch
// below a real 0.75 m dining height to keep guests reading as adults at the
// table rather than children peeking over it.
const TABLE_HEIGHT = 0.66;

// A single candle flame that breathes. No light attached — the glow is carried
// by the bloom pass, so N candles cost N tiny emissive spheres, not N lights.
function CandleFlame({ base, color, position, radius, seed }: { base: number; color: string; position: [number, number, number]; radius: number; seed: number }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const flicker = Math.sin(time * 9.1 + seed * 7.3) * 0.5 + Math.sin(time * 12.6 + seed * 3.9) * 0.3 + Math.sin(time * 5.4 + seed * 11.1) * 0.2;
    if (materialRef.current) {
      materialRef.current.emissiveIntensity = base * (1 + flicker * 0.16);
    }
  });

  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={base} ref={materialRef} toneMapped={false} />
    </mesh>
  );
}

// One taper candle in a slim brass holder, topped by a breathing flame.
function TaperCandle({ candleColor, height, position, seed }: { candleColor: string; height: number; position: [number, number, number]; seed: number }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.018, 0.022, height, 10]} />
        <meshStandardMaterial color="#f3ead2" roughness={0.55} />
      </mesh>
      <CandleFlame base={2.3} color={candleColor} position={[0, height + 0.03, 0]} radius={0.022} seed={seed} />
    </group>
  );
}

// A full round dinner table: a floor-length linen cloth, a low floral ring, and
// a trio of tapers at its centre. `radius` matches the caller's table size so
// the cloth lines up with the seat ring. Memoized because the seating editor
// re-renders its whole scene on every drag frame — the static tables must not.
function DinnerTablescapeImpl({
  colors,
  height = TABLE_HEIGHT,
  radius = 0.6,
  seed = 0
}: {
  colors: TablescapeColors;
  height?: number;
  radius?: number;
  seed?: number;
}) {
  // Draped cloth: a gently flared cylinder from the floor to the tabletop, so
  // the table reads as a linen-covered round rather than a floating disc. The
  // flat top cap (rotated into the XZ plane) closes the open cylinder top.
  const topRadius = radius;
  const hemRadius = radius * 1.06;

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <cylinderGeometry args={[topRadius, hemRadius, height, 28, 1, true]} />
        <meshStandardMaterial color={colors.cloth} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh receiveShadow position={[0, height + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[topRadius, 28]} />
        <meshStandardMaterial color={colors.cloth} roughness={0.8} />
      </mesh>

      {/* Low floral ring lying flat on the cloth, hugging the centre. */}
      <mesh castShadow position={[0, height + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.16, 0.042, 10, 24]} />
        <meshStandardMaterial color={colors.floral} roughness={0.82} />
      </mesh>

      {/* Trio of tapers rising from the arrangement. */}
      {[
        { x: 0, z: 0, h: 0.26 },
        { x: 0.11, z: 0.05, h: 0.2 },
        { x: -0.09, z: -0.07, h: 0.22 }
      ].map((candle, index) => (
        <TaperCandle
          candleColor={colors.candle}
          height={candle.h}
          key={index}
          position={[candle.x, height + 0.02, candle.z]}
          seed={seed + index * 1.7}
        />
      ))}
    </group>
  );
}

export const DinnerTablescape = memo(DinnerTablescapeImpl);
