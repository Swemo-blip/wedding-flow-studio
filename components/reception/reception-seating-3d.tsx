"use client";

import { Canvas } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { type ComponentRef, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { SceneBootGate } from "@/components/wedding-studio/scene-boot";
import { useTranslation } from "@/lib/i18n";
import type { DinnerTable, Guest } from "@/lib/wedding-types";

export type ReceptionCameraMode = "walk" | "orbit" | "fly";

// Camera framings for the Walk / Orbit / Fly controls. Applied to the live
// OrbitControls so the guest can still orbit freely afterwards.
const CAMERA_MODES: Record<ReceptionCameraMode, { position: [number, number, number]; target: [number, number, number] }> = {
  orbit: { position: [0, 5, 6.6], target: [0, 0.3, 0] },
  walk: { position: [0, 1.7, 5.6], target: [0, 1, 0] },
  fly: { position: [0, 9.2, 7], target: [0, 0, 0] }
};

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
const DROP_RADIUS = 1.7;

// While a guest is being dragged, the seated figures must stop intercepting
// pointer rays so the large ground plane underneath can report the cursor
// position every frame.
const noopRaycast = () => null;

type SeatLayout = {
  guest: Guest;
  position: [number, number, number];
  rotationY: number;
  variant: number;
};

type TableCenter = { table: DinnerTable; center: [number, number, number] };

function hashVariant(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  }
  return hash % SEAT_VARIANTS.length;
}

function buildLayout(guests: Guest[], tables: DinnerTable[]): { seats: SeatLayout[]; tableCenters: TableCenter[] } {
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

function nearestTable(tableCenters: TableCenter[], x: number, z: number): { table: DinnerTable; distance: number } | null {
  let best: { table: DinnerTable; distance: number } | null = null;
  tableCenters.forEach(({ table, center }) => {
    const distance = Math.hypot(center[0] - x, center[2] - z);
    if (!best || distance < best.distance) {
      best = { table, distance };
    }
  });
  return best;
}

// An uploaded guest photo, shown as a camera-facing portrait token floating just
// above the seated figure so you recognise real people around the tables.
function GuestFace({ photoUrl, selected }: { photoUrl: string; selected: boolean }) {
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(photoUrl);
    loaded.colorSpace = THREE.SRGBColorSpace;
    return loaded;
  }, [photoUrl]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <Billboard position={[0, 0.72, 0]}>
      <mesh position={[0, 0, -0.002]}>
        <circleGeometry args={[selected ? 0.172 : 0.156, 40]} />
        <meshBasicMaterial color={selected ? "#c8a45b" : "#fffdf8"} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[selected ? 0.156 : 0.14, 40]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

function SeatedGuest({
  dragActive,
  dragXZ,
  geometry,
  isDragged,
  material,
  onStartDrag,
  seat,
  selected
}: {
  dragActive: boolean;
  dragXZ: [number, number] | null;
  geometry: THREE.BufferGeometry | null;
  isDragged: boolean;
  material: THREE.Material;
  onStartDrag: (seat: SeatLayout) => void;
  seat: SeatLayout;
  selected: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  if (!geometry) {
    return null;
  }

  const position: [number, number, number] = isDragged && dragXZ ? [dragXZ[0], 0.14, dragXZ[1]] : seat.position;

  return (
    <group position={position} rotation={[0, seat.rotationY, 0]}>
      <mesh
        castShadow
        geometry={geometry}
        material={material}
        onPointerDown={(event) => {
          event.stopPropagation();
          onStartDrag(seat);
        }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        raycast={dragActive ? noopRaycast : undefined}
        scale={selected ? GUEST_SCALE * 1.08 : GUEST_SCALE}
      />
      {seat.guest.photoUrl ? <GuestFace photoUrl={seat.guest.photoUrl} selected={selected} /> : null}
      {selected ? (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.28, 28]} />
          <meshBasicMaterial color="#c8a45b" opacity={0.9} transparent />
        </mesh>
      ) : null}
      {hovered || selected || isDragged ? (
        <Html center distanceFactor={9} position={[0, 1.05, 0]} zIndexRange={[20, 0]}>
          <div className="seat3d-label">{seat.guest.name}</div>
        </Html>
      ) : null}
    </group>
  );
}

function SeatingScene({
  draggedId,
  guests,
  onReassignGuest,
  onSelectGuest,
  selectedGuestId,
  setDraggedId,
  tables
}: {
  draggedId: string | null;
  guests: Guest[];
  onReassignGuest?: (guestId: string, tableId: string) => void;
  onSelectGuest: (id: string) => void;
  selectedGuestId: string;
  setDraggedId: (id: string | null) => void;
  tables: DinnerTable[];
}) {
  const { seats, tableCenters } = useMemo(() => buildLayout(guests, tables), [guests, tables]);
  const [dragXZ, setDragXZ] = useState<[number, number] | null>(null);
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

  const dragActive = draggedId !== null;
  const dropTargetId = dragActive && dragXZ ? nearestTable(tableCenters, dragXZ[0], dragXZ[1])?.table.id ?? null : null;

  function endDrag() {
    if (draggedId && dragXZ && onReassignGuest) {
      const target = nearestTable(tableCenters, dragXZ[0], dragXZ[1]);
      const guest = guests.find((candidate) => candidate.id === draggedId);
      if (target && target.distance < DROP_RADIUS && guest && guest.tableId !== target.table.id) {
        onReassignGuest(draggedId, target.table.id);
      }
    }
    setDraggedId(null);
    setDragXZ(null);
  }

  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#efe7d4" roughness={0.9} />
      </mesh>

      {dragActive ? (
        <mesh
          onPointerMove={(event) => {
            event.stopPropagation();
            setDragXZ([event.point.x, event.point.z]);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            endDrag();
          }}
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[80, 80]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      ) : null}

      {tableCenters.map(({ table, center }) => (
        <group key={table.id} position={center}>
          {table.id === dropTargetId ? (
            <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[TABLE_RADIUS + 0.16, TABLE_RADIUS + 0.3, 40]} />
              <meshBasicMaterial color="#c8a45b" opacity={0.85} transparent />
            </mesh>
          ) : null}
          <mesh castShadow position={[0, 0.36, 0]} receiveShadow>
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
          dragActive={dragActive}
          dragXZ={dragXZ}
          geometry={geometries[seat.variant]}
          isDragged={seat.guest.id === draggedId}
          key={seat.guest.id}
          material={material}
          onStartDrag={(target) => {
            onSelectGuest(target.guest.id);
            setDraggedId(target.guest.id);
            setDragXZ([target.position[0], target.position[2]]);
          }}
          seat={seat}
          selected={seat.guest.id === selectedGuestId}
        />
      ))}
    </group>
  );
}

export function ReceptionSeating3D({
  cameraMode = "orbit",
  guests,
  highQuality = true,
  onReassignGuest,
  onSelectGuest,
  selectedGuestId,
  tables
}: {
  cameraMode?: ReceptionCameraMode;
  guests: Guest[];
  highQuality?: boolean;
  onReassignGuest?: (guestId: string, tableId: string) => void;
  onSelectGuest: (id: string) => void;
  selectedGuestId: string;
  tables: DinnerTable[];
}) {
  const { t } = useTranslation();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  // Re-frame the camera when the Walk / Orbit / Fly mode changes, then hand
  // control back to OrbitControls so the guest can keep orbiting.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const framing = CAMERA_MODES[cameraMode];
    controls.object.position.set(...framing.position);
    controls.target.set(...framing.target);
    controls.update();
  }, [cameraMode]);

  return (
    <div className="reception-seating-3d" aria-label={t("3D seating")}>
      <SceneBootGate>
      <Canvas
        camera={{ far: 60, fov: 42, near: 0.1, position: [0, 5, 6.6] }}
        dpr={highQuality ? [1, 2] : [1, 1.3]}
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => setDraggedId(null)}
        shadows
      >
        <color args={["#f4ecdb"]} attach="background" />
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#fff3d8", "#cdbf9d", 0.6]} />
        <directionalLight castShadow intensity={1.5} position={[4, 7, 4]} shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <SeatingScene
            draggedId={draggedId}
            guests={guests}
            onReassignGuest={onReassignGuest}
            onSelectGuest={onSelectGuest}
            selectedGuestId={selectedGuestId}
            setDraggedId={setDraggedId}
            tables={tables}
          />
        </Suspense>
        <OrbitControls
          enabled={draggedId === null}
          enablePan={false}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.25}
          minDistance={3}
          ref={controlsRef}
          target={[0, 0.3, 0]}
        />
      </Canvas>
      </SceneBootGate>
      <p className="seat3d-hint">{t("Drag a guest to another table · click to inspect")}</p>
    </div>
  );
}
