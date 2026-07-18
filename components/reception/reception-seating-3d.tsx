"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { BrightnessContrast, EffectComposer, HueSaturation, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { type ComponentRef, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LoopSubdivision } from "three-subdivide";
import { SceneBootGate, preloadHdr } from "@/components/wedding-studio/scene-boot";
import { DinnerTablescape } from "@/components/wedding-studio/dinner-props";
import { assetPath } from "@/lib/asset-path";
import { useTranslation } from "@/lib/i18n";
import type { DinnerTable, Guest } from "@/lib/wedding-types";

export type ReceptionCameraMode = "walk" | "orbit" | "fly";

// Camera framings for the Walk / Orbit / Fly controls. Applied to the live
// OrbitControls so the guest can still orbit freely afterwards.
const CAMERA_MODES: Record<ReceptionCameraMode, { position: [number, number, number]; target: [number, number, number] }> = {
  orbit: { position: [0, 5, 6.9], target: [0, 0.55, 0] },
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
].map(assetPath);

SEAT_VARIANTS.forEach((url) => useGLTF.preload(url));

// Lift the reception to the same register as the ceremony scene: warm
// image-based lighting (interior HDRI), a real PBR floor, and the rounded,
// palette-muted crowd — reusing the same CC0 assets the church already ships.
const INTERIOR_HDR_URL = assetPath("/hdr/lythwood_room_1k.hdr");
const FLOOR_TEXTURES = {
  map: assetPath("/textures/floor_diff.jpg"),
  normalMap: assetPath("/textures/floor_nor_gl.jpg"),
  roughnessMap: assetPath("/textures/floor_rough.jpg")
};

if (typeof window !== "undefined") {
  useTexture.preload(Object.values(FLOOR_TEXTURES));
  void preloadHdr(INTERIOR_HDR_URL);
}

const GUEST_SCALE = 0.2;
const SEAT_RADIUS = 0.96;
const TABLE_RADIUS = 0.62;
const DROP_RADIUS = 1.7;

// Warm evening dressing for the tablescape, matching the app's palette (the
// editor has no per-plan palette, so these are fixed champagne/blush tones).
const EDITOR_TABLESCAPE_COLORS = {
  accent: "#b39152",
  candle: "#ffca8c",
  cloth: "#f6eedb",
  floral: "#d8b6ad"
};
// Head height for the seated photo faces — tuned to sit on the figure's head;
// nudge if a screenshot shows it floating or sinking.
const RECEPTION_FACE_HEIGHT = 0.62;

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

// Warm image-based lighting from the interior HDRI (loaded imperatively via
// PMREM from the shared cache, so it never suspends the tree or re-downloads).
function HdrEnvironment({ intensity = 0.72, url }: { intensity?: number; url: string }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    let disposed = false;
    let envMap: THREE.Texture | null = null;
    const pmrem = new THREE.PMREMGenerator(gl);
    void preloadHdr(url).then((texture) => {
      if (disposed) {
        return;
      }
      envMap = pmrem.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      scene.environmentIntensity = intensity;
      pmrem.dispose();
    });
    return () => {
      disposed = true;
      scene.environment = null;
      envMap?.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, url, intensity]);

  return null;
}

// Scanned PBR marble floor (the same CC0 set the church uses) instead of a flat
// single colour — the #1 "gamey" tell. Its own Suspense keeps a flat fallback
// so the ground never blanks while the textures stream in.
function ReceptionFloor() {
  const maps = useTexture(FLOOR_TEXTURES) as { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
  const tiled = useMemo(() => {
    const tile = (texture: THREE.Texture, srgb: boolean) => {
      const clone = texture.clone();
      clone.wrapS = THREE.RepeatWrapping;
      clone.wrapT = THREE.RepeatWrapping;
      clone.repeat.set(9, 9);
      clone.anisotropy = 4;
      clone.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      clone.needsUpdate = true;
      return clone;
    };
    return {
      map: tile(maps.map, true),
      normalMap: tile(maps.normalMap, false),
      roughnessMap: tile(maps.roughnessMap, false)
    };
  }, [maps]);

  return (
    <mesh position={[0, -0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial {...tiled} color="#efe7d4" envMapIntensity={1.1} metalness={0.05} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={0.92} />
    </mesh>
  );
}

function ReceptionFloorFallback() {
  return (
    <mesh position={[0, -0.02, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#efe7d4" roughness={0.9} />
    </mesh>
  );
}

// An uploaded guest photo IS the seated figure's head — a head-sized oval at
// head height, camera-facing so it reads from any orbit angle (matches the
// ceremony couple portraits, not the old floating framed token).
function GuestFace({ photoUrl, selected }: { photoUrl: string; selected: boolean }) {
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(photoUrl);
    loaded.colorSpace = THREE.SRGBColorSpace;
    return loaded;
  }, [photoUrl]);
  useEffect(() => () => texture.dispose(), [texture]);

  const grow = selected ? 1.06 : 1;

  return (
    <Billboard position={[0, RECEPTION_FACE_HEIGHT, 0]}>
      <mesh scale={[0.82 * grow, 1.04 * grow, 1]}>
        <circleGeometry args={[0.13, 44]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent />
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

// A dollhouse room around the seating grid: low warm walls with glowing dusk
// window bands so the tables sit inside the couple's evening room instead of a
// cream void. Kept low + open-topped so the elevated orbit clears the walls and
// drag-to-reseat still works from above. Walls never intercept pointer rays.
function ReceptionRoom({ extent = 4.7, height = 2.2 }: { extent?: number; height?: number }) {
  const wall = "#efe4cf";
  const skip = () => null;
  const spans = [-extent * 0.55, 0, extent * 0.55];

  return (
    <group>
      {([
        { pos: [0, height / 2, -extent] as [number, number, number], size: [extent * 2, height, 0.16] as [number, number, number], horizontal: true },
        { pos: [0, height / 2, extent] as [number, number, number], size: [extent * 2, height, 0.16] as [number, number, number], horizontal: true },
        { pos: [-extent, height / 2, 0] as [number, number, number], size: [0.16, height, extent * 2] as [number, number, number], horizontal: false },
        { pos: [extent, height / 2, 0] as [number, number, number], size: [0.16, height, extent * 2] as [number, number, number], horizontal: false }
      ]).map((face, index) => (
        <group key={index}>
          <mesh position={face.pos} raycast={skip} receiveShadow>
            <boxGeometry args={face.size} />
            <meshStandardMaterial color={wall} roughness={0.9} />
          </mesh>
          {/* Warm window band glowing on each wall. */}
          {spans.map((span) => (
            <mesh
              key={span}
              position={
                face.horizontal
                  ? [span, height * 0.6, face.pos[2] + (face.pos[2] < 0 ? 0.09 : -0.09)]
                  : [face.pos[0] + (face.pos[0] < 0 ? 0.09 : -0.09), height * 0.6, span]
              }
              raycast={skip}
              rotation={face.horizontal ? [0, 0, 0] : [0, Math.PI / 2, 0]}
            >
              <planeGeometry args={[0.9, height * 0.5]} />
              <meshStandardMaterial color="#f6ead0" emissive="#ffe2ad" emissiveIntensity={0.6} roughness={0.5} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function SeatingScene({
  draggedId,
  guests,
  highQuality,
  onReassignGuest,
  onSelectGuest,
  selectedGuestId,
  setDraggedId,
  tables
}: {
  draggedId: string | null;
  guests: Guest[];
  highQuality: boolean;
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
        let found: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh && !found) {
            found = mesh.geometry;
          }
        });
        if (!found) {
          return null;
        }
        // Round the blocky low-poly silhouette with one Loop subdivision pass
        // (these baked meshes are non-indexed, so computeVertexNormals alone is a
        // no-op) and mute the saturated baked palette toward the cohesive
        // editorial crowd — exactly as the ceremony does. Skipped on mobile.
        const smoothed = highQuality
          ? LoopSubdivision.modify(found as THREE.BufferGeometry, 1, { maxTriangles: 28000 })
          : (found as THREE.BufferGeometry).clone();
        if (!highQuality) {
          smoothed.computeVertexNormals();
        }
        const colorAttr = smoothed.getAttribute("color") as THREE.BufferAttribute | undefined;
        if (colorAttr) {
          const color = new THREE.Color();
          const hsl = { h: 0, s: 0, l: 0 };
          for (let i = 0; i < colorAttr.count; i += 1) {
            color.fromBufferAttribute(colorAttr, i);
            color.getHSL(hsl);
            color.setHSL(hsl.h, hsl.s * 0.62, Math.min(0.82, hsl.l * 0.98 + 0.03));
            colorAttr.setXYZ(i, color.r, color.g, color.b);
          }
          colorAttr.needsUpdate = true;
        }
        return smoothed;
      }),
    [gltfs, highQuality]
  );
  const material = useMemo(() => new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.94, vertexColors: true }), []);

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
      <Suspense fallback={<ReceptionFloorFallback />}>
        <ReceptionFloor />
      </Suspense>

      <ReceptionRoom />

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
          <DinnerTablescape colors={EDITOR_TABLESCAPE_COLORS} radius={TABLE_RADIUS} seed={center[0] * 2.3 + center[2] * 1.7} />
          <Html center distanceFactor={11} position={[0, 1.2, 0]} zIndexRange={[10, 0]}>
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
        {/* IBL now carries the fill, so the raw ambient/hemisphere are dialled
            back to let the HDRI do the work and the directional stay the key. */}
        <ambientLight intensity={0.32} />
        <hemisphereLight args={["#fff3d8", "#cdbf9d", 0.35]} />
        <directionalLight castShadow intensity={1.25} position={[4, 7, 4]} shadow-mapSize={[1024, 1024]} />
        <HdrEnvironment url={INTERIOR_HDR_URL} />
        <Suspense fallback={null}>
          <SeatingScene
            draggedId={draggedId}
            guests={guests}
            highQuality={highQuality}
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
        {/* Film-look grade, re-tuned for a bright gallery scene: contact
            occlusion to sit figures/tables into the floor, a soft vignette, and
            AgX tone mapping LAST (the composer disables the renderer's own tone
            curve). N8AO is dropped on the mobile path. */}
        {highQuality ? (
          <EffectComposer multisampling={4}>
            <N8AO aoRadius={0.7} distanceFalloff={0.8} halfRes intensity={2.2} quality="medium" />
            <Vignette darkness={0.2} eskil={false} offset={0.36} />
            <ToneMapping mode={ToneMappingMode.AGX} />
            <BrightnessContrast brightness={0.03} contrast={0.06} />
            <HueSaturation saturation={0.12} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0}>
            <ToneMapping mode={ToneMappingMode.AGX} />
            <BrightnessContrast brightness={0.03} contrast={0.05} />
          </EffectComposer>
        )}
      </Canvas>
      </SceneBootGate>
      <p className="seat3d-hint">{t("Drag a guest to another table · click to inspect")}</p>
    </div>
  );
}
