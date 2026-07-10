"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useGLTF, useTexture } from "@react-three/drei";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Volume2, VolumeX } from "lucide-react";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { LoopSubdivision } from "three-subdivide";
import { SceneBootGate, preloadHdr } from "@/components/wedding-studio/scene-boot";
import { assetPath } from "@/lib/asset-path";
import { useTranslation } from "@/lib/i18n";
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

// Poly Haven CC0 HDRIs (see public/hdr/CREDITS.md): a real sunlit church
// interior lights the church venue; the warm lounge lights the open venues.
const CHURCH_HDR_URL = assetPath("/hdr/church_museum_2k.hdr");
const INTERIOR_HDR_URL = assetPath("/hdr/lythwood_room_1k.hdr");

// Real CC0 scanned PBR sets (Poly Haven, see public/textures/CREDITS.md) that
// replace the flat single-colour church surfaces — the #1 "gamey" tell. Each
// set is diffuse + normal + roughness at 1k.
type SurfaceTextureSet = { map: string; normalMap: string; roughnessMap: string };
type SurfaceMaps = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
const CHURCH_TEXTURES: Record<"wall" | "floor" | "pew", SurfaceTextureSet> = {
  wall: {
    map: assetPath("/textures/wall_diff.jpg"),
    normalMap: assetPath("/textures/wall_nor_gl.jpg"),
    roughnessMap: assetPath("/textures/wall_rough.jpg")
  },
  floor: {
    map: assetPath("/textures/floor_diff.jpg"),
    normalMap: assetPath("/textures/floor_nor_gl.jpg"),
    roughnessMap: assetPath("/textures/floor_rough.jpg")
  },
  pew: {
    map: assetPath("/textures/pew_diff.jpg"),
    normalMap: assetPath("/textures/pew_nor_gl.jpg"),
    roughnessMap: assetPath("/textures/pew_rough.jpg")
  }
};

if (typeof window !== "undefined") {
  Object.values(CHURCH_TEXTURES).forEach((set) => useTexture.preload(Object.values(set)));
}

// Loads a PBR set and returns per-use CLONES with independent tiling — cloning
// shares the GPU image (one upload) but lets each surface set its own repeat
// without fighting over the shared drei cache.
function useSurfaceMaps(set: SurfaceTextureSet, repeatX: number, repeatY: number): SurfaceMaps {
  const maps = useTexture(set) as SurfaceMaps;

  return useMemo(() => {
    const tile = (texture: THREE.Texture, srgb: boolean) => {
      const clone = texture.clone();
      clone.wrapS = THREE.RepeatWrapping;
      clone.wrapT = THREE.RepeatWrapping;
      clone.repeat.set(repeatX, repeatY);
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
  }, [maps, repeatX, repeatY]);
}

// Polished stone nave floor (marble PBR). color keeps the palette tint so the
// floor still responds to the couple's style, multiplied over the scan.
function TexturedGround({ color, position, size }: { color: string; position: [number, number, number]; size: [number, number] }) {
  const maps = useSurfaceMaps(CHURCH_TEXTURES.floor, size[0] / 1.4, size[1] / 1.4);

  return (
    <mesh position={position} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial {...maps} color={color} envMapIntensity={1.2} metalness={0.05} normalScale={new THREE.Vector2(0.5, 0.5)} roughness={0.9} />
    </mesh>
  );
}

// Plastered-stone church wall. One shared repeat across all wall segments so
// the tiling stays consistent; polygonOffset preserved so flush-mounted
// windows/reredos don't z-fight.
function StoneWall({ args, color, position }: { args: [number, number, number]; color: string; position: [number, number, number] }) {
  const maps = useSurfaceMaps(CHURCH_TEXTURES.wall, 5, 2.6);

  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial {...maps} color={color} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} roughness={1} />
    </mesh>
  );
}

export type SceneCameraOverride = {
  position: [number, number, number];
  target: [number, number, number];
};

export type CeremonyFirstPerson = "bride" | "groom" | null;

type CoupleHeads = { groom: THREE.Vector3; bride: THREE.Vector3; arrived: boolean };

type CeremonySceneProps = {
  activeStep: StudioPlanningStepId;
  autoProcessional?: boolean;
  budgetLevel: StudioBudgetLevel;
  cameraOverride?: SceneCameraOverride | null;
  firstPerson?: CeremonyFirstPerson;
  capacity: WeddingStudioCapacity;
  colorDirection: StudioColorDirection;
  highQuality?: boolean;
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
    ambientColor: "#f4ebd8",
    ambientIntensity: 0.85,
    fogColor: "#f1e9da",
    fogFar: 44,
    fogNear: 20,
    hemisphereGround: "#a89570",
    hemisphereIntensity: 1.15,
    hemisphereSky: "#f6e9cd",
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
  autoProcessional,
  cameraOverride = null,
  firstPerson = null,
  highQuality = true,
  lighting = "dusk",
  zoom = 1
}: CeremonySceneProps) {
  const palette = useMemo(() => createPalette(style, colorDirection), [colorDirection, style]);
  const preset = lightingPresets[lighting];
  const isDay = lighting === "day";
  const { t } = useTranslation();
  const [processionalPlaying, setProcessionalPlaying] = useState(false);
  const [processionalKey, setProcessionalKey] = useState(0);
  // The singer is off in the clean preview; its toggle no longer clutters the
  // 3D canvas overlay (kept in the model for the full studio editor).
  const [showSinger] = useState(false);
  // Classic wedding processional music (public-domain Pachelbel Canon in D),
  // started by the couple's own gesture of pressing Play — never autoplayed.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = 0.55;
    if (processionalPlaying) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Autoplay can still be blocked in edge cases; the scene just plays silently.
      });
    } else {
      audio.pause();
    }
  }, [processionalPlaying, processionalKey]);
  // Live head positions of the couple, written by the Processional each frame and
  // read by CameraSetup for the first-person bride/groom view.
  const coupleHeadsRef = useRef<CoupleHeads>({
    groom: new THREE.Vector3(-0.34, FIRST_PERSON_EYE_Y, PROCESSION_START_Z),
    bride: new THREE.Vector3(0.34, FIRST_PERSON_EYE_Y, PROCESSION_START_Z),
    arrived: false
  });
  // The processional is a hands-on ceremony rehearsal, so only offer it on the
  // interactive church view (not the auto-flown Preview walkthrough).
  const showCeremonyControls =
    (venueType === "church" || venueType === "garden" || venueType === "beach") &&
    !cameraOverride &&
    activeStep !== "venue" &&
    activeStep !== "reception";

  return (
    <section className="ceremony-scene-shell" aria-label="Interactive 3D ceremony visualization">
      <div
        className="ceremony-canvas-frame"
        // Back the canvas with the current sky so a cold start or a dropped
        // frame during the day→dusk transition reveals scene-matched light,
        // never a loading flash.
        style={{ background: `linear-gradient(180deg, ${preset.hemisphereSky}, ${preset.fogColor} 60%)` }}
      >
        <SceneBootGate>
        <Canvas
          camera={{ far: 90, fov: 40, near: 0.3, position: getCameraPosition(viewMode, venueType, activeStep) }}
          dpr={highQuality ? [1, 2] : [1, 1.3]}
          gl={{ preserveDrawingBuffer: true }}
          // three 0.184 removed PCFSoftShadowMap (it silently downgraded and
          // logged a deprecation warning every frame) — PCF is what actually ran.
          shadows={{ type: THREE.PCFShadowMap }}
        >
          <CameraSetup activeStep={activeStep} cameraOverride={cameraOverride} firstPerson={firstPerson} headsRef={coupleHeadsRef} venueType={venueType} viewMode={viewMode} zoom={zoom} />
          <color args={[preset.fogColor]} attach="background" />
          <fog args={[preset.fogColor, preset.fogNear, preset.fogFar]} attach="fog" />
          <SkyDome mode={lighting} />
          {venueType === "garden" || venueType === "beach" ? <HillSilhouettes /> : null}
          {/* Directional-over-fill: the church runs on a low ambient base so
              corners darken and the candle pools read — the chiaroscuro of the
              reference. Open venues keep their brighter presets. */}
          <hemisphereLight args={[preset.hemisphereSky, preset.hemisphereGround, venueType === "church" ? 0.38 : preset.hemisphereIntensity]} />
          <ambientLight color={preset.ambientColor} intensity={venueType === "church" ? 0.2 : preset.ambientIntensity} />
          <directionalLight color={isDay ? "#e4cfa4" : "#aebdd6"} intensity={preset.rimIntensity} position={[-6, 10, -7]} />
          <directionalLight
            castShadow
            color="#ffd9a6"
            intensity={venueType === "church" ? 2.9 : preset.keyIntensity}
            position={[4.5, 9, 5.5]}
            shadow-bias={-0.00015}
            shadow-camera-bottom={-8}
            shadow-camera-far={32}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={10}
            shadow-mapSize={[2048, 2048]}
            shadow-normalBias={0.05}
          />
          <pointLight
            color="#ffca8c"
            decay={2}
            distance={10}
            intensity={
              venueType === "church"
                ? isDay
                  ? 1.5
                  : 9
                : isDay
                  ? 7
                  : budgetLevel === "signature"
                    ? 32
                    : 22
            }
            position={[0, 3.1, -3.6]}
          />
          {/* Real CC0 interior HDRIs for warm image-based lighting + true material
              reflections, loaded imperatively via PMREM so nothing suspends (drei's
              <Environment files> suspended and crashed the postprocessing
              EffectComposer). The church is lit by an actual sunlit church interior
              (Poly Haven "church_museum") so reflections match the room the viewer
              is standing in; open venues keep the warm lounge probe. */}
          <HdrEnvironment
            intensity={venueType === "church" ? (isDay ? 0.62 : 0.34) : isDay ? 0.72 : 0.45}
            url={venueType === "church" ? CHURCH_HDR_URL : INTERIOR_HDR_URL}
          />
          {venueType === "church" && activeStep !== "venue" ? <LightShafts isDay={isDay} /> : null}
          {/* Skip the contact-shadow plane in the church: it's a second
              floor-parallel plane whose grazing edge z-fights the flat stone
              floor (the side strips by the pews blink). The directional key
              light already casts real shadows from the pews, guests and columns,
              so the church stays grounded without it. Open-air venues keep it. */}
          {venueType === "church" ? null : (
            <ContactShadows blur={2.4} color={isDay ? "#5a5238" : "#050602"} far={5} opacity={isDay ? 0.34 : 0.55} position={[0, -0.03, 0.1]} resolution={384} scale={11} />
          )}
          {/* The film look lives here: contact occlusion (N8AO), restrained bloom
              on flames only, a whisper of grain, and AgX tone mapping LAST — the
              composer disables the renderer's own tone curve, so without the
              ToneMapping pass the scene ships ungraded. */}
          {highQuality ? (
            <EffectComposer multisampling={4}>
              <N8AO aoRadius={0.8} distanceFalloff={0.75} halfRes intensity={3} quality="medium" />
              <Bloom intensity={isDay ? 0.32 : 0.68} luminanceSmoothing={0.2} luminanceThreshold={isDay ? 1.15 : 1.05} mipmapBlur />
              <Vignette darkness={isDay ? 0.28 : 0.55} eskil={false} offset={0.3} />
              <Noise opacity={0.05} premultiply />
              <ToneMapping mode={ToneMappingMode.AGX} />
              {/* AgX rolls off highlights beautifully but desaturates — this pass
                  brings the warm ivory/candle tones back and adds a little depth
                  so the scene reads rich, not pastel-flat. */}
              <BrightnessContrast brightness={-0.015} contrast={0.09} />
              <HueSaturation saturation={0.18} />
            </EffectComposer>
          ) : (
            <EffectComposer multisampling={4}>
              <Bloom intensity={isDay ? 0.32 : 0.68} luminanceSmoothing={0.2} luminanceThreshold={isDay ? 1.15 : 1.05} mipmapBlur />
              <Vignette darkness={isDay ? 0.28 : 0.55} eskil={false} offset={0.3} />
              <ToneMapping mode={ToneMappingMode.AGX} />
              <BrightnessContrast brightness={-0.015} contrast={0.09} />
              <HueSaturation saturation={0.18} />
            </EffectComposer>
          )}
          {isDay ? null : <GlowHalo />}
          <DustMotes intensity={isDay ? 0.18 : 0.42} />
          <WeddingStageInterior
            activeStep={activeStep}
            budgetLevel={budgetLevel}
            capacity={capacity}
            coupleHeadsRef={coupleHeadsRef}
            firstPerson={firstPerson}
            highQuality={highQuality}
            onMoveObject={onMoveObject}
            onSelectObject={onSelectObject}
            palette={palette}
            processionalKey={processionalKey}
            processionalPlaying={autoProcessional ?? processionalPlaying}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            showSinger={showSinger}
            venueType={venueType}
            viewMode={viewMode}
          />
        </Canvas>
        </SceneBootGate>

        {showCeremonyControls ? (
          <div className="ceremony-processional-controls">
            <button onClick={() => setProcessionalPlaying((playing) => !playing)} type="button">
              {processionalPlaying ? t("Pause") : t("Play processional")}
            </button>
            <button
              onClick={() => {
                setProcessionalKey((key) => key + 1);
                setProcessionalPlaying(false);
              }}
              type="button"
            >
              {t("Restart")}
            </button>
            <button
              aria-label={muted ? t("Unmute music") : t("Mute music")}
              className="ceremony-mute-button"
              data-active={!muted}
              onClick={() => {
                const audio = audioRef.current;
                if (audio) {
                  audio.muted = !audio.muted;
                  setMuted(audio.muted);
                }
              }}
              type="button"
            >
              {muted ? <VolumeX aria-hidden="true" size={16} /> : <Volume2 aria-hidden="true" size={16} />}
            </button>
          </div>
        ) : null}

        {/* Processional music lives outside the WebGL canvas; it only plays on
            an explicit Play press (a user gesture), so autoplay is never an issue. */}
        <audio loop preload="auto" ref={audioRef} src={assetPath("/audio/processional.mp3")} />
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
  coupleHeadsRef,
  firstPerson = null,
  highQuality = true,
  onMoveObject,
  onSelectObject,
  palette,
  processionalKey,
  processionalPlaying,
  sceneEdits,
  selectedObjectId,
  showSinger,
  venueType,
  viewMode
}: {
  activeStep: StudioPlanningStepId;
  budgetLevel: StudioBudgetLevel;
  capacity: WeddingStudioCapacity;
  coupleHeadsRef?: { current: CoupleHeads };
  firstPerson?: CeremonyFirstPerson;
  highQuality?: boolean;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  palette: Palette;
  processionalKey: number;
  processionalPlaying: boolean;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  showSinger: boolean;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
}) {
  const guestMarkers = useMemo(() => buildGuestMarkers(capacity), [capacity]);
  const visibleRows = activeStep === "venue" ? 0 : activeStep === "budget" ? Math.min(8, capacity.renderedRows) : capacity.renderedRows;
  const rowIndexes = useMemo(() => Array.from({ length: visibleRows }, (_, index) => index), [visibleRows]);
  // Church + open-air ceremonies (garden/beach) all seat a real congregation
  // and run the processional; only the venue shell differs.
  const ceremonyVenue = venueType === "church" || venueType === "garden" || venueType === "beach";
  const seatedGuests = useMemo(
    () => (ceremonyVenue ? buildChurchSeatedGuests(visibleRows, capacity.visibleGuestMarkers) : []),
    [capacity.visibleGuestMarkers, ceremonyVenue, visibleRows]
  );
  const decorScale = budgetLevel === "signature" ? 1.2 : budgetLevel === "elevated" ? 1 : 0.72;
  const showGuests = ["ceremony", "guests", "share", "timeline"].includes(activeStep);
  const surface = getVenueSurface(venueType, palette);

  // Buildings do not move: the old whole-scene sway rotated the architecture
  // itself, a subconscious "floating game level" tell. Camera motion (a slow
  // dolly in CameraSetup) now carries all the life instead.
  return (
    <group position={[0, 0, 0.25]}>
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
          {venueType === "church" ? (
            <Suspense
              fallback={
                <mesh position={[0, -0.04, 0.25]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[9.8, 12.8]} />
                  <meshStandardMaterial color={surface.floor} envMapIntensity={1.15} metalness={0.1} roughness={0.46} />
                </mesh>
              }
            >
              <TexturedGround color={surface.floor} position={[0, -0.04, 0.25]} size={[9.8, 12.8]} />
            </Suspense>
          ) : (
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0.25]}>
              <planeGeometry args={[9.8, 12.8]} />
              {/* Polished stone: low roughness + a touch of metalness so the floor
                  catches a soft warm reflection of the HDRI + candlelight, like the
                  reference's glossy nave floor. */}
              <meshStandardMaterial color={surface.floor} envMapIntensity={1.15} metalness={0.1} roughness={0.46} />
            </mesh>
          )}

          <EditableSceneObject
            objectId="ceremonyPath"
            onMoveObject={onMoveObject}
            onSelectObject={onSelectObject}
            outlineCenter={[0, 0.45]}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            size={[1.35, 11.8]}
          >
            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0.45]}>
              <planeGeometry args={[surface.aisleWidth, 11.8]} />
              {/* The runner is a decal on the floor: a clear gap plus a forward
                  polygonOffset so it always wins the depth test (no flicker at
                  grazing angles). */}
              <meshStandardMaterial color={surface.path} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} roughness={0.82} />
            </mesh>
          </EditableSceneObject>

          <VenueBoundary palette={palette} venueType={venueType} viewMode={viewMode} />
          {activeStep === "venue" ? <VenueShellMarkers palette={palette} venueType={venueType} /> : null}

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
            <Suspense fallback={null}>
              {rowIndexes.map((rowIndex) => {
                const z = -2.4 + rowIndex * 0.62;

                return (
                  <group key={rowIndex}>
                    <CeremonySeatBlock palette={palette} position={[-1.82, 0.18, z]} venueType={venueType} />
                    <CeremonySeatBlock palette={palette} position={[1.82, 0.18, z]} venueType={venueType} />
                  </group>
                );
              })}
            </Suspense>

            {/* Candle stands lining the aisle (every other row) — the warm
                candlelit aisle from the reference. Emissive + bloom only, no extra
                lights, to stay mobile-safe. */}
            {ceremonyVenue
              ? rowIndexes
                  .filter((rowIndex) => rowIndex % 2 === 0)
                  .map((rowIndex) => {
                    const z = -2.4 + rowIndex * 0.62;

                    return (
                      <group key={`aisle-candle-${rowIndex}`}>
                        <CandleStand candleColor={palette.candle} position={[-0.82, 0, z]} scale={decorScale * 0.82} />
                        <CandleStand candleColor={palette.candle} position={[0.82, 0, z]} scale={decorScale * 0.82} />
                        {/* Each lantern pools warm light on the stone beneath it —
                            the pooled-candlelight gradient of the reference aisle. */}
                        <CandleFloorPool position={[-0.82, 0.004, z]} />
                        <CandleFloorPool position={[0.82, 0.004, z]} />
                        {/* White floral posies nestled beside each candle so the
                            aisle reads as a continuous candlelit-floral border. */}
                        <FlowerCluster palette={palette} position={[-0.92, 0.12, z]} radius={0.16} />
                        <FlowerCluster palette={palette} position={[0.92, 0.12, z]} radius={0.16} />
                      </group>
                    );
                  })
              : null}

            {ceremonyVenue
              ? activeStep !== "venue"
                ? (
                  <Suspense fallback={null}>
                    <ChurchCongregation highQuality={highQuality} seats={seatedGuests} />
                  </Suspense>
                )
                : null
              : showGuests
                ? guestMarkers.map((marker) => <GuestDot key={marker.id} palette={palette} position={marker.position} />)
                : null}
            {showGuests && !ceremonyVenue && capacity.overflowGuests > 0 ? (
              <OverflowCluster guestCount={capacity.overflowGuests} palette={palette} />
            ) : null}
          </EditableSceneObject>

          {ceremonyVenue && activeStep !== "venue" ? (
            <Suspense fallback={null}>
              <Celebrant />
              <Processional headsRef={coupleHeadsRef} hideFigure={firstPerson} key={processionalKey} playing={processionalPlaying} />
              {showSinger ? <Singer /> : null}
            </Suspense>
          ) : null}

          {activeStep === "budget" || activeStep === "preview" ? <DetailLayer decorScale={decorScale} palette={palette} /> : null}
        </>
      )}
    </group>
  );
}

function EditableSceneObject({
  children,
  objectId,
  sceneEdits
}: {
  children: ReactNode;
  objectId: StudioSceneObjectId;
  sceneEdits: StudioSceneEdits;
  // Accepted for caller compatibility but no longer used — the scene is a
  // placed preview, not a draggable editor.
  onMoveObject?: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject?: (objectId: StudioSceneObjectId) => void;
  outlineCenter?: [number, number];
  selectedObjectId?: StudioSceneObjectId;
  size?: [number, number];
}) {
  // The 3D scene is a calm preview, not an editor — objects are placed, not draggable.
  const offset = sceneEdits[objectId];

  return <group position={[offset.x, 0, offset.z]}>{children}</group>;
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

const STAINED_GLASS_COLORS = ["#294367", "#79332d", "#94703a", "#345844", "#3d3459", "#2c565d"];

const LEAD_COLOR = "#33301f";

// Draws a leaded stained-glass panel to a canvas: a diamond "quarry" lattice of
// backlit jewel cells separated by dark lead cames, plus a soft light bloom.
// Seeded so each window differs. Used as both map and emissiveMap so the glass
// glows like real backlit glass.
function createStainedGlassTexture(seed: number): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const jewels = ["#7db0d6", "#c8536a", "#e0b64e", "#5aa06e", "#9a6bb0", "#d98a45", "#3f7fa8", "#b8455a"];
  const pick = (n: number) => jewels[((seed + n) % jewels.length + jewels.length) % jewels.length];

  if (ctx) {
    ctx.fillStyle = "#15120c";
    ctx.fillRect(0, 0, w, h);

    const cell = 26;
    let n = 0;
    for (let row = -1; row * (cell / 2) < h + cell; row += 1) {
      const y = row * (cell / 2);
      const offset = row % 2 === 0 ? 0 : cell / 2;
      for (let x = -cell; x < w + cell; x += cell) {
        const cx = x + offset;
        ctx.beginPath();
        ctx.moveTo(cx, y - cell / 2);
        ctx.lineTo(cx + cell / 2, y);
        ctx.lineTo(cx, y + cell / 2);
        ctx.lineTo(cx - cell / 2, y);
        ctx.closePath();
        ctx.fillStyle = pick(n + row * 3);
        ctx.globalAlpha = 0.72 + ((n * 7) % 10) / 34;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#0e0b07";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        n += 1;
      }
    }

    // soft backlight bloom through the glass
    const glow = ctx.createRadialGradient(w / 2, h * 0.42, 8, w / 2, h * 0.42, h * 0.58);
    glow.addColorStop(0, "rgba(255,246,220,0.34)");
    glow.addColorStop(1, "rgba(255,246,220,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

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
  const frameHeight = rectHeight + halfWidth;
  const glassColor = (offset: number) => STAINED_GLASS_COLORS[((seed + offset) % STAINED_GLASS_COLORS.length + STAINED_GLASS_COLORS.length) % STAINED_GLASS_COLORS.length];
  // Real leaded-glass look: a jewel-toned quarry lattice with dark lead lines
  // and a soft backlight, drawn to a canvas — far richer than a few flat panes.
  const texture = useMemo(() => createStainedGlassTexture(seed), [seed]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* stone reveal */}
      <mesh position={[0, halfWidth / 2, -0.08]}>
        <boxGeometry args={[width + 0.24, frameHeight + 0.26, 0.12]} />
        <meshStandardMaterial color="#cabfa0" roughness={0.9} />
      </mesh>
      {/* leaded jewel glass — one textured, gently backlit plane */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, rectHeight]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.9} emissiveMap={texture} map={texture} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* arched top: lead backing + jewel + rose medallion */}
      <mesh position={[0, rectHeight / 2, -0.01]}>
        <circleGeometry args={[halfWidth + 0.01, 22, 0, Math.PI]} />
        <meshStandardMaterial color={LEAD_COLOR} roughness={0.82} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, rectHeight / 2, 0]}>
        <circleGeometry args={[halfWidth - 0.025, 22, 0, Math.PI]} />
        <meshStandardMaterial color={glassColor(3)} emissive={glassColor(3)} emissiveIntensity={0.34} roughness={0.45} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, rectHeight / 2 + halfWidth * 0.4, 0.014]}>
        <circleGeometry args={[halfWidth * 0.3, 18]} />
        <meshStandardMaterial color={glassColor(5)} emissive={glassColor(5)} emissiveIntensity={0.46} roughness={0.4} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, rectHeight / 2 + halfWidth * 0.4, 0.012]}>
        <ringGeometry args={[halfWidth * 0.3, halfWidth * 0.35, 18]} />
        <meshStandardMaterial color={LEAD_COLOR} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ChurchCeiling({ wallTopY, color }: { wallTopY: number; color: string }) {
  const halfW = 4.95;
  const ridgeY = wallTopY + 1.9;
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
      {/* A slim ridge in the ceiling tone — the dark cross-beams are gone so the
          vault reads as a smooth, pale plaster ceiling like the reference. */}
      <mesh position={[0, ridgeY, 0]}>
        <boxGeometry args={[0.1, 0.1, depth]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
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

// A tall white + greenery floral statement on a pale urn, flanking the altar to
// frame the cross — the lush florals from the reference church.
function ChurchAltarFloral({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.92, 14]} />
        <meshStandardMaterial color="#e6dcc6" roughness={0.55} />
      </mesh>
      <FlowerCluster palette={palette} position={[0, 1.08, 0]} radius={0.4} />
      <FlowerCluster palette={palette} position={[0.2, 0.96, 0.05]} radius={0.26} />
      <FlowerCluster palette={palette} position={[-0.2, 0.94, 0.05]} radius={0.24} />
      <mesh castShadow position={[0.16, 0.74, 0.06]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#6f7f56" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[-0.17, 0.7, 0.05]}>
        <sphereGeometry args={[0.11, 8, 8]} />
        <meshStandardMaterial color="#7a8a5e" roughness={0.85} />
      </mesh>
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
      <ChurchAltarFloral palette={palette} position={[-1.28, 0, 0.16]} />
      <ChurchAltarFloral palette={palette} position={[1.28, 0, 0.16]} />
      <Suspense fallback={null}>
        <AltarArrangement palette={palette} position={[-0.86, 0.655, 0.24]} />
        <AltarArrangement palette={palette} position={[0.86, 0.655, 0.24]} />
        {[-1.5, 1.5].map((x) => (
          <AltarCandle key={x} position={[x, 0.1, 0]} scale={decorScale} />
        ))}
      </Suspense>
    </group>
  );
}

function ChurchPendant({ candleColor, position }: { candleColor: string; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 2.6, 6]} />
        <meshStandardMaterial color="#2c2519" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.3, 8]} />
        <meshStandardMaterial color="#6e5326" metalness={0.78} roughness={0.34} />
      </mesh>
      <FlickerFlame base={2} color={candleColor} position={[0, -0.02, 0]} radius={0.075} seed={position[0] * 2.9 + position[2] * 1.7} />
    </group>
  );
}

function ChurchPendantRow({ candleColor }: { candleColor: string }) {
  return (
    <group>
      {[-3.2, -1, 1.2, 3.2].map((z) =>
        [-3.4, 3.4].map((x) => <ChurchPendant candleColor={candleColor} key={`${x}-${z}`} position={[x, 3.55, z]} />)
      )}
    </group>
  );
}

// Real low-poly guests (CC0, baked to a static seated pose — see
// public/models/CREDITS.md) instanced across the pews so the whole
// congregation is a handful of draw calls.
// Seated guests baked (sitting pose, see CREDITS.md) in varied skin/hair/dress
// combinations so the congregation reads as a real, mixed crowd.
const CONGREGATION_MODELS = [
  "/models/cg_man_0.glb",
  "/models/cg_man_1.glb",
  "/models/cg_man_2.glb",
  "/models/cg_woman_0.glb",
  "/models/cg_woman_1.glb",
  "/models/cg_woman_2.glb",
  "/models/cg_dress_0.glb",
  "/models/cg_dress_1.glb",
  "/models/cg_dress_2.glb"
].map(assetPath);

// The baked meshes stand ~4 source units tall; scale to a seated guest that
// reads correctly at church scale.
const CONGREGATION_SCALE = 0.205;

if (typeof window !== "undefined") {
  CONGREGATION_MODELS.forEach((url) => useGLTF.preload(url));
  // The HDR environment is part of the boot too — preloading it here means the
  // boot gate holds the Canvas until the scene can light itself correctly.
  preloadHdr(CHURCH_HDR_URL);
}

type CongregationSeat = {
  id: string;
  position: [number, number, number];
  variant: number;
  rotationY: number;
};

function CongregationVariant({ highQuality = true, seats, url }: { highQuality?: boolean; seats: CongregationSeat[]; url: string }) {
  const { scene } = useGLTF(url);
  const geometry = useMemo(() => {
    let found: THREE.BufferGeometry | null = null;
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh && !found) {
        found = mesh.geometry;
      }
    });
    if (!found) {
      return null;
    }
    // Round the blocky low-poly silhouette with one Loop subdivision pass. These
    // baked meshes are NON-INDEXED, so computeVertexNormals alone was a no-op
    // (per-triangle only) — LoopSubdivision finds neighbours by hashing vertex
    // position, so it genuinely adds curvature to limbs/torso/head. It clones
    // internally (never mutating the GLTF cache), keeps the COLOR_0 palette, and
    // the crowd is a single instanced draw per variant regardless of tri count.
    // Skipped on the low-quality (mobile) path to keep the vertex load down.
    const smoothed = highQuality
      ? LoopSubdivision.modify(found as THREE.BufferGeometry, 1, { maxTriangles: 28000 })
      : (found as THREE.BufferGeometry).clone();
    if (!highQuality) {
      smoothed.computeVertexNormals();
    }
    // Mute the baked skin/hair/clothing colours toward a cohesive, softly warm
    // palette so the crowd reads editorial and designed instead of a saturated
    // game crowd — individual variation stays, just calmer.
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
  }, [scene, highQuality]);
  // Matte, non-metallic skin/cloth so figures read as soft sculpture, not
  // plastic game props.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 }), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    seats.forEach((seat, index) => {
      euler.set(0, seat.rotationY, 0);
      quaternion.setFromEuler(euler);
      position.set(seat.position[0], seat.position[1], seat.position[2]);
      scale.setScalar(CONGREGATION_SCALE);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [seats]);

  if (!geometry || seats.length === 0) {
    return null;
  }

  return <instancedMesh args={[geometry, material, seats.length]} castShadow frustumCulled={false} ref={meshRef} />;
}

function ChurchCongregation({ highQuality = true, seats }: { highQuality?: boolean; seats: CongregationSeat[] }) {
  return (
    <group>
      {CONGREGATION_MODELS.map((url, variant) => (
        <CongregationVariant highQuality={highQuality} key={url} seats={seats.filter((seat) => seat.variant === variant)} url={url} />
      ))}
    </group>
  );
}

// Real CC0 dais props (Poly Pizza, see CREDITS.md). Loaded as-is and
// size-normalized at runtime so we never depend on the model's authored scale.
const DAIS_PROP_MODELS = ["/models/altar_vase.glb", "/models/altar_candlestick.glb"].map(assetPath);

if (typeof window !== "undefined") {
  DAIS_PROP_MODELS.forEach((url) => useGLTF.preload(url));
}

function useNormalizedModel(url: string, targetHeight: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const factor = targetHeight / Math.max(size.y, 0.001);
    clone.scale.setScalar(factor);
    // center on x/z, drop the base to the group origin
    clone.position.set(-((box.min.x + box.max.x) / 2) * factor, -box.min.y * factor, -((box.min.z + box.max.z) / 2) * factor);
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
      }
    });
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [scene, targetHeight]);
}

// A real gold vase (CC0) holding the soft ivory blooms — reads as a wedding
// arrangement, where the bare CC0 flower meshes looked like loose stems.
function AltarArrangement({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  const vase = useNormalizedModel(assetPath("/models/altar_vase.glb"), 0.22);
  return (
    <group position={position}>
      <primitive object={vase} />
      <FlowerCluster palette={palette} position={[0, 0.2, 0]} radius={0.17} />
    </group>
  );
}

function AltarCandle({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const model = useNormalizedModel(assetPath("/models/altar_candlestick.glb"), 0.56);
  return (
    <group position={position} scale={scale}>
      <primitive object={model} />
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#ffd99a" emissive="#ffb95e" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <pointLight color="#ffca8c" decay={2} distance={2.4} intensity={2} position={[0, 0.72, 0]} />
    </group>
  );
}

// --- Ceremony figures: priest, processional couple, optional singer ---------
// Animated CC0 characters (Quaternius, see CREDITS.md), cloned + recolored per
// role and driven by their Walk/Idle clips. Only a handful, so skinned
// animation is well within budget.
const FIGURE_SUIT = assetPath("/models/figure_suit.glb");
const FIGURE_WOMAN = assetPath("/models/figure_woman.glb");

if (typeof window !== "undefined") {
  useGLTF.preload(FIGURE_SUIT);
  useGLTF.preload(FIGURE_WOMAN);
}

const FIGURE_SCALE = 0.235;

type Recolor = Record<string, string>;
// figure_suit materials: Shirt (jacket), Pants, Details (dress shirt), TieTexture.
const GROOM_COLORS: Recolor = { Details: "#efe9dd", Pants: "#1f2027", Shirt: "#1f2027", TieTexture: "#6a4a54" };
const BRIDE_COLORS: Recolor = { Dress: "#f7f3ea", Shoes: "#e9dfcf" };
const PRIEST_COLORS: Recolor = { Details: "#16161a", Pants: "#16161a", Shirt: "#16161a", TieTexture: "#16161a" };
const SINGER_COLORS: Recolor = { Dress: "#7d3b46" };

function AnimatedFigure({ clip, recolor, rotationY = Math.PI, url }: { clip: "walk" | "idle"; recolor?: Recolor; rotationY?: number; url: string }) {
  const { animations, scene } = useGLTF(url);
  const object = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = true;
      // Smooth the couple/officiant the same way as the congregation so the
      // close-up hero figures aren't faceted. Clone the geometry first (skinned
      // clones share it) so we never touch the shared GLTF cache.
      if (mesh.geometry) {
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.computeVertexNormals();
      }
      const recolorOne = (material: THREE.Material) => {
        const cloned = (material as THREE.MeshStandardMaterial).clone();
        const next = recolor?.[cloned.name];
        if (next) {
          cloned.color = new THREE.Color(next);
        }
        return cloned;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolorOne) : recolorOne(mesh.material);
    });
    return copy;
  }, [recolor, scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(object), [object]);

  useEffect(() => {
    const match = animations.find((animation) => animation.name.toLowerCase().includes(clip));
    if (!match) {
      return undefined;
    }

    const action = mixer.clipAction(match);
    action.reset().fadeIn(0.3).play();
    return () => {
      action.fadeOut(0.3);
    };
  }, [animations, clip, mixer]);

  useFrame((_, delta) => mixer.update(delta));

  return <primitive object={object} rotation={[0, rotationY, 0]} scale={FIGURE_SCALE} />;
}

function Celebrant() {
  // The officiant waits at the altar, facing the congregation.
  return (
    <group position={[0, 0, -3.55]}>
      <AnimatedFigure clip="idle" recolor={PRIEST_COLORS} rotationY={0} url={FIGURE_SUIT} />
    </group>
  );
}

function MicrophoneStand() {
  return (
    <group>
      <mesh castShadow position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.012, 0.016, 1.04, 8]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 1.05, 0.02]}>
        <sphereGeometry args={[0.042, 12, 12]} />
        <meshStandardMaterial color="#17171a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.02, 14]} />
        <meshStandardMaterial color="#2a2a2e" metalness={0.6} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Singer() {
  return (
    <group position={[1.75, 0, -3.05]} rotation={[0, -0.55, 0]}>
      <AnimatedFigure clip="idle" recolor={SINGER_COLORS} rotationY={0.35} url={FIGURE_WOMAN} />
      <group position={[0.2, 0, 0.16]}>
        <MicrophoneStand />
      </group>
    </group>
  );
}

const PROCESSION_START_Z = 4.4;
const PROCESSION_END_Z = -2.55;
const PROCESSION_DURATION = 13;
const FIRST_PERSON_EYE_Y = 1.5;

function BridalGown() {
  // A long ivory skirt from the waist to the floor — reads as a gown and hides
  // the walk-cycle leg movement underneath.
  return (
    <mesh castShadow position={[0, 0.27, 0]}>
      <cylinderGeometry args={[0.1, 0.27, 0.56, 20]} />
      <meshStandardMaterial color="#f6efe2" roughness={0.78} />
    </mesh>
  );
}

function Bouquet() {
  // A small ivory + blush posy the bride carries at her hands.
  const blooms: Array<[number, number, number, number]> = [
    [0, 0, 0, 0.058],
    [0.05, 0.02, 0.012, 0.044],
    [-0.05, 0.012, 0.01, 0.044],
    [0.012, 0.05, -0.012, 0.04],
    [-0.01, -0.012, 0.05, 0.038]
  ];

  return (
    <group position={[0.05, 0.5, 0.17]}>
      {blooms.map(([x, y, z, r], index) => (
        <mesh castShadow key={index} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 10]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#f4ece0" : "#e7cdcf"} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, -0.08, 0.02]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
        <meshStandardMaterial color="#c9b489" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Re-mounted (via React key) to restart, so progress + pose reset cleanly.
function Processional({
  headsRef,
  hideFigure = null,
  playing
}: {
  headsRef?: { current: CoupleHeads };
  hideFigure?: CeremonyFirstPerson;
  playing: boolean;
}) {
  const progress = useRef(0);
  const arrivedRef = useRef(false);
  const groomRef = useRef<THREE.Group>(null);
  const brideRef = useRef<THREE.Group>(null);
  const [arrived, setArrived] = useState(false);

  useFrame((_, delta) => {
    if (playing && progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / PROCESSION_DURATION);
    }
    if (progress.current >= 1 && !arrivedRef.current) {
      arrivedRef.current = true;
      setArrived(true);
    }

    const p = progress.current;
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const z = PROCESSION_START_Z + (PROCESSION_END_Z - PROCESSION_START_Z) * eased;
    // Face down the aisle while walking; turn to face each other on arrival
    // (groom looks right toward the bride, bride looks left toward the groom).
    const groomTarget = arrivedRef.current ? Math.PI / 2 : Math.PI;
    const brideTarget = arrivedRef.current ? (3 * Math.PI) / 2 : Math.PI;
    const turn = Math.min(1, delta * 3);
    if (groomRef.current) {
      groomRef.current.position.z = z;
      groomRef.current.rotation.y += (groomTarget - groomRef.current.rotation.y) * turn;
    }
    if (brideRef.current) {
      brideRef.current.position.z = z;
      brideRef.current.rotation.y += (brideTarget - brideRef.current.rotation.y) * turn;
    }
    // Publish the couple's eye positions so the first-person camera can ride along,
    // even for a hidden figure (whose group ref is null).
    if (headsRef) {
      headsRef.current.groom.set(-0.34, FIRST_PERSON_EYE_Y, z);
      headsRef.current.bride.set(0.34, FIRST_PERSON_EYE_Y, z);
      headsRef.current.arrived = arrivedRef.current;
    }
  });

  const moving = playing && !arrived;

  return (
    <>
      {hideFigure !== "groom" ? (
        <group position={[-0.34, 0, PROCESSION_START_Z]} ref={groomRef} rotation={[0, Math.PI, 0]}>
          <AnimatedFigure clip={moving ? "walk" : "idle"} recolor={GROOM_COLORS} rotationY={0} url={FIGURE_SUIT} />
        </group>
      ) : null}
      {hideFigure !== "bride" ? (
        <group position={[0.34, 0, PROCESSION_START_Z]} ref={brideRef} rotation={[0, Math.PI, 0]}>
          <AnimatedFigure clip={moving ? "walk" : "idle"} recolor={BRIDE_COLORS} rotationY={0} url={FIGURE_WOMAN} />
          <BridalGown />
          <Bouquet />
        </group>
      ) : null}
    </>
  );
}

function buildChurchSeatedGuests(visibleRows: number, maxGuests: number): CongregationSeat[] {
  const result: CongregationSeat[] = [];
  const seatOffsets = [-0.86, -0.29, 0.29, 0.86];
  let count = 0;

  for (let row = 0; row < visibleRows; row += 1) {
    const z = -2.4 + row * 0.62;

    for (const sideCenter of [-1.82, 1.82]) {
      for (let seat = 0; seat < seatOffsets.length; seat += 1) {
        if (count >= maxGuests) {
          return result;
        }

        const seed = row * 4 + seat * 5 + (sideCenter < 0 ? 0 : 7);
        result.push({
          id: `church-guest-${row}-${sideCenter}-${seat}`,
          position: [sideCenter + seatOffsets[seat], 0, z + 0.04],
          variant: seed % CONGREGATION_MODELS.length,
          rotationY: Math.PI + ((seed % 5) - 2) * 0.05
        });
        count += 1;
      }
    }
  }

  return result;
}

// Soft volumetric "god-ray" beams streaming in from the side windows — additive,
// low-opacity cones (no postprocessing pass, so it stays cheap + can't destabilize
// the composer). Tilted down + inward across the nave, like the reference.
function LightShaft({ isDay, position, sign }: { isDay: boolean; position: [number, number, number]; sign: number }) {
  return (
    <group position={position} rotation={[0.15, 0, sign * 0.6]}>
      <mesh position={[0, -2.85, 0]}>
        <coneGeometry args={[1, 6, 22, 1, true]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={isDay ? "#fff3d6" : "#ffcf94"}
          depthWrite={false}
          opacity={isDay ? 0.14 : 0.07}
          side={THREE.DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

function LightShafts({ isDay }: { isDay: boolean }) {
  const shaftZs = [-3.2, -0.7, 1.8];

  return (
    <group>
      {shaftZs.map((z) => (
        <group key={z}>
          <LightShaft isDay={isDay} position={[-4.5, 3.3, z]} sign={1} />
          <LightShaft isDay={isDay} position={[4.5, 3.3, z]} sign={-1} />
        </group>
      ))}
    </group>
  );
}

function ChurchNave({ palette, viewMode }: { palette: Palette; viewMode: StudioViewMode }) {
  // Real naves tower over the congregation — at eye height the ceiling ratio is
  // what separates "church" from "scale model". Everything below derives from
  // this so the room stays coherent.
  const wallHeight = 5.6;
  const windowY = wallHeight * 0.46;
  const windowZs = [-3.2, -0.7, 1.8];
  const columnZs = [-4.5, -1.95, 0.55, 3.1];
  // The 2D plan view looks straight down, so the vaulted ceiling would hide
  // everything — drop it (and keep the open nave readable from above).
  const showCeiling = viewMode !== "top";

  return (
    <group>
      {/* Scanned plaster-stone walls (fall back to the flat colour while the
          texture set streams in). polygonOffset biases the walls back in the
          depth buffer so flush windows/reredos never z-fight. */}
      <Suspense
        fallback={
          <group>
            {[-4.95, 4.95].map((x) => (
              <mesh key={x} position={[x, wallHeight / 2, 0.1]} receiveShadow>
                <boxGeometry args={[0.2, wallHeight, 12.4]} />
                <meshStandardMaterial color={palette.wall} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} roughness={0.92} />
              </mesh>
            ))}
            <mesh position={[0, (wallHeight + 1.9) / 2, -5.85]} receiveShadow>
              <boxGeometry args={[10.1, wallHeight + 1.9, 0.22]} />
              <meshStandardMaterial color={palette.wall} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} roughness={0.92} />
            </mesh>
          </group>
        }
      >
        {[-4.95, 4.95].map((x) => (
          <StoneWall args={[0.2, wallHeight, 12.4]} color={palette.wall} key={x} position={[x, wallHeight / 2, 0.1]} />
        ))}
        <StoneWall args={[10.1, wallHeight + 1.9, 0.22]} color={palette.wall} position={[0, (wallHeight + 1.9) / 2, -5.85]} />
      </Suspense>

      {/* Reredos: a framed backdrop behind the altar so the crucifix reads
          against depth instead of a blown-out wall. */}
      <mesh position={[0, 2.2, -5.72]}>
        <boxGeometry args={[2.95, 4.4, 0.08]} />
        <meshStandardMaterial color={palette.accent} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh receiveShadow position={[0, 2.2, -5.69]}>
        <boxGeometry args={[2.6, 4, 0.1]} />
        <meshStandardMaterial color="#d3bf97" roughness={0.82} />
      </mesh>

      {showCeiling ? <ChurchCeiling color={palette.wall} wallTopY={wallHeight} /> : null}

      {[-4.6, 4.6].map((x) =>
        columnZs.map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            {/* Round, slightly tapered stone columns instead of square posts —
                a rounded shaft with a simple base + capital reads far less
                "blocky" at eye level. */}
            <mesh castShadow position={[0, wallHeight / 2, 0]}>
              <cylinderGeometry args={[0.19, 0.22, wallHeight, 20]} />
              <meshStandardMaterial color="#ddd1b6" roughness={0.85} />
            </mesh>
            {[0.06, wallHeight - 0.06].map((cy) => (
              <mesh castShadow key={cy} position={[0, cy, 0]}>
                <cylinderGeometry args={[0.28, 0.28, 0.12, 20]} />
                <meshStandardMaterial color="#d7cbaf" roughness={0.86} />
              </mesh>
            ))}
          </group>
        ))
      )}

      {windowZs.map((z, index) => (
        <group key={z}>
          <StainedGlassWindow position={[-4.79, windowY, z]} rectHeight={2.4} rotationY={Math.PI / 2} seed={index} />
          <StainedGlassWindow position={[4.79, windowY, z]} rectHeight={2.4} rotationY={-Math.PI / 2} seed={index + 2} />
        </group>
      ))}

      <StainedGlassWindow position={[-2.5, 3.4, -5.7]} rectHeight={2.1} seed={4} width={0.95} />
      <StainedGlassWindow position={[2.5, 3.4, -5.7]} rectHeight={2.1} seed={1} width={0.95} />
      <Crucifix position={[0, 2.95, -5.6]} />

      <pointLight color="#ffdca0" decay={2} distance={9} intensity={1.5} position={[0, 3.6, -1]} />
      <pointLight color="#ffe7bc" decay={2} distance={9} intensity={1.4} position={[0, 3.4, 3]} />
      <hemisphereLight args={["#fff1d2", "#cdb792", 0.34]} />
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

// A living candle flame: per-flame phase + layered sine "noise" around 5-13Hz so
// no two candles pulse together — static identical emitters are the signature of
// procedural duplication, real flames never hold still.
function FlickerFlame({
  base,
  color,
  position,
  radius,
  seed
}: {
  base: number;
  color: string;
  position: [number, number, number];
  radius: number;
  seed: number;
}) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const flicker =
      Math.sin(time * 9.4 + seed * 7.13) * 0.5 + Math.sin(time * 12.9 + seed * 3.71) * 0.32 + Math.sin(time * 5.2 + seed * 11.3) * 0.18;

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = base * (1 + flicker * 0.15);
    }
  });

  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={base} ref={materialRef} toneMapped={false} />
    </mesh>
  );
}

// The warm pool a lantern throws on the floor beneath it — an additive disc that
// grounds the candle in the room instead of leaving it floating as a bright dot.
function CandleFloorPool({ position, strength = 1 }: { position: [number, number, number]; strength?: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.52, 22]} />
      <meshBasicMaterial
        blending={THREE.AdditiveBlending}
        color="#ffbe78"
        depthWrite={false}
        opacity={0.085 * strength}
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-3}
        toneMapped={false}
        transparent
      />
    </mesh>
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
      <FlickerFlame base={2.2} color={candleColor} position={[0, 0.75, 0]} radius={0.024} seed={position[0] * 3.7 + position[2] * 1.31} />
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
          <FlickerFlame
            base={2.2}
            color={candleColor}
            key={index}
            position={[Math.cos(angle) * 0.17, -0.17, Math.sin(angle) * 0.17]}
            radius={0.023}
            seed={index * 4.3}
          />
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
  // Many small individual blooms on a loose, asymmetric silhouette with greenery
  // breaking the edges — reads as a florist's arrangement rather than one solid
  // white ball. Sizes stay small (<=0.26 r) so no single sphere dominates.
  const blossoms: Array<[number, number, number, number, string]> = [
    // greenery base + a few sprigs poking past the blooms
    [radius * 0.02, -radius * 0.34, -0.04, radius * 0.24, "#6f7f56"],
    [-radius * 0.46, -radius * 0.28, -0.05, radius * 0.2, "#7a8a5e"],
    [radius * 0.5, -radius * 0.22, -0.05, radius * 0.18, "#6f7f56"],
    [-radius * 0.34, radius * 0.5, -0.02, radius * 0.13, "#7a8a5e"],
    [radius * 0.4, radius * 0.46, -0.02, radius * 0.12, "#6f7f56"],
    // ivory / blush blooms, varied size + depth for a broken silhouette
    [0, radius * 0.02, radius * 0.12, radius * 0.24, "#f5efe4"],
    [radius * 0.34, radius * 0.06, radius * 0.08, radius * 0.2, palette.blush],
    [-radius * 0.36, radius * 0.04, radius * 0.08, radius * 0.19, "#efe6d6"],
    [radius * 0.16, radius * 0.34, radius * 0.06, radius * 0.18, palette.blush],
    [-radius * 0.2, radius * 0.32, radius * 0.06, radius * 0.17, "#f3ece0"],
    [0, radius * 0.54, radius * 0.02, radius * 0.15, "#f5efe4"],
    [radius * 0.42, radius * 0.26, 0.02, radius * 0.15, "#e7d8cf"],
    [-radius * 0.42, radius * 0.24, 0.02, radius * 0.14, palette.blush],
    [radius * 0.26, -radius * 0.16, radius * 0.1, radius * 0.17, "#efe6d6"],
    [-radius * 0.28, -radius * 0.14, radius * 0.1, radius * 0.16, "#f3ece0"],
    [0, -radius * 0.02, radius * 0.22, radius * 0.14, palette.blush]
  ];

  return (
    <group position={position}>
      {blossoms.map(([x, y, z, size, color], index) => (
        <mesh castShadow key={index} position={[x, y, z]}>
          <sphereGeometry args={[size, 16, 16]} />
          <meshStandardMaterial color={color} roughness={0.82} />
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

// Flat pew — the never-suspends fallback, so the pews are ALWAYS visible even
// while the wood texture streams in or when the guest count changes the rows.
function PewBody({ palette, position, wood }: { palette: Palette; position: [number, number, number]; wood?: SurfaceMaps }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.55, 0.16, 0.34]} />
        <meshStandardMaterial {...wood} color={palette.pew} roughness={0.72} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.2, -0.14]}>
        <boxGeometry args={[2.55, 0.3, 0.07]} />
        <meshStandardMaterial {...wood} color={palette.pew} roughness={0.74} />
      </mesh>
      {[-1.26, 1.26].map((xPosition) => (
        <mesh castShadow key={xPosition} position={[xPosition, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.38, 0.36]} />
          <meshStandardMaterial {...wood} color={palette.pew} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.085, 0.02]}>
        <boxGeometry args={[2.4, 0.025, 0.3]} />
        <meshStandardMaterial color={palette.carpet} roughness={0.78} />
      </mesh>
    </group>
  );
}

function TexturedPew({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  const wood = useSurfaceMaps(CHURCH_TEXTURES.pew, 2, 0.5);
  return <PewBody palette={palette} position={position} wood={wood} />;
}

function Pew({ palette, position }: { palette: Palette; position: [number, number, number] }) {
  // Each pew owns its Suspense boundary and falls back to a flat pew, so a
  // texture that isn't ready (or a re-render from changing the guest count)
  // shows a plain pew for a frame instead of the whole row vanishing.
  return (
    <Suspense fallback={<PewBody palette={palette} position={position} />}>
      <TexturedPew palette={palette} position={position} />
    </Suspense>
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
  const tablePositions = useMemo(() => buildReceptionTablePositions(tableCount), [tableCount]);
  const seatsPerTable = Math.min(10, Math.max(4, capacity.seatsPerRow));
  const receptionSeats = useMemo(() => buildReceptionSeats(tablePositions, seatsPerTable), [seatsPerTable, tablePositions]);
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
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0.9]}>
          <planeGeometry args={[2.45, 2.15]} />
          <meshStandardMaterial color={surface.path} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} roughness={0.62} />
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
          <ReceptionTable key={tableIndex} palette={palette} position={position} />
        ))}
        <Suspense fallback={null}>
          <ChurchCongregation seats={receptionSeats} />
        </Suspense>
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.55, 0.012, 1.1]}>
        <planeGeometry args={[0.28, 6.9]} />
        <meshStandardMaterial color={palette.candle} depthWrite={false} opacity={0.5} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} roughness={0.58} transparent />
      </mesh>

      <LightingRibbon decorScale={0.82} palette={palette} venueType={venueType} />
    </group>
  );
}

function ReceptionTable({
  palette,
  position
}: {
  palette: Palette;
  position: [number, number, number];
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
      {/* Guests are seated around the table by ReceptionSeating (instanced). */}
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

// Image-based lighting from a real HDRI, loaded imperatively through a PMREM so it
// never suspends (drei's <Environment files> did, which crashed the postprocessing
// EffectComposer). The day/dusk intensity lives in its own effect so toggling the
// mood never reloads the HDR.
function HdrEnvironment({ intensity, url }: { intensity: number; url: string }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    let disposed = false;
    let envMap: THREE.Texture | null = null;
    const pmrem = new THREE.PMREMGenerator(gl);
    // The equirect HDR comes from the module-level cache (scene-boot), so a
    // remount or venue switch never re-downloads it. The shared source texture
    // is never disposed — only this mount's PMREM output is.
    void preloadHdr(url).then((texture) => {
      if (disposed) {
        return;
      }
      envMap = pmrem.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      pmrem.dispose();
    });
    return () => {
      disposed = true;
      scene.environment = null;
      envMap?.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, url]);

  // Applied per-frame (not in the load effect) so day/dusk changes never
  // re-download or re-PMREM the HDR — only the scalar changes.
  useFrame((state) => {
    if (state.scene.environmentIntensity !== intensity) {
      state.scene.environmentIntensity = intensity;
    }
  });

  return null;
}

function CameraSetup({
  activeStep,
  cameraOverride = null,
  firstPerson = null,
  headsRef,
  venueType,
  viewMode,
  zoom = 1
}: {
  activeStep: StudioPlanningStepId;
  cameraOverride?: SceneCameraOverride | null;
  firstPerson?: CeremonyFirstPerson;
  headsRef?: { current: CoupleHeads };
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
  zoom?: number;
}) {
  const { camera } = useThree();
  const lookTargetRef = useRef(new THREE.Vector3(...getCameraTarget(viewMode, venueType, activeStep)));

  // Photographic lens per view: the hero church shot gets a "50mm" compressed
  // one-point aisle framing, while portrait canvases widen so the same shot
  // still fits (three.js FOV is vertical). Preview waypoints were composed at
  // the classic 40 and keep it.
  useFrame((state, delta) => {
    const perspective = state.camera as THREE.PerspectiveCamera;

    if (!perspective.isPerspectiveCamera) {
      return;
    }

    const desiredFov = cameraOverride ? 40 : firstPerson ? 46 : getViewFov(viewMode, venueType, perspective.aspect);
    const nextFov = THREE.MathUtils.damp(perspective.fov, desiredFov, 2.4, delta);

    if (Math.abs(nextFov - perspective.fov) > 0.01) {
      perspective.fov = nextFov;
      perspective.updateProjectionMatrix();
    }
  });

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;

    // First-person: ride at the chosen partner's eyes. Snap (no damp) so the view
    // is locked to the head as they walk; look down the aisle, then at the partner
    // once the couple has arrived at the altar.
    if (firstPerson && headsRef) {
      const self = firstPerson === "bride" ? headsRef.current.bride : headsRef.current.groom;
      const partner = firstPerson === "bride" ? headsRef.current.groom : headsRef.current.bride;
      camera.position.set(self.x, self.y, self.z - 0.12);
      if (headsRef.current.arrived) {
        lookTargetRef.current.set(partner.x, partner.y - 0.05, partner.z);
      } else {
        lookTargetRef.current.set(0, 1.2, -3.7);
      }
      camera.lookAt(lookTargetRef.current);
      return;
    }
    // A camera override (used by the Preview walkthrough) flies to an explicit
    // waypoint; otherwise fall back to the view-mode rig. Idle life is a slow
    // locked-axis dolly (wedding-videography grammar), not the old sin/cos
    // hover that read as a drone.
    const [rawX, rawY, rawZ] = cameraOverride ? cameraOverride.position : getCameraPosition(viewMode, venueType, activeStep);
    const distanceScale = cameraOverride ? 1 : 1 / zoom;
    const baseX = rawX * distanceScale;
    const baseY = viewMode === "top" && !cameraOverride ? rawY * distanceScale : Math.max(1.05, rawY * distanceScale);
    const baseZ = rawZ * distanceScale;
    const drifting = cameraOverride ? true : viewMode === "3d";
    const dollyDepth = cameraOverride ? 0.1 : 0.24;
    const desiredX = baseX;
    const desiredY = baseY;
    const desiredZ = baseZ + (drifting ? Math.sin(time * 0.045) * dollyDepth : 0);
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

// Vertical FOV per view mode: the hero shot is a compressed "50mm" one-point
// aisle frame; portrait canvases get a wider angle so the shot still fits.
function getViewFov(viewMode: StudioViewMode, venueType: StudioVenueType, aspect: number): number {
  const portraitBoost = aspect < 1 ? 12 : aspect < 1.3 ? 6 : 0;

  if (viewMode === "top") {
    return 44 + portraitBoost;
  }

  if (viewMode === "guest") {
    return 38 + portraitBoost;
  }

  if (viewMode === "walkthrough") {
    return 42 + portraitBoost;
  }

  return (venueType === "church" ? 32 : 36) + portraitBoost;
}

function getCameraPosition(viewMode: StudioViewMode, venueType: StudioVenueType, activeStep: StudioPlanningStepId): [number, number, number] {
  // The church is an enclosed nave, so the eye sits inside it looking down the
  // aisle toward the altar (matching the reference one-point perspective). The
  // hero "3d" view shoots from standing eye height at the back of the nave —
  // wedding-photography grammar, not the old drone altitude. The reception
  // flows to an open venue, so it keeps the standard wide rig.
  if (venueType === "church" && activeStep !== "reception") {
    const churchPositions: Record<StudioViewMode, [number, number, number]> = {
      "3d": [0, 1.7, 8.7],
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
      "3d": [0, 1.2, -3.8],
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

// Real seated guests ringed around each dinner table, facing the centre, feet
// on the floor — reuses the instanced congregation meshes.
function buildReceptionSeats(tablePositions: Array<[number, number, number]>, seatsPerTable: number): CongregationSeat[] {
  const seats: CongregationSeat[] = [];
  const radius = 0.95;

  tablePositions.forEach(([tx, , tz], tableIndex) => {
    for (let seat = 0; seat < seatsPerTable; seat += 1) {
      const angle = (seat / seatsPerTable) * Math.PI * 2 + (tableIndex % 2) * 0.42;
      const gx = tx + Math.cos(angle) * radius;
      const gz = tz + Math.sin(angle) * radius;
      seats.push({
        id: `reception-${tableIndex}-${seat}`,
        position: [gx, 0, gz],
        rotationY: Math.atan2(tx - gx, tz - gz),
        variant: (tableIndex * 3 + seat * 5) % CONGREGATION_MODELS.length
      });
    }
  });

  return seats;
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
      floor: "#c8b58c",
      path: "#e4d5b7"
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
