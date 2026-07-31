"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, ContactShadows, Html, useGLTF, useTexture } from "@react-three/drei";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Volume2, VolumeX } from "lucide-react";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LoopSubdivision } from "three-subdivide";
import { SceneBootGate, preloadHdr } from "@/components/wedding-studio/scene-boot";
import { DinnerChair, DinnerTablescape, type TablescapeColors } from "@/components/wedding-studio/dinner-props";
import { assetPath } from "@/lib/asset-path";
import { useTranslation } from "@/lib/i18n";
import {
  ceremonyStagingMarkIds,
  ceremonyStagingMarks,
  defaultCeremonyStaging,
  type CeremonyGroomStart,
  type CeremonyStaging,
  type CeremonyStagingMarkId,
  type StudioSceneOffset
} from "@/lib/wedding-studio-plan";
import type { DinnerTable } from "@/lib/wedding-types";
import {
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
    // A luminance-neutral detail map, not an albedo. The raw plaster scan
    // averaged #444037, so multiplying it by the palette's wall tone turned
    // every church into a grey cave no matter what colour was chosen. This
    // version carries only the grain, so `color` actually sets the stone tone.
    map: assetPath("/textures/wall_limestone.jpg"),
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
      // Max anisotropic filtering keeps the stone floor and wood crisp at the
      // grazing angle down the aisle instead of smearing to mush near the altar.
      // three clamps this to the GPU's real max at upload, so 16 is a safe ceiling.
      clone.anisotropy = 16;
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
const WALL_NORMAL_SCALE = new THREE.Vector2(0.3, 0.3);

function StoneWall({ args, color, position }: { args: [number, number, number]; color: string; position: [number, number, number] }) {
  const maps = useSurfaceMaps(CHURCH_TEXTURES.wall, 3, 1.5);

  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={args} />
      {/* The plaster normal map at full strength turned dressed limestone into
          popcorn stucco. Dialled back so the surface reads smooth and cool to
          the touch, with only enough tooth to catch the raking key light. */}
      <meshStandardMaterial
        {...maps}
        color={color}
        normalScale={WALL_NORMAL_SCALE}
        polygonOffset
        polygonOffsetFactor={2}
        polygonOffsetUnits={2}
        roughness={0.94}
      />
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
  // The couple's persisted ceremony choices — these visibly reshape the 3D
  // world (runner width, pew angles/spacing), so the controls never lie.
  aisleWidthFeet?: number;
  seatingLayout?: string;
  // The couple's actual dinner tables. When provided, the dinner scene renders
  // their real table count + seated headcount instead of a capacity guess.
  dinnerTables?: DinnerTable[];
  autoProcessional?: boolean;
  budgetLevel: StudioBudgetLevel;
  // Who stands where. Optional so surfaces that only preview the day (exports,
  // the shared link) keep working without owning a staging editor.
  staging?: CeremonyStaging;
  // Uploaded faces. The congregation array is positional: entry N belongs to the
  // Nth seat the church fills, which is the same order the guest list is in.
  congregationPhotos?: (string | null)[];
  couplePhotos?: { bride: string | null; groom: string | null };
  onMoveStagingMark?: (markId: CeremonyStagingMarkId, x: number, z: number) => void;
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
    // The couple's style choice governs their DECOR — accent, blush, carpet, the
    // guests' clothing. It should not repaint the building: this preset's #eef0ea
    // put a mint-white wash on the nave walls and the altar panel, which read as
    // mint green against the warm floor and was the most off-palette surface left in
    // the render. Warm pale stone at the same lightness keeps the modern preset cool
    // and airy where it belongs while the masonry stays masonry.
    wall: "#efece2"
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
  aisleWidthFeet = 5,
  seatingLayout = "Traditional",
  dinnerTables,
  cameraOverride = null,
  firstPerson = null,
  highQuality = true,
  congregationPhotos,
  couplePhotos,
  lighting = "dusk",
  onMoveStagingMark,
  staging,
  zoom = 1
}: CeremonySceneProps) {
  const palette = useMemo(() => createPalette(style, colorDirection), [colorDirection, style]);
  const preset = lightingPresets[lighting];
  const isDay = lighting === "day";
  // The product has exactly TWO scenes: the church ceremony and the indoor
  // dinner. The reception step always renders the hall room, whatever venue a
  // caller passes — the dinner never previews outdoors.
  const effectiveVenue: StudioVenueType = activeStep === "reception" ? "hall" : venueType;
  // Both scenes are interiors; they share the enclosed-room lighting treatment.
  const interiorVenue = effectiveVenue === "church" || effectiveVenue === "hall";
  const { t } = useTranslation();
  const [processionalPlaying, setProcessionalPlaying] = useState(false);
  const [processionalKey, setProcessionalKey] = useState(0);
  // The singer was `useState(false)` with no setter: fully modelled, rendered,
  // and reachable by nothing. It now comes from the couple's saved staging.
  const activeStaging = staging ?? defaultCeremonyStaging;
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
          camera={{ far: 90, fov: 40, near: 0.3, position: getCameraPosition(viewMode, effectiveVenue, activeStep) }}
          dpr={highQuality ? [1, 2] : [1, 1.3]}
          gl={{ preserveDrawingBuffer: true }}
          // three 0.184 removed PCFSoftShadowMap (it silently downgraded and
          // logged a deprecation warning every frame) — PCF is what actually ran.
          shadows={{ type: THREE.PCFShadowMap }}
        >
          <SceneCaptureHook />
          <CameraSetup activeStep={activeStep} cameraOverride={cameraOverride} firstPerson={firstPerson} headsRef={coupleHeadsRef} venueType={effectiveVenue} viewMode={viewMode} zoom={zoom} />
          <color args={[preset.fogColor]} attach="background" />
          <fog args={[preset.fogColor, preset.fogNear, preset.fogFar]} attach="fog" />
          <SkyDome mode={lighting} />
          {effectiveVenue === "garden" || effectiveVenue === "beach" ? <HillSilhouettes /> : null}
          {/* Directional-over-fill: both interiors run on a low ambient base so
              corners darken and the candle pools read — the chiaroscuro of the
              reference. Open venues keep their brighter presets. */}
          <hemisphereLight
            args={[
              preset.hemisphereSky,
              preset.hemisphereGround,
              effectiveVenue === "church" ? 0.22 : effectiveVenue === "hall" ? 0.5 : preset.hemisphereIntensity
            ]}
          />
          <ambientLight
            color={preset.ambientColor}
            intensity={effectiveVenue === "church" ? 0.11 : effectiveVenue === "hall" ? 0.3 : preset.ambientIntensity}
          />
          <directionalLight color={isDay ? "#e4cfa4" : "#aebdd6"} intensity={preset.rimIntensity} position={[-6, 10, -7]} />
          <directionalLight
            castShadow
            color="#ffd9a6"
            intensity={effectiveVenue === "church" ? 2.9 : effectiveVenue === "hall" ? 2.2 : preset.keyIntensity}
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
              interiorVenue
                ? isDay
                  ? effectiveVenue === "hall"
                    ? 2.4
                    : 1.5
                  : effectiveVenue === "hall"
                    ? 7
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
            intensity={effectiveVenue === "church" ? (isDay ? 0.62 : 0.34) : effectiveVenue === "hall" ? (isDay ? 0.55 : 0.4) : isDay ? 0.72 : 0.45}
            url={effectiveVenue === "church" ? CHURCH_HDR_URL : INTERIOR_HDR_URL}
          />
          {/* Skip the contact-shadow plane in BOTH interiors: it's a second
              floor-parallel plane whose grazing edge z-fights the textured floor
              (the side strips by the pews blink). The directional key light
              already casts real shadows, so the rooms stay grounded without it.
              Open-air venues keep it. */}
          {interiorVenue ? null : (
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
            aisleWidthFeet={aisleWidthFeet}
            budgetLevel={budgetLevel}
            capacity={capacity}
            dinnerTables={dinnerTables}
            seatingLayout={seatingLayout}
            coupleHeadsRef={coupleHeadsRef}
            firstPerson={firstPerson}
            highQuality={highQuality}
            onMoveObject={onMoveObject}
            onSelectObject={onSelectObject}
            palette={palette}
            processionalKey={processionalKey}
            processionalDriven={autoProcessional !== undefined}
            processionalPlaying={autoProcessional ?? processionalPlaying}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            congregationPhotos={congregationPhotos}
            couplePhotos={couplePhotos}
            onMoveStagingMark={onMoveStagingMark}
            staging={activeStaging}
            venueType={effectiveVenue}
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
          {getSceneSignal(activeStep, capacity, effectiveVenue)}
        </span>
        <strong>{getSceneCaption(activeStep, capacity, effectiveVenue)}</strong>
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
  aisleWidthFeet = 5,
  budgetLevel,
  capacity,
  coupleHeadsRef,
  dinnerTables,
  firstPerson = null,
  highQuality = true,
  onMoveObject,
  onSelectObject,
  palette,
  processionalDriven,
  processionalKey,
  processionalPlaying,
  sceneEdits,
  seatingLayout = "Traditional",
  selectedObjectId,
  congregationPhotos,
  couplePhotos,
  onMoveStagingMark,
  staging,
  venueType,
  viewMode
}: {
  activeStep: StudioPlanningStepId;
  aisleWidthFeet?: number;
  budgetLevel: StudioBudgetLevel;
  capacity: WeddingStudioCapacity;
  coupleHeadsRef?: { current: CoupleHeads };
  dinnerTables?: DinnerTable[];
  firstPerson?: CeremonyFirstPerson;
  highQuality?: boolean;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  palette: Palette;
  processionalDriven: boolean;
  processionalKey: number;
  processionalPlaying: boolean;
  sceneEdits: StudioSceneEdits;
  seatingLayout?: string;
  selectedObjectId: StudioSceneObjectId;
  congregationPhotos?: (string | null)[];
  couplePhotos?: { bride: string | null; groom: string | null };
  onMoveStagingMark?: (markId: CeremonyStagingMarkId, x: number, z: number) => void;
  staging: CeremonyStaging;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
}) {
  const guestMarkers = useMemo(() => buildGuestMarkers(capacity), [capacity]);
  // Pews are architecture; guests are data. Deriving the pew count from the
  // guest count left a 27-guest wedding with four lonely benches in a nave built
  // for fourteen rows, which reads as an unfinished room rather than a small
  // wedding. The room now always carries its full complement of pews and the
  // guest list decides how many are OCCUPIED — which is also what a couple
  // actually sees when they walk into the church.
  const pewRows = activeStep === "venue" ? 0 : Math.min(navePewRows(capacity.visibleGuestMarkers), capacity.maxComfortableRows);
  const seatedRows = activeStep === "venue" ? 0 : pewRows;
  const rowIndexes = useMemo(() => Array.from({ length: pewRows }, (_, index) => index), [pewRows]);
  // Church + open-air ceremonies (garden/beach) all seat a real congregation
  // and run the processional; only the venue shell differs.
  const ceremonyVenue = venueType === "church" || venueType === "garden" || venueType === "beach";
  const decorScale = budgetLevel === "signature" ? 1.2 : budgetLevel === "elevated" ? 1 : 0.72;
  // A church with pews and no congregation is a worse lie than any framing choice.
  // This was an allow-list that omitted "vision" — the home studio's own default
  // step — so the front page rendered a fully furnished nave with nobody in it.
  const showGuests = activeStep !== "venue";
  const surface = getVenueSurface(venueType, palette);

  // The persisted ceremony choices reshape the real geometry: the runner widens
  // from its 5 ft baseline, pews slide outward to keep their aisle margin, rows
  // spread or angle toward the altar. Both the pew blocks and the seated
  // congregation derive from the SAME numbers so they never drift apart.
  const aisleScale = Math.max(0.5, aisleWidthFeet / 5);
  const runnerWidth = surface.aisleWidth * aisleScale;
  const aisleShift = (runnerWidth - surface.aisleWidth) / 2;
  const rowSpacing = seatingLayout === "Spaced rows" ? 0.8 : 0.62;
  const pewYaw = seatingLayout === "Semi-circle" ? 0.24 : seatingLayout === "Curved rows" ? 0.11 : 0;
  const seatLayout = useMemo<SeatLayoutParams>(
    () => ({ aisleShift, pewYaw, rowSpacing }),
    [aisleShift, pewYaw, rowSpacing]
  );
  const seatedGuests = useMemo(
    () => (ceremonyVenue ? buildChurchSeatedGuests(seatedRows, capacity.visibleGuestMarkers, seatLayout) : []),
    [capacity.visibleGuestMarkers, ceremonyVenue, seatLayout, seatedRows]
  );

  // Buildings do not move: the old whole-scene sway rotated the architecture
  // itself, a subconscious "floating game level" tell. Camera motion (a slow
  // dolly in CameraSetup) now carries all the life instead.
  return (
    <group position={[0, 0, 0.25]}>
      {activeStep === "reception" ? (
        <ReceptionInterior
          capacity={capacity}
          dinnerTables={dinnerTables}
          highQuality={highQuality}
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
              <planeGeometry args={[runnerWidth, 11.8]} />
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
              <CeremonyFocalPoint decorScale={decorScale} floralMark={staging.marks.florals} palette={palette} venueType={venueType} />
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
            outlineCenter={[0, -2.4 + (Math.max(0, pewRows - 1) * rowSpacing) / 2]}
            sceneEdits={sceneEdits}
            selectedObjectId={selectedObjectId}
            size={[6.4 + aisleShift * 2, Math.max(2.4, pewRows * (rowSpacing + 0.08))]}
          >
            <Suspense fallback={null}>
              {rowIndexes.map((rowIndex) => {
                const z = -2.4 + rowIndex * rowSpacing;

                return (
                  <group key={rowIndex}>
                    <group position={[-(PEW_BLOCK_X + aisleShift), 0.18, z]} rotation={[0, -pewYaw, 0]}>
                      <CeremonySeatBlock palette={palette} position={[0, 0, 0]} venueType={venueType} />
                    </group>
                    <group position={[PEW_BLOCK_X + aisleShift, 0.18, z]} rotation={[0, pewYaw, 0]}>
                      <CeremonySeatBlock palette={palette} position={[0, 0, 0]} venueType={venueType} />
                    </group>
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
                    const z = -2.4 + rowIndex * rowSpacing;
                    // The candle border hugs the runner's edge, so widening the
                    // aisle visibly moves the whole candlelit corridor with it.
                    const candleX = runnerWidth / 2 + 0.295;

                    return (
                      <group key={`aisle-candle-${rowIndex}`}>
                        <CandleStand candleColor={palette.candle} position={[-candleX, 0, z]} scale={decorScale * 0.82} />
                        <CandleStand candleColor={palette.candle} position={[candleX, 0, z]} scale={decorScale * 0.82} />
                        {/* Each lantern pools warm light on the stone beneath it —
                            the pooled-candlelight gradient of the reference aisle. */}
                        <CandleFloorPool position={[-candleX, 0.004, z]} />
                        <CandleFloorPool position={[candleX, 0.004, z]} />
                        {/* White floral posies nestled beside each candle so the
                            aisle reads as a continuous candlelit-floral border. */}
                        <FlowerCluster palette={palette} position={[-(candleX + 0.1), 0.12, z]} radius={0.16} />
                        <FlowerCluster palette={palette} position={[candleX + 0.1, 0.12, z]} radius={0.16} />
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

          {ceremonyVenue && congregationPhotos && showGuests ? (
            <CongregationFaces photos={congregationPhotos} seats={seatedGuests} />
          ) : null}

          {ceremonyVenue && activeStep !== "venue" ? (
            <Suspense fallback={null}>
              <Celebrant mark={staging.marks.celebrant} />
              <Processional
                couplePhotos={couplePhotos}
                coupleMark={staging.marks.couple}
                driven={processionalDriven}
                groomStart={staging.groomStart}
                headsRef={coupleHeadsRef}
                hideFigure={firstPerson}
                key={processionalKey}
                playing={processionalPlaying}
              />
              {staging.showSinger ? <Singer mark={staging.marks.singer} /> : null}
            </Suspense>
          ) : null}

          {/* Staging handles, plan view only: the top-down camera is where moving
              people around actually makes sense, and they must never sit in front
              of the 3D view the couple is trying to look at. */}
          {ceremonyVenue && viewMode === "top" && onMoveStagingMark ? (
            <StagingHandles onMove={onMoveStagingMark} staging={staging} />
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

  return <RoomFrame palette={palette} venueType={venueType} viewMode={viewMode} />;
}

function RoomFrame({ palette, venueType, viewMode }: { palette: Palette; venueType?: StudioVenueType; viewMode?: StudioViewMode }) {
  // The dinner hall is a REAL room: full-height walls, a ceiling for the
  // pendants to hang from, and tall dusk-lit window panes. The old waist-high
  // box read as a stage prop, not a place you could hold a wedding dinner.
  const isHall = venueType === "hall";
  const backWallHeight = isHall ? 3.8 : 2.45;
  const sideWallHeight = isHall ? 3.8 : 1.8;
  // The plan view looks straight down — a ceiling would hide the whole room
  // (same pattern as the church nave's showCeiling).
  const showCeiling = isHall && viewMode !== "top";

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

      {showCeiling ? (
        <mesh position={[0, backWallHeight - 0.02, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.8, 11.8]} />
          <meshStandardMaterial color="#efe5cf" roughness={0.92} side={THREE.DoubleSide} />
        </mesh>
      ) : null}

      {/* Tall warm-glass panes on the back wall — the evening glow of the room. */}
      {[-3.2, -1.05, 1.05, 3.2].map((xPosition) => (
        <mesh key={xPosition} position={[xPosition, isHall ? 1.9 : 1.5, -5.62]}>
          <boxGeometry args={[0.72, isHall ? 2.3 : 1.5, 0.08]} />
          <meshStandardMaterial color="#f6eed6" emissive="#ffe9bd" emissiveIntensity={isHall ? 0.7 : 0.9} roughness={0.4} toneMapped={false} />
        </mesh>
      ))}

      {/* Side-wall panes so the dusk light wraps the dinner from both sides. */}
      {isHall
        ? [-3.4, 0.1, 3.6].map((zPosition) =>
            [-4.81, 4.81].map((xPosition) => (
              <mesh key={`${xPosition}-${zPosition}`} position={[xPosition, 2, zPosition]}>
                <boxGeometry args={[0.06, 2.1, 0.9]} />
                <meshStandardMaterial color="#f2e6cc" emissive="#ffe2ad" emissiveIntensity={0.55} roughness={0.42} toneMapped={false} />
              </mesh>
            ))
          )
        : null}
    </group>
  );
}

// ----- Church interior: a warm Catholic nave (reference look) -----

const LEAD_COLOR = "#33301f";

// Draws a leaded window to a canvas, used as both map and emissiveMap so the glass
// glows like real backlit glass.
//
// The previous version filled a uniform diamond grid from a palette of eight bright
// jewels — including `#9a6bb0`, a lavender the owner had explicitly rejected, plus
// baby blues and pinks. At cell 26 on a 128x256 canvas the cells were large and
// perfectly regular, so it read as a harlequin candy wrapper rather than leaded
// glass: the loudest and most off-palette thing in the whole render.
//
// This version is built like an actual lancet: a stone reveal masking an arched
// head, a border of small quarries, a central roundel, and a field of SMALL
// diamonds with per-cell jitter so no two cells match. The palette is the product's
// own — amber, honey, deep forest, and oxblood as the single saturated accent. No
// blue, no pink, no lavender.
const GLASS_AMBER = "#c8912f";
const GLASS_HONEY = "#e0b45c";
const GLASS_DEEP_GOLD = "#a97420";
const GLASS_FOREST = "#3c4a33";
const GLASS_FOREST_DEEP = "#2c3626";
const GLASS_OXBLOOD = "#7d2f2a";
const GLASS_PALE = "#e8d9a8";
// Weighted so warm golds dominate and the accents stay rare — a church window reads
// warm overall, with colour incidents rather than an even confetti of hues.
const GLASS_FIELD = [
  GLASS_HONEY, GLASS_AMBER, GLASS_HONEY, GLASS_PALE, GLASS_AMBER,
  GLASS_DEEP_GOLD, GLASS_HONEY, GLASS_FOREST, GLASS_AMBER, GLASS_PALE,
  GLASS_HONEY, GLASS_OXBLOOD, GLASS_AMBER, GLASS_FOREST_DEEP, GLASS_HONEY
];
const LEAD = "#1a1409";

function createStainedGlassTexture(seed: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // A tiny deterministic PRNG: the jitter must be stable across renders, or the
    // glass would shimmer every time React re-created the texture.
    let state = (seed + 1) * 9301;
    const rand = () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };

    ctx.fillStyle = LEAD;
    ctx.fillRect(0, 0, w, h);

    // The lancet opening: a vertical rectangle capped by a semicircular head. Drawn
    // as a clip so everything after it stays inside the glass, and the surrounding
    // canvas remains dark — that dark margin reads as the stone reveal.
    const margin = 18;
    const openW = w - margin * 2;
    const headR = openW / 2;
    const headY = margin + headR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, headY, headR, Math.PI, 0);
    ctx.lineTo(w - margin, h - margin);
    ctx.lineTo(margin, h - margin);
    ctx.closePath();
    ctx.clip();

    // Field of small quarries. Cell 15 on a 256-wide panel gives ~17 across, which
    // reads as glass rather than as tiles.
    const cell = 15;
    for (let row = -2; row * (cell / 2) < h + cell; row += 1) {
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
        ctx.fillStyle = GLASS_FIELD[Math.floor(rand() * GLASS_FIELD.length)];
        // Per-cell opacity jitter stands in for the thickness variation of hand-blown
        // glass, so light through the panel is uneven the way real glass is.
        ctx.globalAlpha = 0.74 + rand() * 0.26;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = LEAD;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // A border band of larger quarries, the way a real window frames its field.
    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 3;
    ctx.strokeRect(margin + 10, headY, openW - 20, h - margin - headY - 10);

    // Central roundel — one deliberate focal incident instead of an even field.
    const roundelY = h * 0.46;
    const roundelR = openW * 0.26;
    ctx.beginPath();
    ctx.arc(w / 2, roundelY, roundelR, 0, Math.PI * 2);
    ctx.fillStyle = GLASS_OXBLOOD;
    ctx.globalAlpha = 0.82;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = LEAD;
    ctx.stroke();
    // A simple rosette inside it, in gold, so the roundel has structure at distance.
    ctx.beginPath();
    ctx.arc(w / 2, roundelY, roundelR * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = GLASS_HONEY;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = LEAD;
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * roundelR * 0.46, roundelY + Math.sin(a) * roundelR * 0.46);
      ctx.lineTo(w / 2 + Math.cos(a) * roundelR, roundelY + Math.sin(a) * roundelR);
      ctx.stroke();
    }

    // Warm backlight, centred a little above middle where a real window's brightest
    // wash falls.
    const glow = ctx.createRadialGradient(w / 2, h * 0.38, 10, w / 2, h * 0.38, h * 0.62);
    glow.addColorStop(0, "rgba(255,240,206,0.32)");
    glow.addColorStop(1, "rgba(255,240,206,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Builds a lancet outline: straight jambs up to the springing line, then a
// semicircular head. Used for both the glass and the stone reveal so the
// window has one continuous pointed-arch silhouette instead of a rectangle
// with a flat coloured cap stuck on top.
function lancetShape(halfWidth: number, bodyHeight: number) {
  const shape = new THREE.Shape();
  const spring = bodyHeight / 2;
  shape.moveTo(-halfWidth, -spring);
  shape.lineTo(-halfWidth, spring);
  // clockwise sweeps PI -> PI/2 -> 0, i.e. over the top.
  shape.absarc(0, spring, halfWidth, Math.PI, 0, true);
  shape.lineTo(halfWidth, -spring);
  shape.closePath();
  return shape;
}

// ShapeGeometry writes raw XY into uv, so a shape that spans metres would tile
// the texture dozens of times. Remap uv to 0..1 across the bounds so the leaded
// artwork fills the lancet exactly once, arch included.
function lancetGeometry(halfWidth: number, bodyHeight: number) {
  const geometry = new THREE.ShapeGeometry(lancetShape(halfWidth, bodyHeight), 28);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const spanX = box.max.x - box.min.x || 1;
  const spanY = box.max.y - box.min.y || 1;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, (position.getX(i) - box.min.x) / spanX, (position.getY(i) - box.min.y) / spanY);
  }
  uv.needsUpdate = true;
  return geometry;
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
  // Real leaded-glass look: a jewel-toned quarry lattice with dark lead lines
  // and a soft backlight, drawn to a canvas — far richer than a few flat panes.
  const texture = useMemo(() => createStainedGlassTexture(seed), [seed]);
  useEffect(() => () => texture.dispose(), [texture]);

  const glass = useMemo(() => lancetGeometry(halfWidth, rectHeight), [halfWidth, rectHeight]);
  const reveal = useMemo(() => lancetGeometry(halfWidth + 0.13, rectHeight + 0.26), [halfWidth, rectHeight]);
  const lead = useMemo(() => lancetGeometry(halfWidth + 0.03, rectHeight + 0.06), [halfWidth, rectHeight]);
  useEffect(
    () => () => {
      glass.dispose();
      reveal.dispose();
      lead.dispose();
    },
    [glass, reveal, lead]
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Arched stone reveal, following the same curve as the glass. */}
      <mesh geometry={reveal} position={[0, 0, -0.07]}>
        <meshStandardMaterial color="#cdc2a4" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Lead came outlining the whole lancet. */}
      <mesh geometry={lead} position={[0, 0, -0.012]}>
        <meshStandardMaterial color={LEAD_COLOR} roughness={0.78} side={THREE.DoubleSide} />
      </mesh>
      {/* The glass itself: one continuous backlit lancet. */}
      <mesh geometry={glass}>
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.9} emissiveMap={texture} map={texture} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Tracery oculus in the head — a lead ring around pale gold. */}
      <mesh position={[0, rectHeight / 2 + halfWidth * 0.42, 0.012]}>
        <ringGeometry args={[halfWidth * 0.26, halfWidth * 0.32, 20]} />
        <meshStandardMaterial color={LEAD_COLOR} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, rectHeight / 2 + halfWidth * 0.42, 0.008]}>
        <circleGeometry args={[halfWidth * 0.27, 20]} />
        <meshStandardMaterial color={GLASS_PALE} emissive={GLASS_HONEY} emissiveIntensity={0.5} roughness={0.4} side={THREE.DoubleSide} />
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
      {/* A footed urn: base, waisted stem, flared bowl. A single tapered tube read
          as a length of pipe. */}
      <mesh castShadow position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.08, 16]} />
        <meshStandardMaterial color="#ded3ba" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.7, 16]} />
        <meshStandardMaterial color="#e6dcc6" roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.86, 0]}>
        <cylinderGeometry args={[0.19, 0.1, 0.24, 16]} />
        <meshStandardMaterial color="#e9e0ca" roughness={0.52} />
      </mesh>
      <mesh castShadow position={[0, 0.99, 0]}>
        <torusGeometry args={[0.185, 0.017, 8, 20]} />
        <meshStandardMaterial color="#b39152" metalness={0.62} roughness={0.38} />
      </mesh>
      <FlowerCluster palette={palette} position={[0, 1.22, 0]} radius={0.33} />
      <FlowerCluster palette={palette} position={[0.2, 1.06, 0.07]} radius={0.22} />
      <FlowerCluster palette={palette} position={[-0.2, 1.04, 0.07]} radius={0.21} />
    </group>
  );
}

function ChurchAltar({ decorScale, floralMark, palette }: { decorScale: number; floralMark: StudioSceneOffset; palette: Palette }) {
  return (
    <group position={[0, 0, -4.55]}>
      <Dais palette={palette} />
      <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[2.1, 0.52, 0.78]} />
        <meshStandardMaterial color="#f3ead7" roughness={0.7} />
      </mesh>
      {/* The mensa cloth. This carried the couple's accent colour at metalness 0.7,
          which is cloth rendered as sheet metal — it read as billiard-table felt.
          Linen is a dielectric; the gilt stays as a separate edge band, which is
          where a church actually puts its metal. */}
      <mesh castShadow position={[0, 0.63, 0]}>
        <boxGeometry args={[2.24, 0.05, 0.88]} />
        <meshStandardMaterial color={palette.accent} metalness={0} roughness={0.72} />
      </mesh>
      <mesh castShadow position={[0, 0.607, 0.442]}>
        <boxGeometry args={[2.24, 0.012, 0.008]} />
        <meshStandardMaterial color="#b39152" metalness={0.68} roughness={0.34} />
      </mesh>
      <ChurchAltarFloral palette={palette} position={[-1.28 - floralMark.x, 0, 0.16 + floralMark.z]} />
      <ChurchAltarFloral palette={palette} position={[1.28 + floralMark.x, 0, 0.16 + floralMark.z]} />
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
// MEASURED, not assumed. Read off the live scene on 2026-07-29 via the dev-only
// window.__wfsScene hook, because nothing about scale in this file can be reasoned
// about from its own numbers:
//
//   Seated congregation geometry .... 4.001 units tall, minY exactly 0
//   Instance scale ................. CONGREGATION_SCALE, so ~0.82 m in world
//   Standing hero rig node scale ... 23.5 (the armature carries an internal 100,
//                                    NOT the 0.235 on the primitive)
//   Dinner table height ............ 0.66 (TABLE_HEIGHT in dinner-props.tsx)
//
// A seated figure is therefore 0.82 m from base to crown. Anything placed against
// it must be derived from that, in these proportions — the chair I wrote in real
// world metres (0.45 m seat, 0.56 m back) came out nearly as tall as the person
// and filled the dinner with brown slabs. Real-life dimensions are the wrong unit
// here.
//   => A seated guest occupies 4.001 * 0.205 = 0.82 m from base to crown.
//
// Derive anything placed against a diner from that 0.82, in its proportions. A
// chair seat belongs near 0.30 and its back near 0.62 — NOT the 0.45 and 0.56 a
// real chair measures, which came out nearly as tall as the person. The one number
// still missing before that chair can be built is the dinner seat's own y in the
// instance matrix; read it in the DINNER view, not the church.
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
    // Fold a cohesive regrade AND a baked soft occlusion into the single vertex
    // pass that already ran to calm the colours — this is what turns the "clay
    // clumps" into a designed alabaster assembly, and it works in the FORWARD
    // render (N8AO lives only in the HD composer, so the crowd had zero crevice
    // shading with post off and collapsed to flat lumps):
    //   1. crush the palette to a near-monochrome warm-ivory band so no saturated
    //      "coloured NPC" survives (individual tone still varies, just quietly);
    //   2. darken TRUE undersides (downward-facing normals) + a thin seat-contact
    //      band, so every figure reads shaped — chin, lap shelf, arm/thigh
    //      undersides, seat contact — identical with post on or off.
    const colorAttr = smoothed.getAttribute("color") as THREE.BufferAttribute | undefined;
    const posAttr = smoothed.getAttribute("position") as THREE.BufferAttribute | undefined;
    let normalAttr = smoothed.getAttribute("normal") as THREE.BufferAttribute | undefined;
    if (colorAttr && posAttr) {
      if (!normalAttr) {
        smoothed.computeVertexNormals();
        normalAttr = smoothed.getAttribute("normal") as THREE.BufferAttribute;
      }
      smoothed.computeBoundingBox();
      const minY = smoothed.boundingBox?.min.y ?? 0;
      const maxY = smoothed.boundingBox?.max.y ?? 1;
      const contactTop = minY + 0.12 * Math.max(maxY - minY, 0.0001);
      const color = new THREE.Color();
      const hsl = { h: 0, s: 0, l: 0 };
      for (let i = 0; i < colorAttr.count; i += 1) {
        color.fromBufferAttribute(colorAttr, i);
        color.getHSL(hsl);
        const ny = normalAttr.getY(i);
        const contactBand = 1 - THREE.MathUtils.smoothstep(posAttr.getY(i), minY, contactTop);
        const occ = Math.max(0.55, 1 - 0.42 * Math.max(0, -ny) - 0.22 * contactBand);
        // Saturation must be a FLOOR, not a scale. `hsl.s * 0.3` left the source
        // greys at s=0, so the hue lerp toward warm had nothing to act on and the
        // whole assembly stayed cold grey no matter what hue was targeted — the
        // alabaster regrade was silently a no-op on exactly the vertices that
        // needed it. Lightness is likewise remapped into a light stone band
        // instead of merely nudged, so mid-grey clothing lands as pale limestone.
        // The band has to be wide enough to tell two guests apart. Crushing every
        // vertex into a 0.52-0.87 lightness sliver fixed the cold grey but made
        // the assembly read as one repeated figure; the source model's own light
        // and dark areas now survive as contrast within the alabaster family.
        // Third pass on this band, and the honest summary is that I overshot twice:
        // first too grey, then so light that every guest read as white. Lightness
        // now tops out well below white and starts lower, so clothing is clearly
        // clothing and skin is clearly skin, while the whole assembly still sits
        // in one warm stone family.
        color.setHSL(
          THREE.MathUtils.lerp(hsl.h, 0.085, 0.62),
          THREE.MathUtils.clamp(Math.max(0.075, hsl.s * 0.55), 0.075, 0.3),
          Math.min(0.74, 0.2 + hsl.l * 0.66) * occ
        );
        colorAttr.setXYZ(i, color.r, color.g, color.b);
      }
      colorAttr.needsUpdate = true;
    }
    return smoothed;
  }, [scene, highQuality]);
  // Satin alabaster, non-metallic: a touch of specular rolloff (roughness 0.7,
  // not dead-matte 0.94) lets the warm directional key wrap the heads/shoulders
  // so the crowd reads as sculpted stone, not dry clay. envMapIntensity lifts the
  // HDRI sheen a hair. Kept as MeshStandard so the crowd stays in the SAME lit
  // medium as the skinned couple/officiant and still answers day/dusk + god-rays.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, envMapIntensity: 1.1 }), []);
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
    const tint = new THREE.Color();

    seats.forEach((seat, index) => {
      // Deterministic per-seat hash in [0,1) so the same guest always gets the
      // same subtle identity (survives re-renders) — this is what breaks the
      // stamped-clone grid that reads as "game crowd".
      let hashAcc = 0;
      for (let c = 0; c < seat.id.length; c += 1) {
        hashAcc = (hashAcc * 31 + seat.id.charCodeAt(c)) % 100000;
      }
      const h = (hashAcc % 1000) / 1000;
      // Lean and a slight roll, both wider than before. A congregation is never
      // a grid of upright clones: people sit forward, sink back, tilt toward the
      // person beside them.
      euler.set(0.075 * (h - 0.5), seat.rotationY, 0.03 * (h - 0.5));
      quaternion.setFromEuler(euler);
      position.set(seat.position[0], seat.position[1], seat.position[2]);
      scale.setScalar(CONGREGATION_SCALE * (0.945 + 0.115 * h));
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      // Per-guest tone, wide enough to read as different people from the aisle
      // but still all one material family — ivory through warm stone, never a
      // saturated costume colour.
      tint.setHSL(0.07 + 0.07 * (h - 0.5), 0.16, 0.74 + 0.24 * (h - 0.5));
      mesh.setColorAt(index, tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [seats]);

  if (!geometry || seats.length === 0) {
    return null;
  }

  return <instancedMesh args={[geometry, material, seats.length]} castShadow frustumCulled={false} ref={meshRef} />;
}

// The dinner guests genuinely have no chairs, and the chair I added was worse
// than none: a 0.4m seat and 0.56m back written in world metres while the diners
// around it are scaled far smaller, so the room filled with brown slabs taller
// than the tables. Removed.
//
// Same lesson as the vestments: derive the size from the seated figure's actual
// height at CONGREGATION_SCALE, not from what a chair measures in real life.

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
// The source GLBs ship olive-khaki for both skin and hair — queried from the live
// scene rather than guessed: `Skin` was #92815e on the bride and #7b6439 on the men,
// `Hair` #73662d. That is why she read GREEN in the render, which is the kind of
// defect a viewer notices before anything else about a figure. Naming Skin and Hair
// in each recolor map replaces them with warm, plausible tones, varied between the
// three so the hero figures are not colour clones of each other.
const GROOM_COLORS: Recolor = {
  Details: "#efe9dd",
  Hair: "#33261d",
  Pants: "#1f2027",
  Shirt: "#1f2027",
  Skin: "#c68e6a",
  TieTexture: "#6a4a54"
};
const BRIDE_COLORS: Recolor = { Dress: "#f7f3ea", Hair: "#c9a563", Shoes: "#e9dfcf", Skin: "#d9a882" };
const PRIEST_COLORS: Recolor = {
  Details: "#24261f",
  // Greying, so the officiant reads as the older figure without needing a new model.
  Hair: "#8a857e",
  Pants: "#24261f",
  // Ivory where the shirt shows: the cassock plus a clerical collar reads as an
  // officiant. Head-to-toe #16161a crushed to a silhouette with no features.
  Shirt: "#e6dfd0",
  Skin: "#b9825f",
  TieTexture: "#24261f"
};
const SINGER_COLORS: Recolor = { Dress: "#7d3b46", Hair: "#3f2c20", Skin: "#cf9d78" };

// three's GLTFLoader pushes every node name through
// PropertyBinding.sanitizeNodeName, which strips dots — so a rig authored with
// `UpperArm.L` arrives in the scene as `UpperArmL`. Looking bones up by their
// authoring name therefore found nothing at all, and the entire pose layer was a
// silent no-op: the offsets were computed, the per-frame multiply ran over an
// empty list, and the figures kept the clip's own dead-straight arms. Both
// spellings are tried so a re-export cannot switch this off again unnoticed.
// A guest's own photo, standing in for a face. The congregation is an
// InstancedMesh, and instances cannot carry individual textures — so the faces
// are separate camera-facing discs placed at each occupied seat's head height,
// drawn only for the guests who actually uploaded a picture. Everyone else keeps
// the sculpted alabaster head, which is honest: no invented likeness.
const CONGREGATION_FACE_Y = 0.79;
const COUPLE_FACE_Y = 1.27;

function FaceDisc({ photoUrl, radius }: { photoUrl: string; radius: number }) {
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load(photoUrl);
    loaded.colorSpace = THREE.SRGBColorSpace;
    return loaded;
  }, [photoUrl]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh>
      <circleGeometry args={[radius, 40]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent />
    </mesh>
  );
}

function CongregationFaces({ photos, seats }: { photos: (string | null)[]; seats: CongregationSeat[] }) {
  return (
    <>
      {seats.map((seat, index) => {
        const photoUrl = photos[index];
        if (!photoUrl) {
          return null;
        }
        return (
          <Billboard key={seat.id} position={[seat.position[0], CONGREGATION_FACE_Y, seat.position[2]]}>
            <FaceDisc photoUrl={photoUrl} radius={0.1} />
          </Billboard>
        );
      })}
    </>
  );
}

function findBone(root: THREE.Object3D, name: string) {
  return root.getObjectByName(name) ?? root.getObjectByName(name.replace(/\./g, "")) ?? null;
}

// A pose is a set of per-bone rotation offsets layered ON TOP of whatever the
// animation clip is playing. The source Quaternius idle leaves both arms hanging
// dead straight and pinned to the ribs, which is the single thing that makes
// these figures read as shop mannequins: real people carry a few degrees of
// shoulder abduction and a soft elbow, and a bride or groom at an altar holds
// their hands in front of them.
//
// The offsets are applied by post-multiplying each bone's quaternion after the
// mixer has written the clip's value for the frame. Post-multiplying (rather
// than assigning) keeps the clip's motion intact, and doing it once per frame
// after the mixer means it does not accumulate.
type FigurePose = Record<string, [number, number, number]>;

// Hands clasped low in front — the standard groom-at-the-altar stance.
const POSE_HANDS_CLASPED: FigurePose = {
  "Shoulder.L": [0, 0, -0.06],
  "Shoulder.R": [0, 0, 0.06],
  "UpperArm.L": [0.04, 0.06, -0.2],
  "UpperArm.R": [0.04, -0.06, 0.2],
  "LowerArm.L": [0.5, 0, -0.22],
  "LowerArm.R": [0.5, 0, 0.22],
  "Palm.L": [0.12, 0, -0.08],
  "Palm.R": [0.12, 0, 0.08]
};

// The bride carries her bouquet a little higher and closer to centre.
const POSE_BOUQUET: FigurePose = {
  "Shoulder.L": [0, 0, -0.05],
  "Shoulder.R": [0, 0, 0.05],
  "UpperArm.L": [0.08, 0.05, -0.18],
  "UpperArm.R": [0.08, -0.05, 0.18],
  "LowerArm.L": [0.62, 0, -0.2],
  "LowerArm.R": [0.62, 0, 0.2],
  "Palm.L": [0.14, 0, -0.06],
  "Palm.R": [0.14, 0, 0.06]
};

// Just enough to unglue the arms from the torso and soften the elbows: used
// while walking, and for anyone whose hands are doing something else.
// Hands folded low and close, which is how someone stands while leading a service
// rather than the groom's slightly wider clasp.
const POSE_OFFICIANT: FigurePose = {
  "Shoulder.L": [0, 0, -0.05],
  "Shoulder.R": [0, 0, 0.05],
  "UpperArm.L": [0.06, 0.04, -0.16],
  "UpperArm.R": [0.06, -0.04, 0.16],
  "LowerArm.L": [0.72, 0, -0.26],
  "LowerArm.R": [0.72, 0, 0.26],
  "Palm.L": [0.16, 0, -0.1],
  "Palm.R": [0.16, 0, 0.1]
};

const POSE_RELAXED: FigurePose = {
  "Shoulder.L": [0, 0, -0.04],
  "Shoulder.R": [0, 0, 0.04],
  "UpperArm.L": [0, 0, -0.12],
  "UpperArm.R": [0, 0, 0.12],
  "LowerArm.L": [0.22, 0, -0.08],
  "LowerArm.R": [0.22, 0, 0.08]
};

function AnimatedFigure({
  clip,
  pose,
  recolor,
  rotationY = Math.PI,
  url
}: {
  clip: "walk" | "idle";
  pose?: FigurePose;
  recolor?: Recolor;
  rotationY?: number;
  url: string;
}) {
  const { animations, scene } = useGLTF(url);
  const object = useMemo(() => {
    const copy = cloneSkinned(scene);
    copy.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = true;
      // The hero figures read FACETED, and the reason is subtle: these meshes are
      // NON-INDEXED, so every triangle owns its three vertices outright and
      // `computeVertexNormals()` had nothing to average across — it was a silent
      // no-op that has been in this file through several 3D passes.
      //
      // The cure is not subdivision. Subdivision adds vertices the skin weights do
      // not cover and corrupts a rigged mesh, which is why the couple were written
      // off as permanently blocky. `mergeVertices` is a different operation: it
      // WELDS coincident vertices into an indexed geometry, carrying every attribute
      // (including skinIndex/skinWeight) along, and leaves the bone hierarchy and
      // the triangle count untouched. Once the geometry is indexed, computing normals
      // averages them across shared vertices and the shading goes smooth.
      //
      // The silhouette stays low-poly — that genuinely needs more triangles — but the
      // shading facets are what read as "jagged", and those are gone.
      //
      // One more trap, and it is the reason the previous weld barely helped:
      // `mergeVertices` only merges vertices whose ENTIRE attribute set matches.
      // On a flat-shaded mesh, coincident corners carry different per-face
      // normals by definition, so the comparison rejects almost every candidate
      // pair and the weld quietly does nothing. The normal attribute has to be
      // dropped BEFORE welding; then the merge sees matching positions and skin
      // weights, and `computeVertexNormals()` finally has shared vertices to
      // average across.
      if (mesh.geometry) {
        const raw = mesh.geometry.clone();
        raw.deleteAttribute("normal");
        const welded = mergeVertices(raw);
        welded.computeVertexNormals();
        mesh.geometry = welded;
      }
      const recolorOne = (material: THREE.Material) => {
        const cloned = (material as THREE.MeshStandardMaterial).clone();
        const next = recolor?.[cloned.name];
        if (next) {
          cloned.color = new THREE.Color(next);
        }
        // Every material in the figure GLBs ships `metallicFactor: 0.4`, and this
        // clone only ever changed the colour — so the couple, the officiant and the
        // singer all rendered as 40% metal. Cloth and skin are dielectrics: at
        // metalness 0.4 the base colour is partly reinterpreted as tinted specular,
        // which darkens the diffuse response and lays an environment-coloured sheen
        // over fabric. That is the "plastic mannequin" read, and it is wrong by
        // physics rather than by taste.
        cloned.metalness = 0;
        // A few of the source materials also ship implausibly smooth for fabric.
        // Only raise, never lower — a genuinely smooth surface (an eye, a shoe) keeps
        // whatever the asset author chose.
        cloned.roughness = Math.max(cloned.roughness, 0.72);
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

  // Resolve the named bones once, and pre-build each offset as a quaternion so
  // the per-frame work is a handful of multiplies.
  const posed = useMemo(() => {
    if (!pose) {
      return [];
    }
    const entries: { bone: THREE.Object3D; posed: THREE.Quaternion }[] = [];
    Object.entries(pose).forEach(([name, [x, y, z]]) => {
      const bone = findBone(object, name);
      if (bone) {
        // Rest pose composed with the offset ONCE, here. Composing per frame was
        // the bug: the mixer only writes the bones a clip actually animates, so
        // for every bone the idle clip leaves alone — the shoulders and palms —
        // `quaternion.multiply(offset)` compounded on itself every frame and the
        // arms rotated without end. A still frame cannot show that; only watching
        // it can.
        const posedQuat = bone.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
        entries.push({ bone, posed: posedQuat });
      }
    });
    return entries;
  }, [object, pose]);

  // Registered after the mixer's own useFrame at the same priority, so React
  // Three Fiber runs it second and the offsets land on top of the clip. Raising
  // the priority instead would switch off automatic rendering.
  // Assignment, never accumulation. These bones are fully owned by the pose, so
  // the clip's own arm motion is overridden on them — which is what a figure
  // standing still at an altar wants anyway.
  useFrame(() => {
    for (const entry of posed) {
      entry.bone.quaternion.copy(entry.posed);
    }
  });

  // Two attempts at putting the bouquet IN her hand both failed, and the reasons
  // are worth leaving here so the next attempt starts ahead of them:
  //
  //   1. Parenting it to the hand bone inherits the bone's world scale, and this
  //      armature carries an internal scale of 100 — the hand bone measures 23.5,
  //      not the 0.235 on the primitive. A compensation guessed from FIGURE_SCALE
  //      lands two orders of magnitude out.
  //   2. Portalling it to the scene root and copying the bone's world matrix onto
  //      it each frame leaves it at the origin: measured, the blooms sit at
  //      (0.03, 0.02, 0.08) while the hand is at (0.124, 0.50, 4.62), so the
  //      bone lookup is still resolving to null inside the cloned rig.
  //
  // Until one of those is actually solved, the bouquet stays a sibling at a fixed
  // offset. It is not attached to the hand, so it does drift when she turns — but
  // a posy slightly off her grip is a smaller lie than five blooms lying on the
  // floor at the centre of the church.
  return <primitive object={object} rotation={[0, rotationY, 0]} scale={FIGURE_SCALE} />;
}


// Draggable staging handles, drawn flat on the floor for the top-down plan view.
// A handle is a gilt ring with a name on it: the couple grabs the officiant and
// slides him to the other side of the altar, and the 3D updates as they let go.
// The invisible ground plane only exists while a drag is live, so it never eats
// pointer events from the rest of the scene.
const STAGING_HANDLE_COLOR = "#b39152";

function StagingHandle({
  active,
  label,
  onGrab,
  position
}: {
  active: boolean;
  label: string;
  onGrab: () => void;
  position: [number, number];
}) {
  const [hovered, setHovered] = useState(false);
  const lifted = hovered || active;

  return (
    <group position={[position[0], 0.05, position[1]]}>
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          onGrab();
        }}
        onPointerOut={() => setHovered(false)}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.34, 28]} />
        <meshBasicMaterial color="#f7f2e6" opacity={lifted ? 0.92 : 0.7} transparent />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, lifted ? 0.42 : 0.38, 28]} />
        <meshBasicMaterial color={STAGING_HANDLE_COLOR} opacity={lifted ? 1 : 0.85} transparent />
      </mesh>
      <Html center distanceFactor={11} pointerEvents="none" position={[0, 0.2, 0]} zIndexRange={[24, 0]}>
        <div className="staging-handle-label" data-active={lifted}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function StagingHandles({
  onMove,
  staging
}: {
  onMove: (markId: CeremonyStagingMarkId, x: number, z: number) => void;
  staging: CeremonyStaging;
}) {
  const { t } = useTranslation();
  const groupRef = useRef<THREE.Group>(null);
  // The live gate is a REF, not state. Gating on state meant the first
  // pointermove of a quick drag arrived before React had committed `dragging`,
  // so the move was dropped and the whole gesture silently did nothing. Refs
  // update synchronously, so the gesture is correct no matter how the frames
  // fall; the state below exists only to re-render the visual.
  const draggingRef = useRef<CeremonyStagingMarkId | null>(null);
  const dragPointRef = useRef<[number, number] | null>(null);
  const [dragging, setDragging] = useState<CeremonyStagingMarkId | null>(null);
  // The live drag position is LOCAL state. Reporting every pointermove upward
  // wrote the whole layout record to localStorage and reconciled the entire
  // church tree sixty times a second. The parent hears about it once, on
  // release — the same discipline the reception's drag-to-reseat already uses.
  const [dragPoint, setDragPoint] = useState<[number, number] | null>(null);

  // The singer only has a mark when the singer is actually in the room.
  const visibleMarks = ceremonyStagingMarkIds.filter((markId) => markId !== "singer" || staging.showSinger);

  function release() {
    const markId = draggingRef.current;
    const point = dragPointRef.current;
    if (markId && point) {
      const home = ceremonyStagingMarks[markId].home;
      onMove(markId, point[0] - home.x, point[1] - home.z);
    }
    draggingRef.current = null;
    dragPointRef.current = null;
    setDragging(null);
    setDragPoint(null);
  }

  return (
    <group ref={groupRef}>
      {/* The catch plane is mounted for as long as the handles are, not created
          on grab. Mounting it in response to pointerdown meant the first
          pointermove of a quick drag arrived before React had committed it, and
          the drag silently did nothing. It carries no onPointerDown and never
          stops propagation unless a drag is live, so ordinary clicks still reach
          the scene objects underneath it. */}
      <mesh
        onPointerMove={(event) => {
          if (!draggingRef.current || !groupRef.current) {
            return;
          }
          event.stopPropagation();
          // `event.point` is world space; the marks are in this group's local
          // space, and the stage root sits at z +0.25. Without this conversion
          // every drop landed a quarter metre off.
          const local = groupRef.current.worldToLocal(event.point.clone());
          dragPointRef.current = [local.x, local.z];
          setDragPoint([local.x, local.z]);
        }}
        onPointerUp={(event) => {
          if (!draggingRef.current) {
            return;
          }
          event.stopPropagation();
          release();
        }}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
      {visibleMarks.map((markId) => {
        const home = ceremonyStagingMarks[markId].home;
        const offset = staging.marks[markId];
        const reach = ceremonyStagingMarks[markId].reach;
        // While dragging, follow the cursor but stay inside the mark's reach, so
        // the handle shows exactly where it will land rather than promising a
        // position the clamp will refuse.
        const live =
          dragging === markId && dragPoint
            ? ([
                home.x + THREE.MathUtils.clamp(dragPoint[0] - home.x, -reach, reach),
                home.z + THREE.MathUtils.clamp(dragPoint[1] - home.z, -reach, reach)
              ] as [number, number])
            : ([home.x + offset.x, home.z + offset.z] as [number, number]);
        return (
          <StagingHandle
            active={dragging === markId}
            key={markId}
            label={t(ceremonyStagingMarks[markId].label)}
            onGrab={() => {
              draggingRef.current = markId;
              dragPointRef.current = [home.x + offset.x, home.z + offset.z];
              setDragging(markId);
              setDragPoint([home.x + offset.x, home.z + offset.z]);
            }}
            position={live}
          />
        );
      })}
    </group>
  );
}

// Vestments, built on MEASURED bone heights. Read straight out of figure_suit.glb
// by accumulating node translations through the parent chain (the HumanArmature
// carries scale 100, which is why nothing here can be eyeballed):
//
//   foot   0.060 rest -> 0.014 world      torso  3.095 -> 0.727
//   hips   1.931 rest -> 0.454 world      neck   4.047 -> 0.951
//                                         head   4.242 -> 0.997
//
// So the standing figure is about 1.1 m tall, not the 1.74 I assumed on the first
// attempt. That single wrong assumption produced both failures: a neck band placed
// at y 1.22 sat ABOVE the crown, which is why a green rectangle covered his face,
// and a hem radius of 0.235 was 43% of his height, which is why the alb read as a
// bell. These numbers are proportions of 1.1, and the stole hangs from the real
// neck at 0.951.
const ALB_HEM_Y = 0.02;
const ALB_TOP_Y = 0.9;
const NECK_Y = 0.951;

function Vestments() {
  const albGeometry = useMemo(() => {
    // Hem radius 0.13 of height, tapering to the shoulders — a robe, not a bell.
    const profile: [number, number][] = [
      [0.0, ALB_HEM_Y],
      [0.145, ALB_HEM_Y],
      [0.14, 0.16],
      [0.128, 0.34],
      [0.116, 0.52],
      [0.104, 0.68],
      [0.096, 0.8],
      [0.094, ALB_TOP_Y]
    ];
    const lathe = new THREE.LatheGeometry(
      profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
      32
    );
    lathe.computeVertexNormals();
    return lathe;
  }, []);
  useEffect(() => () => albGeometry.dispose(), [albGeometry]);

  return (
    <group>
      <mesh castShadow geometry={albGeometry} receiveShadow>
        <meshStandardMaterial color="#f3ede0" roughness={0.74} side={THREE.DoubleSide} />
      </mesh>
      {/* Stole: two panels from the neck down the chest, stopping above the hem. */}
      {[-0.042, 0.042].map((x) => (
        <mesh castShadow key={x} position={[x, (NECK_Y + 0.56) / 2, 0.062]}>
          <boxGeometry args={[0.044, NECK_Y - 0.56, 0.008]} />
          <meshStandardMaterial color="#3c4a33" roughness={0.7} />
        </mesh>
      ))}
      {/* The band joining them, AT the measured neck rather than above the head. */}
      <mesh castShadow position={[0, NECK_Y - 0.01, 0.005]}>
        <boxGeometry args={[0.125, 0.032, 0.1]} />
        <meshStandardMaterial color="#3c4a33" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Celebrant({ mark }: { mark: StudioSceneOffset }) {
  // The officiant waits at the altar, facing the congregation.
  const home = ceremonyStagingMarks.celebrant.home;
  return (
    <group position={[home.x + mark.x, 0, home.z + mark.z]}>
      <AnimatedFigure clip="idle" pose={POSE_OFFICIANT} recolor={PRIEST_COLORS} rotationY={0} url={FIGURE_SUIT} />
      <Vestments />
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

function Singer({ mark }: { mark: StudioSceneOffset }) {
  const home = ceremonyStagingMarks.singer.home;
  return (
    <group position={[home.x + mark.x, 0, home.z + mark.z]} rotation={[0, -0.55, 0]}>
      <AnimatedFigure clip="idle" pose={POSE_RELAXED} recolor={SINGER_COLORS} rotationY={0.35} url={FIGURE_WOMAN} />
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

// An A-line gown profile, revolved. It was a truncated cone (a 20-segment cylinder
// tapering 0.1 to 0.27), which is the single most lay-visible defect on the bride:
// a wedding dress has a waist, a hip, and a flare that curves outward, and a cone
// has none of those. These points are radius/height pairs from hem to waist,
// concave through the middle so the skirt sweeps rather than slopes, and 40 radial
// segments so the hem reads round instead of polygonal at close camera distances.
const GOWN_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.3, 0.0],
  [0.296, 0.035],
  [0.284, 0.095],
  [0.29, 0.17],
  [0.255, 0.25],
  [0.215, 0.33],
  [0.175, 0.4],
  [0.142, 0.46],
  [0.116, 0.51],
  [0.1, 0.547],
  [0.094, 0.565]
];

function BridalGown() {
  const geometry = useMemo(() => {
    const points = GOWN_PROFILE.map(([radius, height]) => new THREE.Vector2(radius, height));
    const lathe = new THREE.LatheGeometry(points, 40);
    // Revolved geometry is already indexed, so this genuinely smooths the skirt —
    // the same reason the welded figures now shade smoothly.
    lathe.computeVertexNormals();
    return lathe;
  }, []);

  return (
    <mesh castShadow geometry={geometry}>
      {/* Silk reads as a soft sheen rather than a matte wall: lower roughness than the
          figure fabrics, and a faint warm tint so the white does not clip flat. */}
      <meshStandardMaterial color="#f7f1e6" envMapIntensity={1.15} roughness={0.52} />
    </mesh>
  );
}

function Bouquet() {
  // A small ivory + blush posy, offset from the palm origin into the grip.
  const blooms: Array<[number, number, number, number]> = [
    [0, 0, 0, 0.058],
    [0.05, 0.02, 0.012, 0.044],
    [-0.05, 0.012, 0.01, 0.044],
    [0.012, 0.05, -0.012, 0.04],
    [-0.01, -0.012, 0.05, 0.038]
  ];

  return (
    <group position={[0.04, 0.56, 0.22]}>
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
  coupleMark,
  couplePhotos,
  driven,
  groomStart,
  headsRef,
  hideFigure = null,
  playing
}: {
  coupleMark: StudioSceneOffset;
  couplePhotos?: { bride: string | null; groom: string | null };
  // True when a caller drives the processional itself — the Preview walkthrough
  // does, moment by moment. Then "not playing" means NOT YET, so the couple wait
  // at the doors. When nobody drives it, the studio should open on the ceremony
  // and rest them at the altar instead.
  driven: boolean;
  groomStart: CeremonyGroomStart;
  headsRef?: { current: CoupleHeads };
  hideFigure?: CeremonyFirstPerson;
  playing: boolean;
}) {
  // Undriven, the studio opens on the ceremony: the couple stand at the altar and
  // Play walks them in. Driven, the caller is telling the story moment by moment,
  // so they must start at the doors — otherwise the Preview showed them already at
  // the altar during Guest Arrival and then teleporting backwards to walk in, and
  // the processional was never seen.
  const progress = useRef(driven ? 0 : 1);
  const arrivedRef = useRef(!driven);
  const groomRef = useRef<THREE.Group>(null);
  const brideRef = useRef<THREE.Group>(null);
  const [arrived, setArrived] = useState(!driven);
  const wasPlaying = useRef(false);
  const waitsAtAltar = groomStart === "altar";
  // Both figures keep their half of the aisle, shifted with the couple's mark.
  // Arm in arm down the centre of the runner rather than a lane apart.
  const groomX = -0.26 + coupleMark.x;
  const brideX = 0.26 + coupleMark.x;

  useFrame((_, delta) => {
    // Pressing Play rewinds them to the doors; releasing it leaves them wherever
    // they got to.
    if (playing && !wasPlaying.current && progress.current >= 1) {
      progress.current = 0;
      arrivedRef.current = false;
      setArrived(false);
    }
    wasPlaying.current = playing;
    if (playing && progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / PROCESSION_DURATION);
    }
    if (progress.current >= 1 && !arrivedRef.current) {
      arrivedRef.current = true;
      setArrived(true);
    }

    const p = progress.current;
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const endZ = PROCESSION_END_Z + coupleMark.z;
    const z = PROCESSION_START_Z + (endZ - PROCESSION_START_Z) * eased;
    // A groom who waits at the altar is already standing on his mark, facing
    // back down the aisle to watch the bride arrive — he turns to her only when
    // she gets there.
    const groomZ = waitsAtAltar ? endZ : z;
    const groomIdleTarget = waitsAtAltar ? Math.PI : Math.PI / 2;
    // Face down the aisle while walking; turn to face each other on arrival
    // (groom looks right toward the bride, bride looks left toward the groom).
    const groomTarget = arrivedRef.current ? Math.PI / 2 : groomIdleTarget;
    const brideTarget = arrivedRef.current ? (3 * Math.PI) / 2 : Math.PI;
    const turn = Math.min(1, delta * 3);
    if (groomRef.current) {
      groomRef.current.position.set(groomX, 0, groomZ);
      groomRef.current.rotation.y += (groomTarget - groomRef.current.rotation.y) * turn;
    }
    if (brideRef.current) {
      brideRef.current.position.set(brideX, 0, z);
      brideRef.current.rotation.y += (brideTarget - brideRef.current.rotation.y) * turn;
    }
    // Publish the couple's eye positions so the first-person camera can ride along,
    // even for a hidden figure (whose group ref is null).
    if (headsRef) {
      headsRef.current.groom.set(groomX, FIRST_PERSON_EYE_Y, groomZ);
      headsRef.current.bride.set(brideX, FIRST_PERSON_EYE_Y, z);
      headsRef.current.arrived = arrivedRef.current;
    }
  });

  // Only the bride is walking when the groom waits, so his clip must not be the
  // walk cycle — a groom marching on the spot at the altar is worse than no
  // animation at all.
  const moving = playing && !arrived;
  const groomMoving = moving && !waitsAtAltar;

  return (
    <>
      {hideFigure !== "groom" ? (
        <group
          position={[groomX, 0, waitsAtAltar ? PROCESSION_END_Z + coupleMark.z : PROCESSION_START_Z]}
          ref={groomRef}
          rotation={[0, Math.PI, 0]}
        >
          <AnimatedFigure
            clip={groomMoving ? "walk" : "idle"}
            pose={groomMoving ? POSE_RELAXED : POSE_HANDS_CLASPED}
            recolor={GROOM_COLORS}
            rotationY={0}
            url={FIGURE_SUIT}
          />
          {couplePhotos?.groom ? (
            <Billboard position={[0, COUPLE_FACE_Y, 0]}>
              <FaceDisc photoUrl={couplePhotos.groom} radius={0.115} />
            </Billboard>
          ) : null}
        </group>
      ) : null}
      {hideFigure !== "bride" ? (
        <group position={[brideX, 0, PROCESSION_START_Z]} ref={brideRef} rotation={[0, Math.PI, 0]}>
          <AnimatedFigure clip={moving ? "walk" : "idle"} pose={POSE_BOUQUET} recolor={BRIDE_COLORS} rotationY={0} url={FIGURE_WOMAN} />
          <BridalGown />
          <Bouquet />
          {couplePhotos?.bride ? (
            <Billboard position={[0, COUPLE_FACE_Y, 0]}>
              <FaceDisc photoUrl={couplePhotos.bride} radius={0.115} />
            </Billboard>
          ) : null}
        </group>
      ) : null}
    </>
  );
}

type SeatLayoutParams = {
  aisleShift: number;
  pewYaw: number;
  rowSpacing: number;
};

const DEFAULT_SEAT_LAYOUT: SeatLayoutParams = { aisleShift: 0, pewYaw: 0, rowSpacing: 0.62 };

// Distance from the nave centreline to each pew block's centre. The blocks are
// 2.55 wide, so this also sets the aisle: 2.2 leaves 1.85m between the pew ends,
// which a gown and a groom can share. At the old 1.82 the gap was 1.09m and the
// bride's skirt intersected the bench.
const PEW_BLOCK_X = 2.2;

// The nave's pews follow the wedding it is actually holding: enough rows to seat
// everyone with a couple spare, never so many that a small wedding is framed
// against half a hall of empty benches. Eight seats per row is what the 3D lays
// out, four each side of the aisle.
const NAVE_SEATS_PER_ROW = 8;
// A nave reads as a church at eight rows; below that it reads as a chapel set
// built for the render. Small weddings still fill only the front rows.
const MIN_PEW_ROWS = 8;
const MAX_PEW_ROWS = 14;

function navePewRows(guestCount: number) {
  return Math.max(MIN_PEW_ROWS, Math.min(MAX_PEW_ROWS, Math.ceil(guestCount / NAVE_SEATS_PER_ROW) + 2));
}

function buildChurchSeatedGuests(
  visibleRows: number,
  maxGuests: number,
  layout: SeatLayoutParams = DEFAULT_SEAT_LAYOUT
): CongregationSeat[] {
  const result: CongregationSeat[] = [];
  const seatOffsets = [-0.86, -0.29, 0.29, 0.86];
  let count = 0;

  for (let row = 0; row < visibleRows; row += 1) {
    const z = -2.4 + row * layout.rowSpacing;

    for (const side of [-1, 1]) {
      // The figures sit ON the pew block, so they inherit its aisle shift and
      // rotate around the same block centre when the layout curves the rows.
      const sideCenter = side * (PEW_BLOCK_X + layout.aisleShift);
      const yaw = side * layout.pewYaw;

      for (let seat = 0; seat < seatOffsets.length; seat += 1) {
        if (count >= maxGuests) {
          return result;
        }

        const seed = row * 4 + seat * 5 + (side < 0 ? 0 : 7);
        const dx = seatOffsets[seat];
        result.push({
          id: `church-guest-${row}-${sideCenter}-${seat}`,
          position: [sideCenter + dx * Math.cos(yaw), 0, z + 0.07 - dx * Math.sin(yaw)],
          variant: (seed * 7 + row * 3) % CONGREGATION_MODELS.length,
          // Most face the altar; roughly one in six is turned toward whoever is
          // next to them, which is what a church looks like before the doors open.
          rotationY:
            Math.PI +
            yaw +
            ((seed % 7) - 3) * 0.075 +
            (seed % 6 === 0 ? (seat % 2 === 0 ? 0.42 : -0.42) : 0)
        });
        count += 1;
      }
    }
  }

  return result;
}

// Development-only capture hook. The browser throttles requestAnimationFrame when a
// tab or pane is occluded, which pauses R3F's render loop — and a canvas resize in
// that state clears the drawing buffer to black. That made visual iteration on this
// scene impossible from a headless/occluded pane: every screenshot came back a
// single flat colour, which is easy to misread as "the 3D is broken" (it was, for
// three sessions). Exposing the renderer lets a still be forced synchronously,
// independent of the frame loop. Stripped from production builds.
function SceneCaptureHook() {
  const { camera, gl, scene } = useThree();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }

    const target = window as typeof window & { __wfsScene?: unknown };
    target.__wfsScene = {
      camera,
      gl,
      scene,
      // Force one synchronous frame, then hand back the pixels. preserveDrawingBuffer
      // is already set on the Canvas, so toDataURL is reliable after this.
      capture(maxWidth = 900, quality = 0.75) {
        gl.render(scene, camera);
        const source = gl.domElement;
        const width = Math.min(maxWidth, source.width);
        const height = Math.round(source.height * (width / source.width));
        const off = document.createElement("canvas");
        off.width = width;
        off.height = height;
        const ctx = off.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(source, 0, 0, width, height);
        // Report colour variety so a caller can tell a real frame from a blank one.
        const data = ctx.getImageData(0, 0, width, height).data;
        const seen = new Set<string>();
        for (let i = 0; i < data.length; i += 4 * 997) {
          seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }
        return { dataUrl: off.toDataURL("image/jpeg", quality), distinctColours: seen.size, width, height };
      }
    };

    return () => {
      delete target.__wfsScene;
    };
  }, [camera, gl, scene]);

  return null;
}

// The chancel focal arch. An earlier attempt drew three flat pale lancets on
// the wall and they read as gravestones: same tone as the wall, no depth, no
// occlusion. This version is real geometry — the surround is an extruded arched
// ring that projects from the wall face, so it self-shadows, catches the key
// light on its bevel, and gives N8AO an actual corner to darken. One arch, not
// an arcade: the house rule is one focal surface.
function lancetRingGeometry(halfWidth: number, bodyHeight: number, thickness: number, depth: number) {
  const outer = lancetShape(halfWidth + thickness, bodyHeight + thickness * 2);
  const inner = lancetShape(halfWidth, bodyHeight);
  // A hole must wind opposite to its outline, hence the reverse().
  outer.holes.push(new THREE.Path(inner.getPoints(64).reverse()));
  return new THREE.ExtrudeGeometry(outer, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.014,
    bevelThickness: 0.014,
    curveSegments: 28,
    depth
  });
}

const NICHE_HALF_WIDTH = 0.82;
const NICHE_BODY = 2.2;
const NICHE_CENTER_Y = 1.72;

function ChancelArch({ wallFaceZ }: { wallFaceZ: number }) {
  const field = useMemo(() => lancetGeometry(NICHE_HALF_WIDTH, NICHE_BODY), []);
  const surround = useMemo(() => lancetRingGeometry(NICHE_HALF_WIDTH, NICHE_BODY, 0.17, 0.24), []);
  useEffect(
    () => () => {
      field.dispose();
      surround.dispose();
    },
    [field, surround]
  );

  return (
    <group position={[0, NICHE_CENTER_Y, 0]}>
      {/* The recessed field, a clear tonal step below the wall so the opening
          reads as depth rather than a painted shape. */}
      <mesh geometry={field} position={[0, 0, wallFaceZ + 0.004]} receiveShadow>
        <meshStandardMaterial color="#b0a284" roughness={0.92} />
      </mesh>
      {/* Moulded surround, projecting 24cm into the room. */}
      <mesh castShadow geometry={surround} position={[0, 0, wallFaceZ]} receiveShadow>
        <meshStandardMaterial color="#e3d9be" roughness={0.85} />
      </mesh>
      {/* Flanking pilasters and their caps, framing the chancel. */}
      {[-1.62, 1.62].map((x) => (
        <group key={x}>
          <mesh castShadow position={[x, 0.28, wallFaceZ + 0.07]} receiveShadow>
            <boxGeometry args={[0.22, 3.5, 0.14]} />
            <meshStandardMaterial color="#ded4b8" roughness={0.87} />
          </mesh>
          <mesh castShadow position={[x, 2.06, wallFaceZ + 0.09]}>
            <boxGeometry args={[0.31, 0.15, 0.19]} />
            <meshStandardMaterial color="#e6dcc1" roughness={0.85} />
          </mesh>
          <mesh castShadow position={[x, -1.47, wallFaceZ + 0.09]}>
            <boxGeometry args={[0.31, 0.17, 0.19]} />
            <meshStandardMaterial color="#d5caad" roughness={0.88} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Window light, done honestly. An earlier pass faked this with additive cones,
// which rendered as opaque wedges because there was no view-dependent thickness
// term — they were deleted. The real technique is a gobo: three's SpotLight can
// carry a projected texture in `light.map`, so feeding it the leaded-glass canvas
// throws an actual window pattern across the floor and pews. Two constraints,
// both learned from three's source:
//   - `map` needs castShadow. three only builds the light's projection matrix
//     when shadows are on, so a non-shadowing spot projects nothing.
//   - `distance` must comfortably clear the target. The shader clips the map in
//     z, and a too-short distance yields full unmodulated light instead.
// The nave walls do not cast shadows, so the beam passes through the wall plane
// and the cookie alone shapes it — which is exactly what a window does.
const GOBO_ZS = [-3.2, -0.7, 1.8];

function WindowGobo({ cookie, intensity, z }: { cookie: THREE.Texture; intensity: number; z: number }) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    // Raking down and across the nave, so the patch lands on the aisle rather
    // than on the wall it came through.
    target.position.set(-2.7, 0.05, z - 2.1);
    const light = lightRef.current;
    if (light) {
      light.target = target;
      light.map = cookie;
    }
  }, [cookie, target, z]);

  return (
    <>
      <primitive object={target} />
      <spotLight
        angle={0.3}
        castShadow
        color="#ffe0ad"
        decay={0}
        distance={26}
        intensity={intensity}
        penumbra={0.58}
        position={[6.1, 3.7, z + 0.5]}
        ref={lightRef}
        shadow-bias={-0.0009}
        shadow-camera-far={26}
        shadow-camera-near={0.5}
        shadow-mapSize={[1024, 1024]}
        shadow-normalBias={0.03}
      />
    </>
  );
}

function WindowGobos({ intensity }: { intensity: number }) {
  const cookie = useMemo(() => {
    const texture = createStainedGlassTexture(7);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(() => () => cookie.dispose(), [cookie]);

  return (
    <>
      {GOBO_ZS.map((z) => (
        <WindowGobo cookie={cookie} intensity={intensity} key={z} z={z} />
      ))}
    </>
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

      {/* Chancel wall: a carved blind arcade. This used to be a flat 2.6x4
          panel — it read as a projector screen with a cross taped to it. Three
          arched bays with raised mouldings and flanking pilasters give the
          altar real architecture to sit against, and the projecting stone
          catches the key light instead of flattening out. */}
      <ChancelArch wallFaceZ={-5.735} />

      {/* Nave cornice and dado string course. Both clear the side windows —
          the windows occupy y 1.4 to 4.3, so a band anywhere between would
          slice straight through the glass. */}
      {[-4.72, 4.72].map((x) => (
        <group key={x}>
          <mesh castShadow position={[x, 4.62, 0.1]} receiveShadow>
            <boxGeometry args={[0.15, 0.19, 12.4]} />
            <meshStandardMaterial color="#ded3b6" roughness={0.86} />
          </mesh>
          <mesh castShadow position={[x, 1.02, 0.1]} receiveShadow>
            <boxGeometry args={[0.1, 0.1, 12.4]} />
            <meshStandardMaterial color="#d8ccae" roughness={0.88} />
          </mesh>
        </group>
      ))}
      {/* Entablature capping the chancel arch. */}
      <mesh castShadow position={[0, 4.03, -5.66]} receiveShadow>
        <boxGeometry args={[10.1, 0.2, 0.16]} />
        <meshStandardMaterial color="#e0d5b8" roughness={0.86} />
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

      <StainedGlassWindow position={[-2.9, 4.94, -5.7]} rectHeight={0.9} seed={4} width={0.7} />
      <StainedGlassWindow position={[2.9, 4.94, -5.7]} rectHeight={0.9} seed={1} width={0.7} />
      <Crucifix position={[0, 2.14, -5.66]} />

      <WindowGobos intensity={2.6} />

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

function CeremonyFocalPoint({
  decorScale,
  floralMark,
  palette,
  venueType
}: {
  decorScale: number;
  floralMark: StudioSceneOffset;
  palette: Palette;
  venueType: StudioVenueType;
}) {
  if (venueType === "garden" || venueType === "beach") {
    return <CeremonyArch decorScale={decorScale} palette={palette} venueType={venueType} />;
  }

  if (venueType === "hall") {
    return <HallFocalPoint decorScale={decorScale} palette={palette} />;
  }

  if (venueType === "church") {
    return <ChurchAltar decorScale={decorScale} floralMark={floralMark} palette={palette} />;
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

// Blooms built from petals, not from spheres. A sphere has no silhouette a florist
// would recognise, which is why the altar arrangements read as styrofoam balls: a
// real bloom is a cupped whorl of petals with a visible centre, and real greenery
// is blades, not green marbles.
//
// Everything is merged down to one geometry per bloom and one per leaf, then reused
// across every arrangement, so the whole church still costs a handful of draw calls.
function buildBloomGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const matrix = new THREE.Matrix4();
  const euler = new THREE.Euler();

  const whorl = (count: number, petalSize: number, tilt: number, spread: number, lift: number, phase: number) => {
    for (let i = 0; i < count; i += 1) {
      const angle = phase + (i / count) * Math.PI * 2;
      // A shallow dome flattened on its axis reads as a cupped petal.
      const petal = new THREE.SphereGeometry(petalSize, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.58);
      petal.scale(1.18, 0.46, 1.05);
      euler.set(tilt, angle, 0, "YXZ");
      matrix.makeRotationFromEuler(euler);
      matrix.setPosition(Math.sin(angle) * spread, lift, Math.cos(angle) * spread);
      petal.applyMatrix4(matrix);
      parts.push(petal);
    }
  };

  // Outer petals splay wide, the inner whorl stands up around the centre.
  whorl(6, 0.5, 1.02, 0.42, 0.0, 0);
  whorl(5, 0.38, 0.62, 0.24, 0.16, 0.55);
  const core = new THREE.SphereGeometry(0.26, 10, 8);
  core.translate(0, 0.24, 0);
  parts.push(core);

  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  merged.computeVertexNormals();
  return merged;
}

function buildLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.3, 0.2, 0.72, 0.15, 1, 0);
  shape.bezierCurveTo(0.72, -0.15, 0.3, -0.2, 0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, curveSegments: 7, depth: 0.02 });
  geometry.computeVertexNormals();
  return geometry;
}

let bloomGeometry: THREE.BufferGeometry | null = null;
let leafGeometry: THREE.BufferGeometry | null = null;

function getBloomGeometry() {
  bloomGeometry = bloomGeometry ?? buildBloomGeometry();
  return bloomGeometry;
}

function getLeafGeometry() {
  leafGeometry = leafGeometry ?? buildLeafGeometry();
  return leafGeometry;
}

// x, y, z, scale, tilt, spin, colour key
type BloomPlacement = [number, number, number, number, number, number, "ivory" | "cream" | "blush"];
// x, y, z, length, pitch, yaw, roll
type LeafPlacement = [number, number, number, number, number, number, number];

const BLOOM_LAYOUT: BloomPlacement[] = [
  [0, 0.04, 0.12, 0.42, -0.16, 0.0, "ivory"],
  [0.3, 0.09, 0.07, 0.36, -0.1, 1.1, "blush"],
  [-0.31, 0.05, 0.07, 0.35, -0.12, 2.2, "cream"],
  [0.14, 0.31, 0.05, 0.33, -0.34, 0.6, "blush"],
  [-0.17, 0.29, 0.04, 0.31, -0.32, 3.0, "ivory"],
  [0.02, 0.5, 0.0, 0.28, -0.5, 1.7, "cream"],
  [0.36, 0.25, 0.0, 0.27, -0.28, 2.6, "cream"],
  [-0.37, 0.22, 0.02, 0.27, -0.26, 0.3, "blush"],
  [0.22, -0.12, 0.11, 0.3, 0.24, 1.4, "cream"],
  [-0.24, -0.11, 0.1, 0.29, 0.26, 2.9, "ivory"],
  [0, -0.03, 0.22, 0.27, 0.1, 0.9, "blush"],
  [0.12, -0.25, 0.05, 0.24, 0.7, 2.1, "ivory"],
  [-0.13, -0.24, 0.14, 0.23, 0.66, 0.45, "cream"],
  [0.45, 0.04, 0.06, 0.24, -0.05, 1.95, "ivory"],
  [-0.46, 0.06, 0.05, 0.23, -0.05, 3.4, "blush"]
];

const LEAF_LAYOUT: LeafPlacement[] = [
  [0.02, -0.4, -0.02, 0.72, -0.2, 0.2, -1.15],
  [-0.5, -0.3, -0.03, 0.66, -0.14, 0.75, -0.62],
  [0.54, -0.26, -0.03, 0.68, -0.14, -0.75, 0.62],
  [-0.4, 0.48, -0.02, 0.5, 0.06, 2.3, 0.85],
  [0.46, 0.44, -0.02, 0.48, 0.06, -2.3, -0.85],
  [0.0, 0.68, -0.04, 0.44, 0.22, 0.35, 0.08],
  [-0.62, 0.04, -0.04, 0.58, -0.08, 1.5, -0.3],
  [0.64, 0.0, -0.04, 0.56, -0.08, -1.5, 0.3],
  [-0.22, -0.44, 0.08, 0.5, 0.34, 0.45, -0.9],
  [0.26, -0.42, 0.08, 0.52, 0.34, -0.45, 0.9],
  [-0.3, 0.66, 0.02, 0.4, 0.14, 2.85, 0.5],
  [0.34, 0.62, 0.02, 0.38, 0.14, -2.85, -0.5]
];

function FlowerCluster({ palette, position, radius }: { palette: Palette; position: [number, number, number]; radius: number }) {
  const bloom = getBloomGeometry();
  const leaf = getLeafGeometry();
  const colors: Record<BloomPlacement[6], string> = {
    blush: palette.blush,
    cream: "#efe6d6",
    ivory: "#f6f0e5"
  };

  return (
    <group position={position} scale={radius}>
      {BLOOM_LAYOUT.map(([x, y, z, size, tilt, spin, key], index) => (
        <mesh castShadow geometry={bloom} key={`b${index}`} position={[x, y, z]} rotation={[tilt, spin, 0]} scale={size}>
          <meshStandardMaterial color={colors[key]} roughness={0.86} />
        </mesh>
      ))}
      {LEAF_LAYOUT.map(([x, y, z, length, pitch, yaw, roll], index) => (
        <mesh
          castShadow
          geometry={leaf}
          key={`l${index}`}
          position={[x, y, z]}
          rotation={[pitch, yaw, roll]}
          scale={[length * 0.78, length * 0.5, length * 0.7]}
        >
          <meshStandardMaterial color={index % 2 === 0 ? "#66774f" : "#75855a"} roughness={0.88} side={THREE.DoubleSide} />
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
  // Both interiors hang warm pendants from the ceiling — garden lantern poles
  // belong outdoors and never appear inside a room.
  if (venueType === "church" || venueType === "hall") {
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
      {/* The backrest belongs BEHIND the sitter, on the entrance side. It sat at
          z -0.14, on the altar side, so every pew in the church faced backwards
          and the congregation appeared to be sitting in front of its own bench. */}
      <mesh castShadow receiveShadow position={[0, 0.2, 0.14]}>
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
  dinnerTables,
  highQuality = true,
  onMoveObject,
  onSelectObject,
  palette,
  sceneEdits,
  selectedObjectId,
  venueType,
  viewMode
}: {
  capacity: WeddingStudioCapacity;
  dinnerTables?: DinnerTable[];
  highQuality?: boolean;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  palette: Palette;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
  venueType: StudioVenueType;
  viewMode: StudioViewMode;
}) {
  // Prefer the couple's REAL tables: their actual count laid out in a tidy grid,
  // each ringed by its actual seated headcount. The room fits ~12 tables, so
  // larger plans render a representative dozen (the exact number lives in the
  // inspector). Fall back to a capacity estimate only when no tables exist yet.
  const hasRealTables = Boolean(dinnerTables && dinnerTables.length > 0);
  const tableCount = hasRealTables
    ? Math.min(12, dinnerTables!.length)
    : Math.min(10, Math.max(4, Math.ceil(capacity.visibleGuestMarkers / 14)));
  const tablePositions = useMemo(() => buildReceptionTablePositions(tableCount), [tableCount]);
  const seatCounts = useMemo(() => {
    if (hasRealTables) {
      // Only the guests actually seated at a table get a chair — an unseated
      // table stands empty rather than inventing people who don't exist.
      return tablePositions.map((_, index) => Math.min(10, dinnerTables![index]?.assignedGuestIds.length ?? 0));
    }
    const perTable = Math.min(10, Math.max(4, capacity.seatsPerRow));
    return tablePositions.map(() => perTable);
  }, [capacity.seatsPerRow, dinnerTables, hasRealTables, tablePositions]);
  const receptionSeats = useMemo(() => buildReceptionSeats(tablePositions, seatCounts), [seatCounts, tablePositions]);
  // One chair per occupied seat. The diners were sitting on nothing.
  const dinnerChairs = receptionSeats;
  // The couple, seated at the head table (z=-4.3), just behind it and facing the
  // room (+z). Appended to the guest seats so one instanced congregation draws
  // everyone — the couple always appear, even before any guests are seated.
  const receptionSeatsWithCouple = useMemo<CongregationSeat[]>(
    () => [
      ...receptionSeats,
      { id: "dinner-couple-groom", position: [-0.34, 0, -4.86], rotationY: 0, variant: 0 },
      { id: "dinner-couple-bride", position: [0.34, 0, -4.86], rotationY: 0, variant: 6 }
    ],
    [receptionSeats]
  );
  const tablescapeColors = useMemo<TablescapeColors>(
    () => ({ accent: palette.accent, candle: palette.candle, cloth: "#f6eedb", floral: palette.blush }),
    [palette.accent, palette.blush, palette.candle]
  );
  // The dinner is ALWAYS the indoor hall — the couple's evening room, never an
  // open-air stand-in. (CeremonyScene clamps the venue too; this is the belt.)
  const receptionVenue: StudioVenueType = "hall";
  const surface = getVenueSurface(receptionVenue, palette);
  void venueType;

  return (
    <group>
      {/* Real PBR stone floor (same loader as the church), tinted warm honey so
          the room reads as parquet-over-stone in the evening light. */}
      <Suspense
        fallback={
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0.25]}>
            <planeGeometry args={[10.2, 12.8]} />
            <meshStandardMaterial color={surface.floor} roughness={0.76} />
          </mesh>
        }
      >
        <TexturedGround color="#d9c39b" position={[0, -0.04, 0.25]} size={[10.2, 12.8]} />
      </Suspense>

      <VenueBoundary palette={palette} venueType={receptionVenue} viewMode={viewMode} />

      {/* The dance floor sits at the FRONT of the room (near the entrance),
          clear of the banquet grid behind it — head table → guest tables →
          dance floor → entrance, a natural evening flow. */}
      <EditableSceneObject
        objectId="danceFloor"
        onMoveObject={onMoveObject}
        onSelectObject={onSelectObject}
        outlineCenter={[0, 4.3]}
        sceneEdits={sceneEdits}
        selectedObjectId={selectedObjectId}
        size={[2.9, 2.55]}
      >
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 4.3]}>
          <planeGeometry args={[2.45, 2.15]} />
          <meshStandardMaterial color={surface.path} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} roughness={0.62} />
        </mesh>

        <mesh castShadow receiveShadow position={[0, 0.04, 4.3]}>
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
          <group key={tableIndex} position={position}>
            <DinnerTablescape colors={tablescapeColors} radius={0.58} seed={position[0] * 2.3 + position[2] * 1.7} />
          </group>
        ))}
        <Suspense fallback={null}>
          {/* One congregation instance covers the guest tables AND the couple at
              the head table, so the couple ride the same instanced meshes rather
              than spawning a second full 9-variant congregation. */}
          {dinnerChairs.map((seat) => (
            <DinnerChair key={`chair-${seat.id}`} position={seat.position} rotationY={seat.rotationY} />
          ))}
          <ChurchCongregation highQuality={highQuality} seats={receptionSeatsWithCouple} />
        </Suspense>
      </EditableSceneObject>

      {/* The couple's head table sits at the back, facing the room, dressed like
          the guest tables. The couple figures themselves are seated via the
          shared congregation above. */}
      <group position={[0, 0, -4.3]}>
        <mesh castShadow receiveShadow position={[0, 0.33, 0]}>
          <boxGeometry args={[2.4, 0.66, 0.72]} />
          <meshStandardMaterial color={tablescapeColors.cloth} roughness={0.85} />
        </mesh>
        <mesh receiveShadow position={[0, 0.662, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.4, 0.72]} />
          <meshStandardMaterial color={tablescapeColors.cloth} roughness={0.8} />
        </mesh>
        {[-0.7, 0, 0.7].map((x) => (
          <group key={x} position={[x, 0.68, 0]}>
            <mesh castShadow position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.02, 0.024, 0.26, 10]} />
              <meshStandardMaterial color="#f3ead2" roughness={0.55} />
            </mesh>
            <FlickerFlame base={2.3} color={palette.candle} position={[0, 0.29, 0]} radius={0.023} seed={x * 6.1} />
          </group>
        ))}
        <FlowerCluster palette={palette} position={[0, 0.71, 0.02]} radius={0.2} />
      </group>

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
      {/* Cake table tucked into the back-left corner, clear of the head table
          and the couple seated behind it. */}
      <mesh castShadow receiveShadow position={[-2.9, 0.25, -4.9]}>
        <boxGeometry args={[1.3, 0.5, 0.36]} />
        <meshStandardMaterial color={palette.blush} roughness={0.66} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.55, 0.012, 1.1]}>
        <planeGeometry args={[0.28, 6.9]} />
        <meshStandardMaterial color={palette.candle} depthWrite={false} opacity={0.5} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} roughness={0.58} transparent />
      </mesh>

      <LightingRibbon decorScale={0.82} palette={palette} venueType={receptionVenue} />
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

  return (venueType === "church" ? 32 : venueType === "hall" ? 34 : 36) + portraitBoost;
}

function getCameraPosition(viewMode: StudioViewMode, venueType: StudioVenueType, activeStep: StudioPlanningStepId): [number, number, number] {
  // The church is an enclosed nave, so the eye sits inside it looking down the
  // aisle toward the altar (matching the reference one-point perspective). The
  // hero "3d" view shoots from standing eye height at the back of the nave —
  // wedding-photography grammar, not the old drone altitude.
  if (venueType === "church" && activeStep !== "reception") {
    const churchPositions: Record<StudioViewMode, [number, number, number]> = {
      "3d": [0, 1.7, 8.7],
      guest: [0, 1.45, 4.2],
      top: [0, 11, 0.4],
      walkthrough: [0, 1.85, 4.8]
    };

    return churchPositions[viewMode];
  }

  // The dinner hall has a real ceiling at ~3.8 m — every eye stays inside the
  // room, a guest's-height view across the candlelit tables.
  if (venueType === "hall") {
    const hallPositions: Record<StudioViewMode, [number, number, number]> = {
      "3d": [0, 1.85, 7.6],
      guest: [0, 1.5, 5.4],
      top: [0, 10.6, 0.5],
      walkthrough: [0, 1.9, 6.4]
    };

    return hallPositions[viewMode];
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

  if (venueType === "hall") {
    const hallTargets: Record<StudioViewMode, [number, number, number]> = {
      "3d": [0, 0.95, -2.2],
      guest: [0, 0.9, -1.4],
      top: [0, 0, 0.2],
      walkthrough: [0, 0.95, -2]
    };

    return hallTargets[viewMode];
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
  // A tidy banquet grid in front of the head table (which sits at z ≈ -4.5),
  // filling the hall footprint from the dais toward the entrance. Two columns up
  // to six tables, three columns beyond, so the room never feels lopsided.
  const count = Math.max(1, Math.min(12, tableCount));
  const cols = count <= 2 ? count : count <= 6 ? 2 : 3;
  const xSpan = cols === 3 ? 2.5 : 2.9;
  const zSpan = 1.5;
  const positions: Array<[number, number, number]> = [];
  let placed = 0;

  // Tables sit ON the floor (y=0): their seated guests are placed at y=0 too, so
  // a lifted table would float its cloth and swallow the guests' heads. The grid
  // fills the central band between the head table (back) and the dance floor
  // (front), never colliding with either.
  for (let row = 0; placed < count; row += 1) {
    const rowCount = Math.min(cols, count - placed);
    for (let col = 0; col < rowCount; col += 1) {
      const x = (col - (rowCount - 1) / 2) * xSpan;
      const z = -2.4 + row * zSpan;
      positions.push([x, 0, z]);
      placed += 1;
    }
  }

  return positions;
}

// Real seated guests ringed around each dinner table, facing the centre, feet
// on the floor — reuses the instanced congregation meshes.
function buildReceptionSeats(tablePositions: Array<[number, number, number]>, seatsPerTable: number | number[]): CongregationSeat[] {
  const seats: CongregationSeat[] = [];
  // Tight enough that the seat ring clears the head table / dance floor by the
  // room's margins, wide enough that guests sit just outside the 0.58 cloth.
  const radius = 0.85;

  tablePositions.forEach(([tx, , tz], tableIndex) => {
    const seatsHere = Array.isArray(seatsPerTable) ? seatsPerTable[tableIndex] ?? 0 : seatsPerTable;
    for (let seat = 0; seat < seatsHere; seat += 1) {
      const angle = (seat / seatsHere) * Math.PI * 2 + (tableIndex % 2) * 0.42;
      const gx = tx + Math.cos(angle) * radius;
      const gz = tz + Math.sin(angle) * radius;
      seats.push({
        id: `reception-${tableIndex}-${seat}`,
        position: [gx, 0, gz],
        rotationY: Math.atan2(tx - gx, tz - gz) + ((seat % 5) - 2) * 0.04,
        variant: (tableIndex * 7 + seat * 3) % CONGREGATION_MODELS.length
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
  // Local labels — venueOptions no longer lists every engine venue, and the
  // dinner room deserves its own name rather than a generic "Venue" fallback.
  const labels: Record<StudioVenueType, string> = {
    beach: "Beach",
    church: "Church",
    garden: "Garden",
    hall: "Dinner room"
  };

  return labels[venueType];
}

function getSceneSignal(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, venueType: StudioVenueType) {
  const labels: Record<StudioPlanningStepId, string> = {
    ceremony: `${navePewRows(capacity.visibleGuestMarkers)} pew rows set`,
    budget: "Budget level visualized",
    guests: `${capacity.visibleGuestMarkers} guest markers shown`,
    preview: "Preview perspective ready",
    reception: "Dinner room shown",
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
