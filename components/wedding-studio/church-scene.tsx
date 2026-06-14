"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import {
  venueOptions,
  type StudioBudgetLevel,
  type StudioColorDirection,
  type StudioPlanningStepId,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type StudioStyle,
  type StudioVenueType,
  type StudioViewMode,
  type WeddingStudioCapacity
} from "@/lib/wedding-studio-plan";

export type SceneLighting = "day" | "dusk";

export type SceneCameraOverride = {
  position: [number, number, number];
  target: [number, number, number];
};

type CeremonySceneProps = {
  activeStep: StudioPlanningStepId;
  budgetLevel: StudioBudgetLevel;
  cameraOverride?: SceneCameraOverride | null;
  capacity: WeddingStudioCapacity;
  colorDirection: StudioColorDirection;
  lighting?: SceneLighting;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  style: StudioStyle;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
  zoom?: number;
};

const lightingPresets: Record<
  SceneLighting,
  {
    ambientColor: string;
    ambientIntensity: number;
    fogColor: string;
    fogFar: number;
    fogNear: number;
    hemisphereGround: string;
    hemisphereIntensity: number;
    hemisphereSky: string;
    keyIntensity: number;
    rimIntensity: number;
  }
> = {
  day: {
    ambientColor: "#dfe6ef",
    ambientIntensity: 0.85,
    fogColor: "#e7eef3",
    fogFar: 44,
    fogNear: 20,
    hemisphereGround: "#9a9277",
    hemisphereIntensity: 1.15,
    hemisphereSky: "#cfe0f0",
    keyIntensity: 2.2,
    rimIntensity: 0.5
  },
  dusk: {
    ambientColor: "#5a5868",
    ambientIntensity: 0.46,
    fogColor: "#3a3340",
    fogFar: 38,
    fogNear: 15,
    hemisphereGround: "#2a2419",
    hemisphereIntensity: 0.72,
    hemisphereSky: "#6c6e90",
    keyIntensity: 2,
    rimIntensity: 0.55
  }
};

type GuestMarker = {
  id: string;
  position: [number, number, number];
};

type Palette = {
  accent: string;
  blush: string;
  candle: string;
  carpet: string;
  floor: string;
  guest: string;
  pew: string;
  wall: string;
};

const palettes: Record<StudioStyle, Palette> = {
  classic: {
    accent: "#c9a767",
    blush: "#e7c6b3",
    candle: "#ffd9a0",
    carpet: "#ede0c6",
    floor: "#d8cab0",
    guest: "#f1e7d2",
    pew: "#a07f57",
    wall: "#efe7d6"
  },
  modern: {
    accent: "#9fb0a3",
    blush: "#cdd6cd",
    candle: "#f3e2b8",
    carpet: "#e4e5da",
    floor: "#dcdcd2",
    guest: "#eef0ea",
    pew: "#7d877f",
    wall: "#eef0ea"
  },
  romantic: {
    accent: "#d8a79c",
    blush: "#f0d2c8",
    candle: "#ffd9ae",
    carpet: "#f1e2d8",
    floor: "#e3d3cf",
    guest: "#f6e7df",
    pew: "#9c7a72",
    wall: "#f3e8e4"
  },
  rustic: {
    accent: "#c2a065",
    blush: "#e2cba9",
    candle: "#f5cf92",
    carpet: "#e9dabc",
    floor: "#d6c2a0",
    guest: "#efe2c8",
    pew: "#8a6a45",
    wall: "#e7dcc6"
  }
};

const colorDirectionOverrides: Record<StudioColorDirection, Partial<Palette>> = {
  blue: {
    accent: "#93acb4",
    blush: "#c3d3d8",
    carpet: "#dde6e6"
  },
  blush: {
    accent: "#d7a59b",
    blush: "#ecd0c8",
    carpet: "#ecdcd5"
  },
  bold: {
    accent: "#c08648",
    blush: "#d7b7a6",
    carpet: "#e2d2b8"
  },
  green: {
    accent: "#94a87f",
    blush: "#ccd9c0",
    carpet: "#dde6d2"
  },
  neutral: {},
  warm: {
    accent: "#cda367",
    blush: "#e2c8a8",
    carpet: "#ead9bc"
  }
};

function createPalette(style: StudioStyle, colorDirection: StudioColorDirection): Palette {
  return {
    ...palettes[style],
    ...colorDirectionOverrides[colorDirection]
  };
}

export function CeremonyScene({
  activeStep,
  budgetLevel,
  capacity,
  colorDirection,
  onMoveObject,
  onSelectObject,
  sceneEdits,
  selectedObjectId,
  style,
  venueType,
  viewMode,
  cameraOverride = null,
  lighting = "dusk",
  zoom = 1
}: CeremonySceneProps) {
  const palette = useMemo(() => createPalette(style, colorDirection), [colorDirection, style]);
  const preset = lightingPresets[lighting];
  const isDay = lighting === "day";

  return (
    <section className="ceremony-scene-shell" aria-label="Interactive 3D ceremony visualization">
      <div
        className="ceremony-canvas-frame"
        // Back the canvas with the current sky so a cold start or a dropped
        // frame during the day→dusk transition reveals scene-matched light,
        // never a loading flash.
        style={{ background: `linear-gradient(180deg, ${preset.hemisphereSky}, ${preset.fogColor} 60%)` }}
      >
        <Canvas
          camera={{ far: 90, fov: 40, near: 0.3, position: getCameraPosition(viewMode, venueType, activeStep) }}
          dpr={[1, 1.8]}
          gl={{ toneMappingExposure: 1.16 }}
          shadows={{ type: THREE.PCFSoftShadowMap }}
        >
          <CameraSetup activeStep={activeStep} cameraOverride={cameraOverride} venueType={venueType} viewMode={viewMode} zoom={zoom} />
          <color args={[preset.fogColor]} attach="background" />
          <fog args={[preset.fogColor, preset.fogNear, preset.fogFar]} attach="fog" />
          <SkyDome mode={lighting} />
          {venueType === "garden" || venueType === "beach" ? <HillSilhouettes /> : null}
          <hemisphereLight args={[preset.hemisphereSky, preset.hemisphereGround, preset.hemisphereIntensity]} />
          <ambientLight color={preset.ambientColor} intensity={preset.ambientIntensity} />
          <directionalLight color="#aebdd6" intensity={preset.rimIntensity} position={[-6, 8, -7]} />
          <directionalLight
            castShadow
            color="#ffd9a6"
            intensity={preset.keyIntensity}
            position={[4.5, 6.5, 5.5]}
            shadow-bias={-0.0004}
            shadow-camera-bottom={-8}
            shadow-camera-far={26}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight
            color="#ffca8c"
            decay={2}
            distance={10}
            intensity={
              venueType === "church"
                ? isDay
                  ? 2.5
                  : 12
                : isDay
                  ? 7
                  : budgetLevel === "signature"
                    ? 32
                    : 22
            }
            position={[0, 3.1, -3.6]}
          />
          <Environment frames={1} resolution={128}>
            <Lightformer color={isDay ? "#fff6e2" : "#ffd2a0"} form="circle" intensity={isDay ? 4.2 : 3} position={[0, 2, -9]} scale={[7, 7, 1]} />
            <Lightformer
              color={isDay ? "#c2d8ee" : "#5a6190"}
              form="rect"
              intensity={isDay ? 1.7 : 1.1}
              position={[0, 9, 0]}
              rotation-x={Math.PI / 2}
              scale={[16, 16, 1]}
            />
            <Lightformer color={isDay ? "#eef1ea" : "#caa05f"} form="rect" intensity={isDay ? 1 : 0.65} position={[7, 2.5, 3]} rotation-y={-Math.PI / 2} scale={[9, 3.5, 1]} />
            <Lightformer color={isDay ? "#d6e2ee" : "#3c4258"} form="rect" intensity={isDay ? 0.8 : 0.4} position={[-7, 3, -2]} rotation-y={Math.PI / 2} scale={[9, 4, 1]} />
          </Environment>
          <ContactShadows blur={2.4} color={isDay ? "#5a5238" : "#050602"} far={5} opacity={isDay ? 0.34 : 0.55} position={[0, -0.025, 0.25]} resolution={384} scale={13} />
          <EffectComposer multisampling={4}>
            <Bloom intensity={isDay ? 0.42 : 0.85} luminanceSmoothing={0.2} luminanceThreshold={isDay ? 1.05 : 1} mipmapBlur />
            <Vignette darkness={isDay ? 0.26 : 0.55} eskil={false} offset={0.3} />
          </EffectComposer>
          {isDay ? null : <GlowHalo />}
          <DustMotes intensity={isDay ? 0.18 : 0.42} />
          <WeddingStageInterior
            activeStep={activeStep}
            budgetLevel={budgetLevel}
            capacity={capacity}
            onMoveObject={onMoveObject}
            onSelectObject={onSelectObject}
            palette={palette}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            venueType={venueType}
            viewMode={viewMode}
          />
        </Canvas>
      </div>

      <div className="ceremony-scene-caption" aria-live="polite">
        <span data-tone={capacity.capacityStatus === "over_capacity" ? "high" : capacity.capacityStatus === "full" ? "medium" : "confirmed"}>
          {getSceneSignal(activeStep, capacity, venueType)}
        </span>
        <strong>{getSceneCaption(activeStep, capacity, venueType)}</strong>
      </div>
    </section>
  );
}

function GlowHalo() {
  return (
    <mesh position={[0, 1.7, -5.5]}>
      <circleGeometry args={[2.8, 40]} />
      <meshBasicMaterial blending={THREE.AdditiveBlending} color="#ffc98c" depthWrite={false} opacity={0.14} transparent />
    </mesh>
  );
}

function createSkyTexture(mode: SceneLighting) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, 256);

    if (mode === "day") {
      gradient.addColorStop(0, "#8db4dd");
      gradient.addColorStop(0.4, "#a9cae5");
      gradient.addColorStop(0.68, "#d3e4ef");
      gradient.addColorStop(0.84, "#eef2ec");
      gradient.addColorStop(0.94, "#dfe6d8");
      gradient.addColorStop(1, "#c8d2bc");
    } else {
      gradient.addColorStop(0, "#33396a");
      gradient.addColorStop(0.42, "#52507e");
      gradient.addColorStop(0.62, "#9a6e74");
      gradient.addColorStop(0.74, "#e0a06f");
      gradient.addColorStop(0.82, "#f4c88c");
      gradient.addColorStop(0.9, "#8a6a4a");
      gradient.addColorStop(1, "#3a2e22");
    }

    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function SkyDome({ mode }: { mode: SceneLighting }) {
  const texture = useMemo(() => createSkyTexture(mode), [mode]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, -1.5, 0]}>
      <sphereGeometry args={[46, 28, 20]} />
      <meshBasicMaterial fog={false} map={texture} side={THREE.BackSide} />
    </mesh>
  );
}

function HillSilhouettes() {
  const hills: Array<[number, number, number, number]> = [
    [-9, -16, 15, 3],
    [8, -19, 19, 3.8],
    [-1, -22, 25, 4.6]
  ];

  return (
    <group>
      {hills.map(([x, z, scaleX, scaleY], index) => (
        <mesh key={index} position={[x, -0.5, z]} scale={[scaleX, scaleY, 5]}>
          <sphereGeometry args={[1, 18, 12]} />
          <meshStandardMaterial color="#7c8c5c" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

const DUST_COUNT = 90;

function DustMotes({ intensity = 0.42 }: { intensity?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { basePositions, positions } = useMemo(() => {
    const base = new Float32Array(DUST_COUNT * 3);

    for (let index = 0; index < DUST_COUNT; index += 1) {
      const seed = index * 37.21;
      base[index * 3] = Math.sin(seed) * 4;
      base[index * 3 + 1] = 0.4 + Math.abs(Math.sin(seed * 1.7)) * 2.6;
      base[index * 3 + 2] = -5 + Math.abs(Math.sin(seed * 2.3)) * 9;
    }

    return { basePositions: base, positions: base.slice() };
  }, []);

  useFrame(({ clock }) => {
    const geometry = pointsRef.current?.geometry;
    const attribute = geometry?.getAttribute("position") as THREE.BufferAttribute | undefined;

    if (!attribute) {
      return;
    }

    const time = clock.elapsedTime;

    for (let index = 0; index < DUST_COUNT; index += 1) {
      const drift = time * 0.12 + index;
      attribute.setY(index, basePositions[index * 3 + 1] + Math.sin(drift) * 0.18);
      attribute.setX(index, basePositions[index * 3] + Math.cos(drift * 0.6) * 0.1);
    }

    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
      </bufferGeometry>
      <pointsMaterial
        blending={THREE.AdditiveBlending}
        color="#e9c688"
        depthWrite={false}
        opacity={intensity}
        size={0.05}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

function WeddingStageInterior({
  activeStep,
  budgetLevel,
  capacity,
  onMoveObject,
  onSelectObject,
  palette,
  sceneEdits,
  selectedObjectId,
  venueType,
  viewMode
}: {
  activeStep: StudioPlanningStepId;
  budgetLevel: StudioBudgetLevel;
  capacity: WeddingStudioCapacity;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  palette: Palette;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const guestMarkers = useMemo(() => buildGuestMarkers(capacity), [capacity]);
  const visibleRows = activeStep === "venue" ? 0 : activeStep === "budget" ? Math.min(8, capacity.renderedRows) : capacity.renderedRows;
  const rowIndexes = useMemo(() => Array.from({ length: visibleRows }, (_, index) => index), [visibleRows]);
  const churchSeatedGuests = useMemo(
    () => (venueType === "church" ? buildChurchSeatedGuests(visibleRows, capacity.visibleGuestMarkers) : []),
    [capacity.visibleGuestMarkers, venueType, visibleRows]
  );
  const decorScale = budgetLevel === "signature" ? 1.2 : budgetLevel === "elevated" ? 1 : 0.72;
  const showGuests = ["ceremony", "guests", "share", "timeline"].includes(activeStep);
  const surface = getVenueSurface(venueType, palette);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.018;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0.25]}>
      {activeStep === "reception" ? (
        <ReceptionInterior
          capacity={capacity}
          onMoveObject={onMoveObject}
          onSelectObject={onSelectObject}
          palette={palette}
          sceneEdits={sceneEdits}
          selectedObjectId={selectedObjectId}
          venueType={venueType}
          viewMode={viewMode}
        />
      ) : (
        <>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0.25]}>
            <planeGeometry args={[9.8, 12.8]} />
            <meshStandardMaterial color={surface.floor} roughness={0.72} />
          </mesh>

          <EditableSceneObject
            objectId="ceremonyPath"
            onMoveObject={onMoveObject}
            onSelectObject={onSelectObject}
            outlineCenter={[0, 0.45]}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            size={[1.35, 11.8]}
          >
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0.45]}>
              <planeGeometry args={[surface.aisleWidth, 11.8]} />
              <meshStandardMaterial color={surface.path} roughness={0.82} />
            </mesh>
          </EditableSceneObject>

          <VenueBoundary palette={palette} venueType={venueType} viewMode={viewMode} />
          {activeStep === "venue" ? <VenueShellMarkers palette={palette} venueType={venueType} /> : null}
          {venueType === "church" && activeStep !== "venue" && rowIndexes.length > 0 ? (
            <ChurchAisleMarkers palette={palette} rowZs={rowIndexes.map((index) => -2.4 + index * 0.62)} />
          ) : null}

          {activeStep !== "venue" ? (
            <EditableSceneObject
              objectId="focalPoint"
              onMoveObject={onMoveObject}
              onSelectObject={onSelectObject}
              outlineCenter={[0, -4.4]}
              sceneEdits={sceneEdits}
              selectedObjectId={selectedObjectId}
              size={[2.65, 1.4]}
            >
              <CeremonyFocalPoint decorScale={decorScale} palette={palette} venueType={venueType} />
            </EditableSceneObject>
          ) : null}

          {activeStep === "budget" || budgetLevel !== "essential" ? (
            <EditableSceneObject
              objectId="lighting"
              onMoveObject={onMoveObject}
              onSelectObject={onSelectObject}
              outlineCenter={[0, -0.5]}
              sceneEdits={sceneEdits}
              selectedObjectId={selectedObjectId}
              size={[6.4, 8.2]}
            >
              <LightingRibbon decorScale={decorScale} palette={palette} venueType={venueType} />
            </EditableSceneObject>
          ) : null}

          <EditableSceneObject
            objectId="guestSeating"
            onMoveObject={onMoveObject}
            onSelectObject={onSelectObject}
            outlineCenter={[0, -2.4 + Math.max(0, visibleRows - 1) * 0.31]}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            size={[6.4, Math.max(2.4, visibleRows * 0.7)]}
          >
            {rowIndexes.map((rowIndex) => {
              const z = -2.4 + rowIndex * 0.62;

              return (
                <group key={rowIndex}>
                  <CeremonySeatBlock palette={palette} position={[-1.82, 0.18, z]} venueType={venueType} />
                  <CeremonySeatBlock palette={palette} position={[1.82, 0.18, z]} venueType={venueType} />
                </group>
              );
            })}

            {venueType === "church"
              ? activeStep !== "venue"
                ? churchSeatedGuests.map((guest) => <SeatedGuest hair={guest.hair} key={guest.id} position={guest.position} tone={guest.tone} />)
                : null
              : showGuests
                ? guestMarkers.map((marker) => <GuestDot key={marker.id} palette={palette} position={marker.position} />)
                : null}
            {showGuests && venueType !== "church" && capacity.overflowGuests > 0 ? (
              <OverflowCluster guestCount={capacity.overflowGuests} palette={palette} />
            ) : null}
          </EditableSceneObject>

          {activeStep === "budget" || activeStep === "preview" ? <DetailLayer decorScale={decorScale} palette={palette} /> : null}
        </>
      )}
    </group>
  );
}

function EditableSceneObject({
  children,
  objectId,
  onMoveObject,
  onSelectObject,
  outlineCenter = [0, 0.3],
  sceneEdits,
  selectedObjectId,
  size
}: {
  children: ReactNode;
  objectId: StudioSceneObjectId;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  outlineCenter?: [number, number];
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  size: [number, number];
}) {
  const offset = sceneEdits[objectId];
  const isSelected = selectedObjectId === objectId;
  const isDraggingRef = useRef(false);

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelectObject(objectId);
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        isDraggingRef.current = false;
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelectObject(objectId);
        isDraggingRef.current = true;
        const eventTarget = event.target as Element | null;
        eventTarget?.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!isDraggingRef.current) {
          return;
        }

        event.stopPropagation();

        const nativeEvent = event.nativeEvent as PointerEvent;
        const dragScale = nativeEvent.shiftKey ? 0.006 : 0.014;

        onMoveObject(objectId, nativeEvent.movementX * dragScale, nativeEvent.movementY * dragScale);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        isDraggingRef.current = false;
        const eventTarget = event.target as Element | null;
        eventTarget?.releasePointerCapture?.(event.pointerId);
      }}
      position={[offset.x, 0, offset.z]}
    >
      {children}
      {isSelected ? <SelectionOutline center={outlineCenter} size={size} /> : null}
    </group>
  );
}

function SelectionOutline({ center, size }: { center: [number, number]; size: [number, number] }) {
  const [width, depth] = size;
  const color = "#b69a5b";

  return (
    <group position={[center[0], 0.13, center[1]]}>
      <mesh position={[0, 0, -depth / 2]}>
        <boxGeometry args={[width, 0.035, 0.045]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.46} />
      </mesh>
      <mesh position={[0, 0, depth / 2]}>
        <boxGeometry args={[width, 0.035, 0.045]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.46} />
      </mesh>
      <mesh position={[-width / 2, 0, 0]}>
        <boxGeometry args={[0.045, 0.035, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.46} />
      </mesh>
      <mesh position={[width / 2, 0, 0]}>
        <boxGeometry args={[0.045, 0.035, depth]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} roughness={0.46} />
      </mesh>
    </group>
  );
}

function VenueBoundary({ palette, venueType, viewMode }: { palette: Palette; venueType: StudioVenueType; viewMode: StudioViewMode }) {
  if (venueType === "garden" || venueType === "beach") {
    return <OutdoorVenueFrame palette={palette} venueType={venueType} />;
  }

  if (venueType === "church") {
    return <ChurchNave palette={palette} viewMode={viewMode} />;
  }

  return <RoomFrame palette={palette} venueType={venueType} />;
}

function RoomFrame({ palette, venueType }: { palette: Palette; venueType?: StudioVenueType }) {
  const backWallHeight = venueType === "hall" ? 1.85 : 2.45;
  const sideWallHeight = venueType === "hall" ? 1.28 : 1.8;

  return (
    <group>
      <mesh receiveShadow position={[0, backWallHeight / 2, -5.75]}>
        <boxGeometry args={[9.8, backWallHeight, 0.2]} />
        <meshStandardMaterial color={palette.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[-4.9, sideWallHeight / 2, 0.1]}>
        <boxGeometry args={[0.18, sideWallHeight, 11.8]} />
        <meshStandardMaterial color={palette.wall} roughness={0.88} />
      </mesh>
      <mesh receiveShadow position={[4.9, sideWallHeight / 2, 0.1]}>
        <boxGeometry args={[0.18, sideWallHeight, 11.8]} />
        <meshStandardMaterial color={palette.wall} roughness={0.88} />
      </mesh>
      {[-3.2, -1.05, 1.05, 3.2].map((xPosition) => (
        <mesh key={xPosition} position={[xPosition, 1.5, -5.62]}>
          <boxGeometry args={[0.72, 1.5, 0.08]} />
          <meshStandardMaterial color="#f6eed6" emissive="#fff2cf" emissiveIntensity={0.9} roughness={0.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ----- Church interior: a warm Catholic nave (reference look) -----

const STAINED_GLASS_COLORS = ["#2f4f86", "#8c3b34", "#b1894a", "#3f6b54", "#4a4072", "#356b74"];

function StainedGlassWindow({
  position,
  rotationY = 0,
  width = 1,
  rectHeight = 1.7,
  seed = 0
}: {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  rectHeight?: number;
  seed?: number;
}) {
  const halfWidth = width / 2;
  const paneWidth = width / 3;
  const frameHeight = rectHeight + halfWidth;
  const glassColor = (offset: number) => STAINED_GLASS_COLORS[(seed + offset) % STAINED_GLASS_COLORS.length];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, halfWidth / 2, -0.07]}>
        <boxGeometry args={[width + 0.2, frameHeight + 0.22, 0.12]} />
        <meshStandardMaterial color="#cabfa0" roughness={0.9} />
      </mesh>
      {[-1, 0, 1].map((col, index) => (
        <mesh key={col} position={[col * paneWidth, 0, 0]}>
          <planeGeometry args={[paneWidth - 0.04, rectHeight]} />
          <meshStandardMaterial
            color={glassColor(index)}
            emissive={glassColor(index)}
            emissiveIntensity={0.6}
            roughness={0.45}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh position={[0, rectHeight / 2, 0]}>
        <circleGeometry args={[halfWidth, 18, 0, Math.PI]} />
        <meshStandardMaterial
          color={glassColor(3)}
          emissive={glassColor(3)}
          emissiveIntensity={0.66}
          roughness={0.45}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {[-0.5, 0.5].map((mullion) => (
        <mesh key={mullion} position={[mullion * paneWidth, 0, 0.012]}>
          <boxGeometry args={[0.025, rectHeight, 0.04]} />
          <meshStandardMaterial color="#4f4632" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function ChurchCeiling({ wallTopY, color }: { wallTopY: number; color: string }) {
  const halfW = 4.95;
  const ridgeY = wallTopY + 1.1;
  const slopeLength = Math.hypot(halfW, ridgeY - wallTopY);
  const angle = Math.atan2(ridgeY - wallTopY, halfW);
  const depth = 12.4;

  return (
    <group position={[0, 0, 0.1]}>
      <mesh position={[-halfW / 2, (wallTopY + ridgeY) / 2, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[slopeLength, 0.08, depth]} />
        <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[halfW / 2, (wallTopY + ridgeY) / 2, 0]} rotation={[0, 0, -angle]}>
        <boxGeometry args={[slopeLength, 0.08, depth]} />
        <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, ridgeY, 0]}>
        <boxGeometry args={[0.16, 0.16, depth]} />
        <meshStandardMaterial color="#5a4a33" roughness={0.7} />
      </mesh>
      {[-4, -1.4, 1.2, 3.6].map((z) => (
        <mesh key={z} position={[0, wallTopY - 0.12, z]}>
          <boxGeometry args={[halfW * 2 - 0.1, 0.1, 0.14]} />
          <meshStandardMaterial color="#5a4a33" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Crucifix({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.1, 1.1, 0.08]} />
        <meshStandardMaterial color="#9c7b3f" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.26, 0]}>
        <boxGeometry args={[0.6, 0.1, 0.08]} />
        <meshStandardMaterial color="#9c7b3f" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Candelabra({ candleColor, position, scale = 1 }: { candleColor: string; position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.03, 0.08, 1.1, 10]} />
        <meshStandardMaterial color="#a8833f" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.62, 0.03, 0.03]} />
        <meshStandardMaterial color="#a8833f" metalness={0.85} roughness={0.3} />
      </mesh>
      {[-0.28, 0, 0.28].map((x, index) => {
        const topY = 1.1 + (index === 1 ? 0.16 : 0);

        return (
          <group key={x}>
            <mesh position={[x, topY + 0.08, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.16, 8]} />
              <meshStandardMaterial color="#efe3c4" roughness={0.6} />
            </mesh>
            <mesh position={[x, topY + 0.2, 0]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial color={candleColor} emissive={candleColor} emissiveIntensity={3} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <pointLight color={candleColor} decay={2} distance={3.2} intensity={1.1} position={[0, 1.4, 0]} />
    </group>
  );
}

function ChurchAltar({ decorScale, palette }: { decorScale: number; palette: Palette }) {
  return (
    <group position={[0, 0, -4.55]}>
      <Dais palette={palette} />
      <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[2.1, 0.52, 0.78]} />
        <meshStandardMaterial color="#f3ead7" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.63, 0]}>
        <boxGeometry args={[2.24, 0.05, 0.88]} />
        <meshStandardMaterial color={palette.accent} metalness={0.7} roughness={0.32} />
      </mesh>
      <FlowerCluster palette={palette} position={[-0.7, 0.74, 0.2]} radius={0.22} />
      <FlowerCluster palette={palette} position={[0.7, 0.74, 0.2]} radius={0.22} />
      {[-1.55, 1.55].map((x) => (
        <Candelabra candleColor={palette.candle} key={x} position={[x, 0.1, 0]} scale={decorScale} />
      ))}
    </group>
  );
}

function ChurchPendant({ candleColor, position }: { candleColor: string; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 1, 6]} />
        <meshStandardMaterial color="#2c2519" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.3, 8]} />
        <meshStandardMaterial color="#3a2f20" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color={candleColor} emissive={candleColor} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ChurchPendantRow({ candleColor }: { candleColor: string }) {
  return (
    <group>
      {[-3.2, -1, 1.2, 3.2].map((z) =>
        [-3.4, 3.4].map((x) => <ChurchPendant candleColor={candleColor} key={`${x}-${z}`} position={[x, 2.75, z]} />)
      )}
    </group>
  );
}

function ChurchAisleMarkers({ rowZs, palette }: { rowZs: number[]; palette: Palette }) {
  return (
    <group>
      {rowZs.map((z, rowIndex) =>
        [-0.72, 0.72].map((x) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            {rowIndex % 2 === 0 ? (
              <group>
                <mesh castShadow position={[0, 0.3, 0]}>
                  <cylinderGeometry args={[0.04, 0.06, 0.6, 8]} />
                  <meshStandardMaterial color="#e9ddc4" roughness={0.7} />
                </mesh>
                {(
                  [
                    [0, 0.64, 0, 0.1],
                    [0.07, 0.68, 0.04, 0.07],
                    [-0.07, 0.67, 0.03, 0.07],
                    [0, 0.72, -0.02, 0.06]
                  ] as Array<[number, number, number, number]>
                ).map(([fx, fy, fz, fs], blossomIndex) => (
                  <mesh castShadow key={blossomIndex} position={[fx, fy, fz]}>
                    <sphereGeometry args={[fs, 10, 10]} />
                    <meshStandardMaterial color={blossomIndex % 2 === 0 ? "#f3ece0" : "#e7d8cf"} roughness={0.82} />
                  </mesh>
                ))}
              </group>
            ) : (
              <group>
                <mesh position={[0, 0.2, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.4, 12]} />
                  <meshStandardMaterial color="#fff6e2" metalness={0} opacity={0.3} roughness={0.1} transparent />
                </mesh>
                <mesh position={[0, 0.16, 0]}>
                  <sphereGeometry args={[0.035, 8, 8]} />
                  <meshStandardMaterial color={palette.candle} emissive={palette.candle} emissiveIntensity={3} toneMapped={false} />
                </mesh>
              </group>
            )}
          </group>
        ))
      )}
    </group>
  );
}

// Mostly dark formalwear with a few champagne/grey dresses, like a real
// congregation seen from the back of the nave.
const GUEST_TONES = ["#262a33", "#2f3540", "#3a3128", "#1f232c", "#46403a", "#cdbba2", "#94867a"];
const GUEST_HAIR = ["#2a211a", "#3d2f22", "#1c1814", "#5a4a36", "#8a7250"];

function SeatedGuest({ position, tone, hair }: { position: [number, number, number]; tone: string; hair: string }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.32, 0]}>
        <capsuleGeometry args={[0.088, 0.3, 4, 8]} />
        <meshStandardMaterial color={tone} roughness={0.74} />
      </mesh>
      <mesh castShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[0.28, 0.13, 0.15]} />
        <meshStandardMaterial color={tone} roughness={0.74} />
      </mesh>
      <mesh castShadow position={[0, 0.57, 0]}>
        <sphereGeometry args={[0.068, 12, 12]} />
        <meshStandardMaterial color="#dcb892" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.6, -0.02]}>
        <sphereGeometry args={[0.072, 12, 12]} />
        <meshStandardMaterial color={hair} roughness={0.78} />
      </mesh>
    </group>
  );
}

function buildChurchSeatedGuests(
  visibleRows: number,
  maxGuests: number
): Array<{ id: string; position: [number, number, number]; tone: string; hair: string }> {
  const result: Array<{ id: string; position: [number, number, number]; tone: string; hair: string }> = [];
  const seatOffsets = [-0.85, -0.28, 0.28, 0.85];
  let count = 0;

  for (let row = 0; row < visibleRows; row += 1) {
    const z = -2.4 + row * 0.62;

    for (const sideCenter of [-1.82, 1.82]) {
      for (let seat = 0; seat < seatOffsets.length; seat += 1) {
        if (count >= maxGuests) {
          return result;
        }

        const variant = row * 4 + seat + (sideCenter < 0 ? 0 : 3);
        result.push({
          id: `church-guest-${row}-${sideCenter}-${seat}`,
          position: [sideCenter + seatOffsets[seat], 0, z + 0.02],
          tone: GUEST_TONES[variant % GUEST_TONES.length],
          hair: GUEST_HAIR[variant % GUEST_HAIR.length]
        });
        count += 1;
      }
    }
  }

  return result;
}

function ChurchNave({ palette, viewMode }: { palette: Palette; viewMode: StudioViewMode }) {
  const wallHeight = 3.4;
  const windowZs = [-3.2, -0.7, 1.8];
  const columnZs = [-4.5, -1.95, 0.55, 3.1];
  // The 2D plan view looks straight down, so the vaulted ceiling would hide
  // everything — drop it (and keep the open nave readable from above).
  const showCeiling = viewMode !== "top";

  return (
    <group>
      {/* polygonOffset biases the walls back in the depth buffer so the windows
          and reredos mounted flush against them never z-fight (flicker). */}
      {[-4.95, 4.95].map((x) => (
        <mesh key={x} receiveShadow position={[x, wallHeight / 2, 0.1]}>
          <boxGeometry args={[0.2, wallHeight, 12.4]} />
          <meshStandardMaterial color={palette.wall} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} roughness={0.92} />
        </mesh>
      ))}

      <mesh receiveShadow position={[0, 2.4, -5.85]}>
        <boxGeometry args={[10.1, 4.8, 0.22]} />
        <meshStandardMaterial color={palette.wall} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} roughness={0.92} />
      </mesh>

      {/* Reredos: a framed backdrop behind the altar so the crucifix reads
          against depth instead of a blown-out wall. */}
      <mesh position={[0, 1.95, -5.72]}>
        <boxGeometry args={[2.95, 3.7, 0.08]} />
        <meshStandardMaterial color={palette.accent} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh receiveShadow position={[0, 1.95, -5.69]}>
        <boxGeometry args={[2.6, 3.34, 0.1]} />
        <meshStandardMaterial color="#d3bf97" roughness={0.82} />
      </mesh>

      {showCeiling ? <ChurchCeiling color={palette.wall} wallTopY={wallHeight} /> : null}

      {[-4.6, 4.6].map((x) =>
        columnZs.map((z) => (
          <mesh castShadow key={`${x}-${z}`} position={[x, wallHeight / 2, z]}>
            <boxGeometry args={[0.34, wallHeight, 0.34]} />
            <meshStandardMaterial color="#ddd1b6" roughness={0.85} />
          </mesh>
        ))
      )}

      {windowZs.map((z, index) => (
        <group key={z}>
          <StainedGlassWindow position={[-4.84, 1.75, z]} rotationY={Math.PI / 2} seed={index} />
          <StainedGlassWindow position={[4.84, 1.75, z]} rotationY={-Math.PI / 2} seed={index + 2} />
        </group>
      ))}

      <StainedGlassWindow position={[-2.5, 2, -5.73]} rectHeight={1.5} seed={4} width={0.95} />
      <StainedGlassWindow position={[2.5, 2, -5.73]} rectHeight={1.5} seed={1} width={0.95} />
      <Crucifix position={[0, 2.3, -5.6]} />

      <pointLight color="#ffdca0" decay={2} distance={8} intensity={1.3} position={[0, 2.9, -1]} />
      <pointLight color="#ffe7bc" decay={2} distance={8} intensity={1.2} position={[0, 2.7, 3]} />
      <hemisphereLight args={["#fff1d2", "#cdb792", 0.6]} />
    </group>
  );
}

function OutdoorVenueFrame({ palette, venueType }: { palette: Palette; venueType: StudioVenueType }) {
  return (
    <group>
      {venueType === "beach" ? (
        <>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -5.1]}>
            <planeGeometry args={[10.4, 1.2]} />
            <meshStandardMaterial color="#2c4456" emissive="#243a4c" emissiveIntensity={0.4} roughness={0.34} />
          </mesh>
          {[-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8].map((xPosition) => (
            <mesh key={xPosition} rotation={[-Math.PI / 2, 0, 0]} position={[xPosition, -0.015, -4.5]}>
              <planeGeometry args={[0.68, 0.08]} />
              <meshStandardMaterial color="#d9ccab" transparent opacity={0.4} roughness={0.44} />
            </mesh>
          ))}
        </>
      ) : null}

      {[-4.25, 4.25].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0, -2.2]}>
          {[-2.2, -0.6, 1.0, 2.6].map((zPosition) => (
            <group key={zPosition} position={[0, 0, zPosition]}>
              <mesh castShadow position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.05, 0.08, 0.6, 10]} />
                <meshStandardMaterial color="#75604a" roughness={0.78} />
              </mesh>
              <mesh castShadow position={[0, 0.78, 0]}>
                <sphereGeometry args={[0.4, 18, 18]} />
                <meshStandardMaterial color={venueType === "beach" ? "#a4b386" : "#74865f"} roughness={0.8} />
              </mesh>
              <mesh castShadow position={[0.12, 1.08, 0.05]}>
                <sphereGeometry args={[0.26, 16, 16]} />
                <meshStandardMaterial color={venueType === "beach" ? "#b3c096" : "#83936c"} roughness={0.8} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -5.55]}>
        <planeGeometry args={[7.8, 0.12]} />
        <meshStandardMaterial color={palette.accent} transparent opacity={0.42} roughness={0.58} />
      </mesh>
    </group>
  );
}

function Altar({ decorScale, palette }: { decorScale: number; palette: Palette }) {
  return (
    <group position={[0, 0, -4.55]}>
      <Dais palette={palette} />
      <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[2.1, 0.52, 0.76]} />
        <meshStandardMaterial color={palette.carpet} roughness={0.66} />
      </mesh>
      <mesh castShadow position={[0, 0.63, 0]}>
        <boxGeometry args={[2.2, 0.05, 0.84]} />
        <meshStandardMaterial color={palette.accent} metalness={0.75} roughness={0.32} />
      </mesh>
      <FlowerCluster palette={palette} position={[-0.85, 0.74, 0.18]} radius={0.22} />
      <FlowerCluster palette={palette} position={[0.85, 0.74, 0.18]} radius={0.22} />
      {[-1.45, 1.45].map((xPosition) => (
        <CandleStand candleColor={palette.candle} key={xPosition} position={[xPosition, 0, 0.18]} scale={decorScale} />
      ))}
    </group>
  );
}

function CandleStand({ candleColor, position, scale = 1 }: { candleColor: string; position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.016, 0.05, 0.6, 8]} />
        <meshStandardMaterial color="#a8833f" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.13, 8]} />
        <meshStandardMaterial color="#efe3c4" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.024, 8, 8]} />
        <meshStandardMaterial color={candleColor} emissive={candleColor} emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CeremonyFocalPoint({ decorScale, palette, venueType }: { decorScale: number; palette: Palette; venueType: StudioVenueType }) {
  if (venueType === "garden" || venueType === "beach") {
    return <CeremonyArch decorScale={decorScale} palette={palette} venueType={venueType} />;
  }

  if (venueType === "hall") {
    return <HallFocalPoint decorScale={decorScale} palette={palette} />;
  }

  if (venueType === "church") {
    return <ChurchAltar decorScale={decorScale} palette={palette} />;
  }

  return <Altar decorScale={decorScale} palette={palette} />;
}

function CeremonyArch({ decorScale, palette, venueType }: { decorScale: number; palette: Palette; venueType: StudioVenueType }) {
  const baseColor = venueType === "beach" ? "#a98f63" : "#5d6a48";

  return (
    <group position={[0, 0, -4.45]} scale={decorScale}>
      <Dais palette={palette} />
      {[-1.05, 1.05].map((xPosition) => (
        <mesh castShadow key={xPosition} position={[xPosition, 0.78, 0]}>
          <cylinderGeometry args={[0.042, 0.055, 1.56, 12]} />
          <meshStandardMaterial color={baseColor} roughness={0.6} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.56, 0]}>
        <torusGeometry args={[1.05, 0.045, 10, 36, Math.PI]} />
        <meshStandardMaterial color={baseColor} roughness={0.6} />
      </mesh>
      <FlowerCluster palette={palette} position={[-1.02, 1.66, 0.05]} radius={0.3} />
      <FlowerCluster palette={palette} position={[1.02, 1.66, 0.05]} radius={0.3} />
      <FlowerCluster palette={palette} position={[-0.62, 2.32, 0.05]} radius={0.2} />
      <FlowerCluster palette={palette} position={[0.62, 2.32, 0.05]} radius={0.2} />
      <FlowerCluster palette={palette} position={[0, 2.58, 0.04]} radius={0.24} />
      <ArchChandelier candleColor={palette.candle} />
    </group>
  );
}

function ArchChandelier({ candleColor }: { candleColor: string }) {
  return (
    <group position={[0, 2.52, 0]}>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.34, 6]} />
        <meshStandardMaterial color="#3a3225" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.17, 0.015, 8, 26]} />
        <meshStandardMaterial color="#b08a45" metalness={0.9} roughness={0.24} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const angle = (index / 6) * Math.PI * 2;

        return (
          <mesh key={index} position={[Math.cos(angle) * 0.17, -0.17, Math.sin(angle) * 0.17]}>
            <sphereGeometry args={[0.023, 8, 8]} />
            <meshStandardMaterial color={candleColor} emissive={candleColor} emissiveIntensity={2.8} toneMapped={false} />
          </mesh>
        );
      })}
      <pointLight color={candleColor} decay={2} distance={3.2} intensity={1.6} position={[0, -0.18, 0]} />
    </group>
  );
}

function Dais({ palette }: { palette: Palette }) {
  return (
    <group position={[0, 0, 0.1]}>
      <mesh receiveShadow position={[0, 0.045, 0]}>
        <cylinderGeometry args={[1.85, 1.95, 0.09, 44]} />
        <meshStandardMaterial color="#37332a" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.72, 1.8, 44]} />
        <meshStandardMaterial color={palette.accent} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function FlowerCluster({ palette, position, radius }: { palette: Palette; position: [number, number, number]; radius: number }) {
  const blossoms: Array<[number, number, number, number, string]> = [
    [0, 0, 0, radius * 0.62, palette.blush],
    [radius * 0.5, radius * 0.18, 0.03, radius * 0.46, palette.carpet],
    [-radius * 0.48, radius * 0.12, 0.02, radius * 0.44, palette.blush],
    [radius * 0.16, -radius * 0.3, 0.04, radius * 0.4, palette.accent],
    [-radius * 0.2, radius * 0.42, -0.02, radius * 0.36, "#7a8a5e"]
  ];

  return (
    <group position={position}>
      {blossoms.map(([x, y, z, size, color], index) => (
        <mesh castShadow key={index} position={[x, y, z]}>
          <sphereGeometry args={[size, 12, 12]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

function HallFocalPoint({ decorScale, palette }: { decorScale: number; palette: Palette }) {
  return (
    <group position={[0, 0, -4.5]} scale={decorScale}>
      <Dais palette={palette} />
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[2.6, 0.3, 0.76]} />
        <meshStandardMaterial color={palette.pew} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[2.7, 0.04, 0.82]} />
        <meshStandardMaterial color={palette.accent} metalness={0.8} roughness={0.3} />
      </mesh>
      <FlowerCluster palette={palette} position={[0, 0.56, 0.16]} radius={0.24} />
      {[-1.5, 1.5].map((xPosition) => (
        <CandleStand candleColor={palette.candle} key={xPosition} position={[xPosition, 0, 0.14]} />
      ))}
    </group>
  );
}

const LANTERN_Z_POSITIONS = [-3.7, -2.1, -0.5, 1.1, 2.7];

function LightingRibbon({ decorScale, palette, venueType }: { decorScale: number; palette: Palette; venueType?: StudioVenueType }) {
  if (venueType === "church") {
    return <ChurchPendantRow candleColor={palette.candle} />;
  }

  const poleHeight = venueType === "garden" || venueType === "beach" ? 1.18 : 1.34;
  const poleColor = venueType === "beach" ? "#8a7757" : "#4d4636";

  return (
    <group>
      {LANTERN_Z_POSITIONS.map((zPosition) => (
        <group key={zPosition} position={[0, 0, zPosition]} scale={decorScale}>
          {[-0.95, 0.95].map((xPosition) => (
            <group key={xPosition} position={[xPosition, 0, 0]}>
              <mesh castShadow position={[0, poleHeight / 2, 0]}>
                <cylinderGeometry args={[0.02, 0.032, poleHeight, 8]} />
                <meshStandardMaterial color={poleColor} metalness={0.35} roughness={0.5} />
              </mesh>
              <mesh position={[0, poleHeight + 0.06, 0]}>
                <sphereGeometry args={[0.06, 14, 14]} />
                <meshStandardMaterial
                  color={palette.candle}
                  emissive={palette.candle}
                  emissiveIntensity={2.4}
                  roughness={0.3}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
          <pointLight color={palette.candle} decay={2} distance={3.4} intensity={1.5} position={[0, poleHeight + 0.25, 0]} />
        </group>
      ))}
      <StringLights candleColor={palette.candle} poleHeight={poleHeight} scale={decorScale} />
    </group>
  );
}

function StringLights({ candleColor, poleHeight, scale }: { candleColor: string; poleHeight: number; scale: number }) {
  const segments = useMemo(() => {
    const built: Array<{ curve: THREE.QuadraticBezierCurve3; key: string }> = [];

    for (const xPosition of [-0.95, 0.95]) {
      for (let index = 0; index < LANTERN_Z_POSITIONS.length - 1; index += 1) {
        const startZ = LANTERN_Z_POSITIONS[index];
        const endZ = LANTERN_Z_POSITIONS[index + 1];
        const top = poleHeight + 0.06;
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(xPosition, top, startZ),
          new THREE.Vector3(xPosition, top - 0.3, (startZ + endZ) / 2),
          new THREE.Vector3(xPosition, top, endZ)
        );

        built.push({ curve, key: `${xPosition}-${index}` });
      }
    }

    return built;
  }, [poleHeight]);

  return (
    <group scale={scale}>
      {segments.map((segment) => (
        <group key={segment.key}>
          <mesh>
            <tubeGeometry args={[segment.curve, 14, 0.0075, 5, false]} />
            <meshStandardMaterial color="#241f14" roughness={0.8} />
          </mesh>
          {[0.18, 0.36, 0.52, 0.68, 0.84].map((t) => {
            const point = segment.curve.getPoint(t);

            return (
              <mesh key={t} position={[point.x, point.y - 0.045, point.z]}>
                <sphereGeometry args={[0.026, 10, 10]} />
                <meshStandardMaterial
                  color={candleColor}
                  emissive={candleColor}
                  emissiveIntensity={2.6}
                  roughness={0.3}
                  toneMapped={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function Pew({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.55, 0.16, 0.34]} />
        <meshStandardMaterial color={palette.pew} roughness={0.42} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.2, -0.14]}>
        <boxGeometry args={[2.55, 0.3, 0.07]} />
        <meshStandardMaterial color={palette.pew} roughness={0.44} />
      </mesh>
      {[-1.26, 1.26].map((xPosition) => (
        <mesh castShadow key={xPosition} position={[xPosition, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.38, 0.36]} />
          <meshStandardMaterial color={palette.pew} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.085, 0.02]}>
        <boxGeometry args={[2.4, 0.025, 0.3]} />
        <meshStandardMaterial color={palette.carpet} roughness={0.78} />
      </mesh>
    </group>
  );
}

function CeremonySeatBlock({ palette, position, venueType }: { palette: Palette; position: [number, number, number]; venueType: StudioVenueType }) {
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: venueType === "hall" ? "#8a7a58" : "#b3955f",        metalness: 0.45,
        roughness: 0.34
      }),
    [venueType]
  );
  const cushionMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.carpet,
        roughness: 0.74
      }),
    [palette.carpet]
  );

  if (venueType === "church") {
    return <Pew palette={palette} position={position} />;
  }

  return (
    <group position={position}>
      {[-0.95, -0.32, 0.32, 0.95].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0, 0]}>
          {[
            [-0.1, -0.1],
            [0.1, -0.1],
            [-0.1, 0.09],
            [0.1, 0.09]
          ].map(([legX, legZ]) => (
            <mesh castShadow key={`${legX}-${legZ}`} material={frameMaterial} position={[legX, -0.06, legZ]}>
              <cylinderGeometry args={[0.011, 0.011, 0.22, 6]} />
            </mesh>
          ))}
          <mesh castShadow material={cushionMaterial} position={[0, 0.06, 0]}>
            <boxGeometry args={[0.25, 0.04, 0.25]} />
          </mesh>
          {[-0.09, 0.09].map((backX) => (
            <mesh castShadow key={backX} material={frameMaterial} position={[backX, 0.21, -0.115]}>
              <cylinderGeometry args={[0.01, 0.01, 0.3, 6]} />
            </mesh>
          ))}
          <mesh castShadow material={frameMaterial} position={[0, 0.34, -0.115]}>
            <boxGeometry args={[0.22, 0.025, 0.02]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function GuestDot({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.085, 12, 12]} />
        <meshStandardMaterial color={palette.guest} emissive={palette.guest} emissiveIntensity={0.12} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.05, 0.062, 0.17, 10]} />
        <meshStandardMaterial color={palette.accent} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function OverflowCluster({ guestCount, palette }: { guestCount: number; palette: Palette }) {
  const markerCount = Math.min(18, Math.ceil(guestCount / 3));

  return (
    <group position={[0, 0.38, 5.05]}>
      {Array.from({ length: markerCount }, (_, index) => {
        const x = -1.6 + (index % 6) * 0.64;
        const z = Math.floor(index / 6) * 0.32;

        return (
          <mesh castShadow key={index} position={[x, 0, z]}>
            <sphereGeometry args={[0.085, 12, 12]} />
            <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.2} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

function ReceptionInterior({
  capacity,
  onMoveObject,
  onSelectObject,
  palette,
  sceneEdits,
  selectedObjectId,
  venueType,
  viewMode
}: {
  capacity: WeddingStudioCapacity;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  palette: Palette;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
}) {
  const tableCount = Math.min(10, Math.max(4, Math.ceil(capacity.visibleGuestMarkers / 14)));
  const tablePositions = buildReceptionTablePositions(tableCount);
  // The reception is held away from the ceremony venue, so a church ceremony
  // still flows into an open evening reception rather than seating dinner
  // tables inside the nave.
  const receptionVenue: StudioVenueType = venueType === "church" ? "garden" : venueType;
  const surface = getVenueSurface(receptionVenue, palette);

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0.25]}>
        <planeGeometry args={[10.2, 12.8]} />
        <meshStandardMaterial color={surface.floor} roughness={0.76} />
      </mesh>

      <VenueBoundary palette={palette} venueType={receptionVenue} viewMode={viewMode} />

      <EditableSceneObject
        objectId="danceFloor"
        onMoveObject={onMoveObject}
        onSelectObject={onSelectObject}
        outlineCenter={[0, 0.9]}
        sceneEdits={sceneEdits}
        selectedObjectId={selectedObjectId}
        size={[2.9, 2.55]}
      >
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0.9]}>
          <planeGeometry args={[2.45, 2.15]} />
          <meshStandardMaterial color={surface.path} roughness={0.62} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0.04, 0.9]}>
          <boxGeometry args={[2.52, 0.08, 2.2]} />
          <meshStandardMaterial color={palette.accent} roughness={0.54} />
        </mesh>
      </EditableSceneObject>

      <EditableSceneObject
        objectId="dinnerTables"
        onMoveObject={onMoveObject}
        onSelectObject={onSelectObject}
        outlineCenter={[0, 0.5]}
        sceneEdits={sceneEdits}
        selectedObjectId={selectedObjectId}
        size={[7.4, 7.4]}
      >
        {tablePositions.map((position, tableIndex) => (
          <ReceptionTable key={tableIndex} palette={palette} position={position} seats={Math.min(10, Math.max(4, capacity.seatsPerRow))} />
        ))}
      </EditableSceneObject>

      <EditableSceneObject
        objectId="bar"
        onMoveObject={onMoveObject}
        onSelectObject={onSelectObject}
        outlineCenter={[-3.65, -4.2]}
        sceneEdits={sceneEdits}
        selectedObjectId={selectedObjectId}
        size={[1.8, 1]}
      >
        <mesh castShadow receiveShadow position={[-3.65, 0.28, -4.2]}>
          <boxGeometry args={[1.4, 0.56, 0.58]} />
          <meshStandardMaterial color={palette.pew} roughness={0.62} />
        </mesh>
      </EditableSceneObject>

      <mesh castShadow receiveShadow position={[3.55, 0.34, -4.1]}>
        <boxGeometry args={[1.6, 0.68, 0.62]} />
        <meshStandardMaterial color={palette.wall} roughness={0.74} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.25, -4.65]}>
        <boxGeometry args={[2.15, 0.5, 0.36]} />
        <meshStandardMaterial color={palette.blush} roughness={0.66} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.55, 0.005, 1.1]}>
        <planeGeometry args={[0.28, 6.9]} />
        <meshStandardMaterial color={palette.candle} transparent opacity={0.5} roughness={0.58} />
      </mesh>

      <LightingRibbon decorScale={0.82} palette={palette} venueType={venueType} />
    </group>
  );
}

function ReceptionTable({
  palette,
  position,
  seats
}: {
  palette: Palette;
  position: [number, number, number];
  seats: number;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.12, 32]} />
        <meshStandardMaterial color="#f6eedb" roughness={0.64} />
      </mesh>
      <mesh castShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.36, 0.4, 0.05, 32]} />
        <meshStandardMaterial color={palette.blush} roughness={0.68} />
      </mesh>
      {Array.from({ length: seats }, (_, index) => {
        const angle = (index / seats) * Math.PI * 2;
        const x = Math.cos(angle) * 0.82;
        const z = Math.sin(angle) * 0.82;

        return <GuestDot key={index} palette={palette} position={[x, 0.26, z]} />;
      })}
    </group>
  );
}

function VenueShellMarkers({ palette, venueType }: { palette: Palette; venueType: StudioVenueType }) {
  const markerColor = venueType === "beach" ? "#d9c39a" : palette.accent;

  return (
    <group>
      {[
        [-3.55, 0.08, -2.2],
        [3.55, 0.08, -2.2],
        [-3.55, 0.08, 2.7],
        [3.55, 0.08, 2.7]
      ].map((position, index) => (
        <mesh castShadow key={index} position={position as [number, number, number]}>
          <boxGeometry args={[0.55, 0.16, 0.55]} />
          <meshStandardMaterial color={markerColor} roughness={0.58} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.3]}>
        <ringGeometry args={[2.55, 2.62, 80]} />
        <meshStandardMaterial color={markerColor} transparent opacity={0.58} />
      </mesh>
    </group>
  );
}

function DetailLayer({ decorScale, palette }: { decorScale: number; palette: Palette }) {
  const petals = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const seed = index * 13.7;
        const x = Math.sin(seed) * 0.78;
        const z = -4 + Math.abs(Math.sin(seed * 1.9)) * 8.4;

        return { key: index, rotation: Math.sin(seed * 3.1) * Math.PI, x, z };
      }),
    []
  );

  return (
    <group scale={decorScale}>
      {[-3.2, -2.1, 2.1, 3.2].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0, -3.25]}>
          <CandleStand candleColor={palette.candle} position={[0, 0, 0]} />
        </group>
      ))}
      <pointLight color={palette.candle} decay={2} distance={4.4} intensity={1.6} position={[-2.6, 1, -3.25]} />
      <pointLight color={palette.candle} decay={2} distance={4.4} intensity={1.6} position={[2.6, 1, -3.25]} />
      {[-2.75, 2.75].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0.48, -4.48]}>
          <FlowerCluster palette={palette} position={[0, 0, 0]} radius={0.32} />
          <mesh castShadow position={[0, -0.35, 0]}>
            <cylinderGeometry args={[0.055, 0.08, 0.55, 12]} />
            <meshStandardMaterial color="#55604a" roughness={0.74} />
          </mesh>
        </group>
      ))}
      {petals.map((petal) => (
        <mesh key={petal.key} position={[petal.x, 0.005, petal.z]} rotation={[-Math.PI / 2, 0, petal.rotation]}>
          <circleGeometry args={[0.035, 7]} />
          <meshStandardMaterial color={palette.blush} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function CameraSetup({
  activeStep,
  cameraOverride = null,
  venueType,
  viewMode,
  zoom = 1
}: {
  activeStep: StudioPlanningStepId;
  cameraOverride?: SceneCameraOverride | null;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
  zoom?: number;
}) {
  const { camera } = useThree();
  const lookTargetRef = useRef(new THREE.Vector3(...getCameraTarget(viewMode, venueType, activeStep)));

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    // A camera override (used by the Preview walkthrough) flies to an explicit
    // waypoint with a gentle living sway; otherwise fall back to the view-mode rig.
    const [rawX, rawY, rawZ] = cameraOverride ? cameraOverride.position : getCameraPosition(viewMode, venueType, activeStep);
    const distanceScale = cameraOverride ? 1 : 1 / zoom;
    const baseX = rawX * distanceScale;
    const baseY = viewMode === "top" && !cameraOverride ? rawY * distanceScale : Math.max(1.05, rawY * distanceScale);
    const baseZ = rawZ * distanceScale;
    const drifting = cameraOverride ? true : viewMode === "3d";
    const swayX = cameraOverride ? 0.18 : 0.6;
    const swayY = cameraOverride ? 0.06 : 0.14;
    const swayZ = cameraOverride ? 0.08 : 0.25;
    const desiredX = baseX + (drifting ? Math.sin(time * 0.07) * swayX : 0);
    const desiredY = baseY + (drifting ? Math.sin(time * 0.05) * swayY : 0);
    const desiredZ = baseZ + (drifting ? Math.cos(time * 0.06) * swayZ : 0);
    const [targetX, targetY, targetZ] = cameraOverride ? cameraOverride.target : getCameraTarget(viewMode, venueType, activeStep);
    // Slower lambda on override so the fly-between-moments reads as a cinematic glide.
    const lambda = cameraOverride ? 1.5 : 2.4;

    camera.position.set(
      THREE.MathUtils.damp(camera.position.x, desiredX, lambda, delta),
      THREE.MathUtils.damp(camera.position.y, desiredY, lambda, delta),
      THREE.MathUtils.damp(camera.position.z, desiredZ, lambda, delta)
    );
    lookTargetRef.current.set(
      THREE.MathUtils.damp(lookTargetRef.current.x, targetX, lambda, delta),
      THREE.MathUtils.damp(lookTargetRef.current.y, targetY, lambda, delta),
      THREE.MathUtils.damp(lookTargetRef.current.z, targetZ, lambda, delta)
    );
    camera.lookAt(lookTargetRef.current);
  });

  return null;
}

function getCameraPosition(viewMode: StudioViewMode, venueType: StudioVenueType, activeStep: StudioPlanningStepId): [number, number, number] {
  // The church is an enclosed nave, so the eye sits inside it looking down the
  // aisle toward the altar (matching the reference one-point perspective). The
  // reception flows to an open venue, so it keeps the standard wide rig.
  if (venueType === "church" && activeStep !== "reception") {
    const churchPositions: Record<StudioViewMode, [number, number, number]> = {
      "3d": [0, 1.95, 5.4],
      guest: [0, 1.45, 4.2],
      top: [0, 11, 0.4],
      walkthrough: [0, 1.85, 4.8]
    };

    return churchPositions[viewMode];
  }

  const positions: Record<StudioViewMode, [number, number, number]> = {
    "3d": [0, 4.5, 8.6],
    guest: [0, 1.35, 5.2],
    top: [0, 10.6, 0.5],
    walkthrough: [2.7, 2.55, 5.7]
  };

  return positions[viewMode];
}

function getCameraTarget(viewMode: StudioViewMode, venueType: StudioVenueType, activeStep: StudioPlanningStepId): [number, number, number] {
  if (venueType === "church" && activeStep !== "reception") {
    const churchTargets: Record<StudioViewMode, [number, number, number]> = {
      "3d": [0, 1.05, -4.4],
      guest: [0, 1, -4.4],
      top: [0, 0, -1.4],
      walkthrough: [0, 1, -4.4]
    };

    return churchTargets[viewMode];
  }

  const targets: Record<StudioViewMode, [number, number, number]> = {
    "3d": [0, 0.42, -1.5],
    guest: [0, 0.85, -1.2],
    top: [0, 0, 0.2],
    walkthrough: [0, 0.5, -1.5]
  };

  return targets[viewMode];
}

function buildReceptionTablePositions(tableCount: number): Array<[number, number, number]> {
  const allPositions: Array<[number, number, number]> = [
    [-2.75, 0.23, -2.6],
    [2.75, 0.23, -2.6],
    [-2.85, 0.23, -1.05],
    [2.85, 0.23, -1.05],
    [-2.85, 0.23, 1.25],
    [2.85, 0.23, 1.25],
    [-2.35, 0.23, 2.9],
    [2.35, 0.23, 2.9],
    [-0.95, 0.23, 3.65],
    [0.95, 0.23, 3.65]
  ];

  return allPositions.slice(0, tableCount);
}

function buildGuestMarkers(capacity: WeddingStudioCapacity): GuestMarker[] {
  const seatsPerSide = capacity.aisleSeatsPerRow;

  return Array.from({ length: capacity.visibleGuestMarkers }, (_, index) => {
    const row = Math.floor(index / capacity.seatsPerRow);
    const seat = index % capacity.seatsPerRow;
    const isLeft = seat < seatsPerSide;
    const seatOnSide = isLeft ? seat : seat - seatsPerSide;
    const xBase = isLeft ? -2.88 : 1.16;
    const x = xBase + seatOnSide * 0.42;
    const z = -2.4 + row * 0.62;

    return {
      id: `guest-${index}`,
      position: [x, 0.49, z]
    };
  });
}

function getVenueSurface(venueType: StudioVenueType, palette: Palette) {
  const surfaces: Record<StudioVenueType, { aisleWidth: number; floor: string; path: string }> = {
    beach: {
      aisleWidth: 1.25,
      floor: "#dcc89e",
      path: "#f1e6cb"
    },
    church: {
      aisleWidth: 1.05,
      floor: palette.floor,
      path: palette.carpet
    },
    garden: {
      aisleWidth: 1.18,
      floor: "#8fa06a",
      path: "#ece1c8"
    },
    hall: {
      aisleWidth: 1.2,
      floor: "#cdbd9d",
      path: "#ece0c2"
    }
  };

  return surfaces[venueType];
}

function formatVenueLabel(venueType: StudioVenueType) {
  return venueOptions.find((option) => option.value === venueType)?.label ?? "Venue";
}

function getSceneSignal(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, venueType: StudioVenueType) {
  const labels: Record<StudioPlanningStepId, string> = {
    ceremony: `${capacity.renderedRows} ceremony rows`,
    budget: "Budget level visualized",
    guests: `${capacity.visibleGuestMarkers} guest markers shown`,
    preview: "Preview perspective ready",
    reception: "Reception flow shown",
    share: "Summary layer ready",
    timeline: "Day flow connected",
    venue: `${formatVenueLabel(venueType)} model`,
    vision: "Guided first plan"
  };

  return labels[activeStep];
}

function getSceneCaption(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, venueType: StudioVenueType) {
  if (capacity.capacityStatus === "over_capacity" && (activeStep === "guests" || activeStep === "ceremony" || activeStep === "reception")) {
    return `The ${formatVenueLabel(venueType).toLowerCase()} scene is full; overflow guests need a larger plan.`;
  }

  const captions: Record<StudioPlanningStepId, string> = {
    ceremony: "Rows, aisle, focal point, and guest density stay connected.",
    budget: "Budget level changes the visual intensity without requiring manual object edits.",
    guests: "Guest density updates immediately as the list changes.",
    preview: "Use view controls to inspect the plan from the angle that matches your next decision.",
    reception: "Tables, dance floor, bar, and service path are staged together.",
    share: "The visual plan is ready to become a partner, planner, or vendor summary.",
    timeline: "The 3D scene stays connected to the day flow and handoff moments.",
    venue: "Choose the scene type, then let the system generate the first layout.",
    vision: "Start from a complete generated plan instead of a blank canvas."
  };

  return captions[activeStep];
}
