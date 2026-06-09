"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  studioStepCopy,
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

type CeremonySceneProps = {
  activeStep: StudioPlanningStepId;
  budgetLevel: StudioBudgetLevel;
  capacity: WeddingStudioCapacity;
  colorDirection: StudioColorDirection;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  style: StudioStyle;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
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
    accent: "#d8c59a",
    blush: "#ead8cf",
    candle: "#f5dfad",
    carpet: "#f1ede4",
    floor: "#efe7d8",
    guest: "#2f3430",
    pew: "#6f5b44",
    wall: "#f6f0e6"
  },
  modern: {
    accent: "#c8d0c8",
    blush: "#d9ddd8",
    candle: "#f3e7c2",
    carpet: "#edf0ec",
    floor: "#e8e8e4",
    guest: "#252b2a",
    pew: "#4d5552",
    wall: "#f7f7f3"
  },
  romantic: {
    accent: "#e7beb7",
    blush: "#edd4d0",
    candle: "#ffe1b5",
    carpet: "#f5ece8",
    floor: "#efe1dc",
    guest: "#3b3030",
    pew: "#6e504b",
    wall: "#fbf1ee"
  },
  rustic: {
    accent: "#c9b27f",
    blush: "#e1d2bd",
    candle: "#f0d39b",
    carpet: "#ece2d3",
    floor: "#dfd1be",
    guest: "#34302a",
    pew: "#6a5138",
    wall: "#f4eadc"
  }
};

const colorDirectionOverrides: Record<StudioColorDirection, Partial<Palette>> = {
  blue: {
    accent: "#8aa0a6",
    blush: "#dce6e9",
    carpet: "#eef3f3"
  },
  blush: {
    accent: "#d7a59b",
    blush: "#f0d5cf",
    carpet: "#f5ebe8"
  },
  bold: {
    accent: "#9a6935",
    blush: "#d7b7a6",
    carpet: "#eadfd0"
  },
  green: {
    accent: "#7f8f70",
    blush: "#dfe8d8",
    carpet: "#eef4ea"
  },
  neutral: {},
  warm: {
    accent: "#c29a63",
    blush: "#ead4c1",
    carpet: "#f2e5d5"
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
  viewMode
}: CeremonySceneProps) {
  const stageCopy = studioStepCopy[activeStep];
  const palette = useMemo(() => createPalette(style, colorDirection), [colorDirection, style]);

  return (
    <section className="ceremony-scene-shell" aria-label="Interactive 3D ceremony visualization">
      <div className="ceremony-scene-toolbar">
        <div>
          <span>3D Wedding Stage</span>
          <strong>{stageCopy.sceneTitle}</strong>
        </div>
        <span className="scene-status-label" data-tone={capacity.capacityStatus === "over_capacity" ? "high" : capacity.capacityStatus === "full" ? "medium" : "confirmed"}>
          {getSceneBadge(activeStep, capacity, venueType)}
        </span>
      </div>

      <div className="ceremony-canvas-frame">
        <Canvas camera={{ fov: 42, near: 0.1, position: getCameraPosition(viewMode) }} dpr={[1, 1.8]} shadows={{ type: THREE.PCFShadowMap }}>
          <CameraSetup viewMode={viewMode} />
          <color args={["#fbf8f1"]} attach="background" />
          <fog args={["#fbf8f1", 10, 21]} attach="fog" />
          <ambientLight intensity={1.15} />
          <directionalLight castShadow intensity={2.1} position={[3, 7, 4]} shadow-mapSize={[1024, 1024]} />
          <pointLight color="#f6d8a8" intensity={budgetLevel === "signature" ? 16 : 10} position={[0, 3.2, -3.4]} />
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
          />
        </Canvas>
      </div>

      <div className="ceremony-scene-caption" aria-live="polite">
        <span>{getSceneSignal(activeStep, capacity, venueType)}</span>
        <strong>{getSceneCaption(activeStep, capacity, venueType)}</strong>
      </div>
    </section>
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
  venueType
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
}) {
  const groupRef = useRef<THREE.Group>(null);
  const guestMarkers = useMemo(() => buildGuestMarkers(capacity), [capacity]);
  const visibleRows = activeStep === "venue" ? 0 : activeStep === "budget" ? Math.min(8, capacity.renderedRows) : capacity.renderedRows;
  const rowIndexes = useMemo(() => Array.from({ length: visibleRows }, (_, index) => index), [visibleRows]);
  const decorScale = budgetLevel === "signature" ? 1.2 : budgetLevel === "elevated" ? 1 : 0.72;
  const showGuests = ["ceremony", "guests", "preview", "share", "timeline"].includes(activeStep);
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
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            size={[1.35, 11.8]}
          >
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0.45]}>
              <planeGeometry args={[surface.aisleWidth, 11.8]} />
              <meshStandardMaterial color={surface.path} roughness={0.82} />
            </mesh>
          </EditableSceneObject>

          <VenueBoundary palette={palette} venueType={venueType} />
          {activeStep === "venue" ? <VenueShellMarkers palette={palette} venueType={venueType} /> : null}

          {activeStep !== "venue" ? (
            <EditableSceneObject
              objectId="focalPoint"
              onMoveObject={onMoveObject}
              onSelectObject={onSelectObject}
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

            {showGuests ? guestMarkers.map((marker) => <GuestDot key={marker.id} palette={palette} position={marker.position} />) : null}
            {showGuests && capacity.overflowGuests > 0 ? <OverflowCluster guestCount={capacity.overflowGuests} palette={palette} /> : null}
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
  sceneEdits,
  selectedObjectId,
  size
}: {
  children: ReactNode;
  objectId: StudioSceneObjectId;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
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
      {isSelected ? <SelectionOutline size={size} /> : null}
    </group>
  );
}

function SelectionOutline({ size }: { size: [number, number] }) {
  const [width, depth] = size;
  const color = "#b69a5b";

  return (
    <group position={[0, 0.035, 0.3]}>
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

function VenueBoundary({ palette, venueType }: { palette: Palette; venueType: StudioVenueType }) {
  if (venueType === "garden" || venueType === "beach") {
    return <OutdoorVenueFrame palette={palette} venueType={venueType} />;
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
        <mesh key={xPosition} position={[xPosition, 1.38, -5.62]}>
          <boxGeometry args={[0.72, 1.08, 0.08]} />
          <meshStandardMaterial color="#fffaf0" emissive={palette.candle} emissiveIntensity={0.18} roughness={0.55} />
        </mesh>
      ))}
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
            <meshStandardMaterial color="#bcd8df" roughness={0.62} />
          </mesh>
          {[-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8].map((xPosition) => (
            <mesh key={xPosition} rotation={[-Math.PI / 2, 0, 0]} position={[xPosition, -0.015, -4.5]}>
              <planeGeometry args={[0.68, 0.08]} />
              <meshStandardMaterial color="#fff8ee" transparent opacity={0.58} roughness={0.44} />
            </mesh>
          ))}
        </>
      ) : null}

      {[-4.25, 4.25].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0.32, -2.2]}>
          {[-2.2, -0.6, 1.0, 2.6].map((zPosition) => (
            <mesh castShadow key={zPosition} position={[0, 0, zPosition]}>
              <sphereGeometry args={[0.42, 18, 18]} />
              <meshStandardMaterial color={venueType === "beach" ? "#a9b890" : "#7f8f70"} roughness={0.76} />
            </mesh>
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
      <mesh castShadow receiveShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[2.25, 0.55, 0.82]} />
        <meshStandardMaterial color="#fff8ee" roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 0.78, -0.18]}>
        <boxGeometry args={[1.8, 0.08, 0.12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.5} />
      </mesh>
      {[-1.45, 1.45].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0.45, 0.05]} scale={decorScale}>
          <mesh castShadow>
            <cylinderGeometry args={[0.09, 0.12, 0.72, 18]} />
            <meshStandardMaterial color="#7b876d" roughness={0.72} />
          </mesh>
          <mesh castShadow position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.24, 18, 18]} />
            <meshStandardMaterial color={palette.blush} roughness={0.74} />
          </mesh>
        </group>
      ))}
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

  return <Altar decorScale={decorScale} palette={palette} />;
}

function CeremonyArch({ decorScale, palette, venueType }: { decorScale: number; palette: Palette; venueType: StudioVenueType }) {
  const baseColor = venueType === "beach" ? "#d9c39a" : "#7d8a63";

  return (
    <group position={[0, 0, -4.45]} scale={decorScale}>
      <mesh castShadow position={[-1.05, 0.85, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 1.7, 16]} />
        <meshStandardMaterial color={baseColor} roughness={0.64} />
      </mesh>
      <mesh castShadow position={[1.05, 0.85, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 1.7, 16]} />
        <meshStandardMaterial color={baseColor} roughness={0.64} />
      </mesh>
      <mesh castShadow position={[0, 1.7, 0]}>
        <boxGeometry args={[2.18, 0.09, 0.12]} />
        <meshStandardMaterial color={baseColor} roughness={0.64} />
      </mesh>
      {[-0.78, 0, 0.78].map((xPosition) => (
        <mesh castShadow key={xPosition} position={[xPosition, 1.78, 0.03]}>
          <sphereGeometry args={[0.22, 18, 18]} />
          <meshStandardMaterial color={palette.blush} roughness={0.72} />
        </mesh>
      ))}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.32]}>
        <planeGeometry args={[2.7, 0.9]} />
        <meshStandardMaterial color="#fff8ee" transparent opacity={0.58} roughness={0.76} />
      </mesh>
    </group>
  );
}

function HallFocalPoint({ decorScale, palette }: { decorScale: number; palette: Palette }) {
  return (
    <group position={[0, 0, -4.5]} scale={decorScale}>
      <mesh castShadow receiveShadow position={[0, 0.16, 0]}>
        <boxGeometry args={[2.8, 0.32, 0.82]} />
        <meshStandardMaterial color={palette.pew} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 0.72, -0.16]}>
        <boxGeometry args={[2.2, 0.08, 0.12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.52} />
      </mesh>
      <mesh castShadow position={[-1.35, 0.46, 0.16]}>
        <cylinderGeometry args={[0.04, 0.06, 0.82, 14]} />
        <meshStandardMaterial color={palette.candle} emissive={palette.candle} emissiveIntensity={0.45} roughness={0.36} />
      </mesh>
      <mesh castShadow position={[1.35, 0.46, 0.16]}>
        <cylinderGeometry args={[0.04, 0.06, 0.82, 14]} />
        <meshStandardMaterial color={palette.candle} emissive={palette.candle} emissiveIntensity={0.45} roughness={0.36} />
      </mesh>
    </group>
  );
}

function LightingRibbon({ decorScale, palette, venueType }: { decorScale: number; palette: Palette; venueType?: StudioVenueType }) {
  const height = venueType === "garden" || venueType === "beach" ? 1.72 : 2.15;

  return (
    <group>
      {[-3.7, -2.1, -0.5, 1.1, 2.7].map((zPosition) => (
        <group key={zPosition} position={[0, height, zPosition]} scale={decorScale}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={palette.candle} emissive={palette.candle} emissiveIntensity={0.95} roughness={0.35} />
          </mesh>
          <pointLight color={palette.candle} distance={3.2} intensity={0.75} />
        </group>
      ))}
    </group>
  );
}

function Pew({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.55, 0.18, 0.32]} />
        <meshStandardMaterial color={palette.pew} roughness={0.62} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.18, -0.13]}>
        <boxGeometry args={[2.55, 0.28, 0.08]} />
        <meshStandardMaterial color={palette.pew} roughness={0.64} />
      </mesh>
    </group>
  );
}

function CeremonySeatBlock({ palette, position, venueType }: { palette: Palette; position: [number, number, number]; venueType: StudioVenueType }) {
  if (venueType === "church") {
    return <Pew palette={palette} position={position} />;
  }

  return (
    <group position={position}>
      {[-0.95, -0.32, 0.32, 0.95].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0, 0]}>
          <mesh castShadow receiveShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.28, 0.12, 0.28]} />
            <meshStandardMaterial color="#fff8ee" roughness={0.66} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.2, -0.1]}>
            <boxGeometry args={[0.28, 0.28, 0.06]} />
            <meshStandardMaterial color={venueType === "hall" ? palette.pew : palette.accent} roughness={0.62} />
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
        <sphereGeometry args={[0.095, 14, 14]} />
        <meshStandardMaterial color={palette.guest} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, -0.13, 0]}>
        <cylinderGeometry args={[0.055, 0.065, 0.18, 12]} />
        <meshStandardMaterial color={palette.accent} roughness={0.56} />
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
  venueType
}: {
  capacity: WeddingStudioCapacity;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  palette: Palette;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  venueType: StudioVenueType;
}) {
  const tableCount = Math.min(10, Math.max(4, Math.ceil(capacity.visibleGuestMarkers / 14)));
  const tablePositions = buildReceptionTablePositions(tableCount);
  const surface = getVenueSurface(venueType, palette);

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0.25]}>
        <planeGeometry args={[10.2, 12.8]} />
        <meshStandardMaterial color={surface.floor} roughness={0.76} />
      </mesh>

      <VenueBoundary palette={palette} venueType={venueType} />

      <EditableSceneObject
        objectId="danceFloor"
        onMoveObject={onMoveObject}
        onSelectObject={onSelectObject}
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
        <meshStandardMaterial color="#fff8ee" roughness={0.64} />
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
  return (
    <group scale={decorScale}>
      {[-3.2, -2.1, 2.1, 3.2].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0.24, -3.25]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.5, 14]} />
            <meshStandardMaterial color={palette.candle} emissive={palette.candle} emissiveIntensity={0.8} roughness={0.35} />
          </mesh>
          <pointLight color={palette.candle} distance={2.4} intensity={0.75} />
        </group>
      ))}
      {[-2.75, 2.75].map((xPosition) => (
        <group key={xPosition} position={[xPosition, 0.48, -4.48]}>
          <mesh castShadow>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color={palette.blush} roughness={0.72} />
          </mesh>
          <mesh castShadow position={[0, -0.35, 0]}>
            <cylinderGeometry args={[0.055, 0.08, 0.55, 16]} />
            <meshStandardMaterial color="#7b876d" roughness={0.74} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CameraSetup({ viewMode }: { viewMode: StudioViewMode }) {
  const { camera } = useThree();

  useEffect(() => {
    const position = getCameraPosition(viewMode);

    camera.position.set(...position);
    camera.lookAt(0, viewMode === "guest" ? 0.75 : 0.34, viewMode === "walkthrough" ? -1.1 : -0.35);
  }, [camera, viewMode]);

  return null;
}

function getCameraPosition(viewMode: StudioViewMode): [number, number, number] {
  const positions: Record<StudioViewMode, [number, number, number]> = {
    "3d": [0, 6.7, 9.8],
    guest: [0, 1.42, 5.4],
    top: [0, 10.6, 0.5],
    walkthrough: [2.9, 3.35, 6.4]
  };

  return positions[viewMode];
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
      floor: "#eadbc0",
      path: "#fff3df"
    },
    church: {
      aisleWidth: 1.05,
      floor: palette.floor,
      path: palette.carpet
    },
    garden: {
      aisleWidth: 1.18,
      floor: "#dfe6d8",
      path: "#f3ead8"
    },
    hall: {
      aisleWidth: 1.2,
      floor: "#e7e3dc",
      path: "#efe6d6"
    }
  };

  return surfaces[venueType];
}

function formatVenueLabel(venueType: StudioVenueType) {
  return venueOptions.find((option) => option.value === venueType)?.label ?? "Venue";
}

function getSceneBadge(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, venueType: StudioVenueType) {
  const labels: Record<StudioPlanningStepId, string> = {
    ceremony: `${capacity.renderedRows} rows`,
    budget: "Spend impact",
    guests: `${capacity.visibleGuestMarkers} guests`,
    preview: "Live preview",
    reception: `${Math.min(10, Math.max(4, Math.ceil(capacity.visibleGuestMarkers / 14)))} tables`,
    share: "Brief ready",
    timeline: "Flow layer",
    venue: formatVenueLabel(venueType),
    vision: "First plan"
  };

  return labels[activeStep];
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
