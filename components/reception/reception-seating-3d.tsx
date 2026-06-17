"use client";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useState } from "react";
import * as THREE from "three";
import { useTranslation } from "@/lib/i18n";
import type { DinnerTable, Guest } from "@/lib/wedding-types";

// Reuse the baked, vertex-colored seated congregation variants as clickable
// dinner guests so the seating editor shows the real, varied crowd.
const SEAT_VARIANTS = [
  "/models/cg_man_0.glb",
  "/models/cg_woman_0.glb",
  "/models/cg_dress_0.glb",
  "/models/cg_man_1.glb",
  "/models/cg_woman_1.glb",
  "/models/cg_dress_1.glb",
  "/models/cg_man_2.glb",
  "/models/cg_woman_2.glb",
  "/models/cg_dress_2.glb"
];

SEAT_VARIANTS.forEach((url) => useGLTF.preload(url));

const GUEST_SCALE = 0.2;
const SEAT_RADIUS = 0.96;
const TABLE_RADIUS = 0.62;

type SeatLayout = {
  guest: Guest;
  position: [number, number, number];
  rotationY: number;
  variant: number;
};

function hashVariant(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  }
  return hash % SEAT_VARIANTS.length;
}

function buildLayout(guests: Guest[], tables: DinnerTable[]): { seats: SeatLayout[]; tableCenters: Array<{ table: DinnerTable; center: [number, number, number] }> } {
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tables.length))));
  const spacing = 2.7;
  const rows = Math.ceil(tables.length / cols);
  const tableCenters = tables.map((table, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = (col - (cols - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    return { table, center: [x, 0, z] as [number, number, number] };
  });

  const seats: SeatLayout[] = [];
  tableCenters.forEach(({ table, center }) => {
    const seated = guests.filter((guest) => guest.tableId === table.id);
    const count = Math.max(seated.length, 1);
    seated.forEach((guest, seatIndex) => {
      const angle = (seatIndex / count) * Math.PI * 2;
      const gx = center[0] + Math.cos(angle) * SEAT_RADIUS;
      const gz = center[2] + Math.sin(angle) * SEAT_RADIUS;
      seats.push({
        guest,
        position: [gx, 0, gz],
        rotationY: Math.atan2(center[0] - gx, center[2] - gz),
        variant: hashVariant(guest.id)
      });
    });
  });

  return { seats, tableCenters };
}

function SeatedGuest({
  geometry,
  material,
  onSelect,
  seat,
  selected
}: {
  geometry: THREE.BufferGeometry | null;
  material: THREE.Material;
  onSelect: (id: string) => void;
  seat: SeatLayout;
  selected: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  if (!geometry) {
    return null;
  }

  return (
    <group position={seat.position} rotation={[0, seat.rotationY, 0]}>
      <mesh
        castShadow
        geometry={geometry}
        material={material}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(seat.guest.id);
        }}
        scale={selected ? GUEST_SCALE * 1.08 : GUEST_SCALE}
      />
      {selected ? (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.28, 28]} />
          <meshBasicMaterial color="#c8a45b" transparent opacity={0.9} />
        </mesh>
      ) : null}
      {hovered || selected ? (
        <Html center distanceFactor={9} position={[0, 1.05, 0]} zIndexRange={[20, 0]}>
          <div className="seat3d-label">{seat.guest.name}</div>
        </Html>
      ) : null}
    </group>
  );
}

function SeatingScene({
  guests,
  onSelectGuest,
  selectedGuestId,
  tables
}: {
  guests: Guest[];
  onSelectGuest: (id: string) => void;
  selectedGuestId: string;
  tables: DinnerTable[];
}) {
  const { seats, tableCenters } = useMemo(() => buildLayout(guests, tables), [guests, tables]);
  const gltfs = useGLTF(SEAT_VARIANTS) as unknown as Array<{ scene: THREE.Group }>;
  const geometries = useMemo(
    () =>
      gltfs.map((gltf) => {
        let geometry: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh && !geometry) {
            geometry = mesh.geometry;
          }
        });
        return geometry;
      }),
    [gltfs]
  );
  const material = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.82, vertexColors: true }), []);

  return (
    <group>
      <mesh receiveShadow position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#efe7d4" roughness={0.9} />
      </mesh>

      {tableCenters.map(({ table, center }) => (
        <group key={table.id} position={center}>
          <mesh castShadow receiveShadow position={[0, 0.36, 0]}>
            <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.06, 36]} />
            <meshStandardMaterial color="#f6eedb" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.36, 12]} />
            <meshStandardMaterial color="#d8c7a4" roughness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 0.46, 0]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#e9d2cf" roughness={0.8} />
          </mesh>
          <Html center distanceFactor={11} position={[0, 0.78, 0]} zIndexRange={[10, 0]}>
            <div className="seat3d-table-label">{table.name}</div>
          </Html>
        </group>
      ))}

      {seats.map((seat) => (
        <SeatedGuest
          geometry={geometries[seat.variant]}
          key={seat.guest.id}
          material={material}
          onSelect={onSelectGuest}
          seat={seat}
          selected={seat.guest.id === selectedGuestId}
        />
      ))}
    </group>
  );
}

export function ReceptionSeating3D({
  guests,
  onSelectGuest,
  selectedGuestId,
  tables
}: {
  guests: Guest[];
  onSelectGuest: (id: string) => void;
  selectedGuestId: string;
  tables: DinnerTable[];
}) {
  const { t } = useTranslation();

  return (
    <div className="reception-seating-3d" aria-label={t("3D seating")}>
      <Canvas camera={{ far: 60, fov: 42, near: 0.1, position: [0, 5, 6.6] }} dpr={[1, 1.8]} shadows>
        <color args={["#f4ecdb"]} attach="background" />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#fff3d8", "#cdbf9d", 0.6]} />
        <directionalLight castShadow intensity={1.5} position={[4, 7, 4]} shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <SeatingScene guests={guests} onSelectGuest={onSelectGuest} selectedGuestId={selectedGuestId} tables={tables} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.25}
          minDistance={3}
          target={[0, 0.3, 0]}
        />
      </Canvas>
      <p className="seat3d-hint">{t("Drag to orbit · click a guest to inspect")}</p>
    </div>
  );
}
