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
// Derived, not chosen. A seated guest in this world measures 0.82 m (congregation
// geometry 4.001 units at CONGREGATION_SCALE 0.205), and the reception editor's
// own GUEST_SCALE of 0.2 puts its diners at practically the same height — so both
// views share this number and both were wrong the same way.
//
// A real 0.75 m table against a 1.25 m seated person is a ratio of 0.60. At 0.66
// this table sat at 0.80 of the figure, chest-to-chin height, and every guest read
// as a child at an adult table.
//
//   0.60 x 0.82 = 0.49
export const TABLE_HEIGHT = 0.49;

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
// A dining chair, DERIVED. Every number below is a proportion of the seated
// guest's measured 0.82 m, never a real chair's dimensions — that mistake put
// brown slabs taller than the diners into this room once already.
//
//   seat surface  0.36 x 0.82 = 0.295   (real: 0.45 m of a 1.25 m seated height)
//   back top      0.72 x 0.82 = 0.59
//   seat width    0.36 x 0.82 = 0.295
//   leg section   0.028 x 0.82 = 0.023
//
// buildReceptionSeats puts the figure's base at y = 0 and yaws it so its local +z
// points at the table, so the back belongs at local -z, behind the sitter.
const CHAIR_SEAT_Y = 0.295;
const CHAIR_WIDTH = 0.295;

export function DinnerChair({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const half = CHAIR_WIDTH / 2 - 0.03;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[
        [-half, -half],
        [half, -half],
        [-half, half],
        [half, half]
      ].map(([lx, lz]) => (
        <mesh castShadow key={`${lx}-${lz}`} position={[lx, CHAIR_SEAT_Y / 2, lz]}>
          <boxGeometry args={[0.023, CHAIR_SEAT_Y, 0.023]} />
          <meshStandardMaterial color="#6f5a3c" roughness={0.62} />
        </mesh>
      ))}
      <mesh castShadow position={[0, CHAIR_SEAT_Y, 0]} receiveShadow>
        <boxGeometry args={[CHAIR_WIDTH, 0.026, CHAIR_WIDTH]} />
        <meshStandardMaterial color="#e6dcc4" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.445, -CHAIR_WIDTH / 2 + 0.014]}>
        <boxGeometry args={[CHAIR_WIDTH - 0.02, 0.29, 0.02]} />
        <meshStandardMaterial color="#7b6644" roughness={0.6} />
      </mesh>
    </group>
  );
}

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
