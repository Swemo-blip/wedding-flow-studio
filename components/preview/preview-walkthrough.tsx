"use client";

import { useEffect, useMemo, useState } from "react";
import { CeremonyScene, type SceneCameraOverride, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useLocalProject } from "@/lib/use-local-project";
import { readStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import { sampleWedding } from "@/lib/wedding-data";
import {
  calculateWeddingStudioCapacity,
  createWeddingStudioPlanFromWedding,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  type CeremonyStaging,
  type StudioSceneEdits,
  type StudioPlanningStepId,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type Waypoint = {
  camera: SceneCameraOverride;
  // The west doors, which until now were rendered with a hard-coded open={0} and
  // had never moved. Open for the arrival and the entrance; shut once everyone is
  // inside and the ceremony is under way.
  doorsOpen?: boolean;
  lighting: SceneLighting;
  step: StudioPlanningStepId;
};

// One cinematic waypoint per preview moment, in the same order as previewPhases.
// Ceremony moments fly the aisle in daylight; the day warms to dusk as the
// reception unfolds, so the camera literally walks the day before it happens.
// The arrival begins IN the doorway, and that position is forced by geometry
// rather than chosen. The portal opening is 1.2 x 1.4 in scene units, and those
// units are not metres: the measured standing figure is 1.10 units for a 1.75 m
// person, so the portal head at 1.4 is about 2.2 m of real door. A camera at the
// 1.85-1.95 the rest of this sequence uses is therefore standing at roughly
// 2.9 m — well ABOVE the lintel — and a dolly through the opening at that height
// travels through solid stone, not through the doors.
//
// So the first waypoint sits at 1.12, inside the opening, and the sequence cranes
// up as it enters. That is a real steadicam move rather than a compromise: a guest
// walking in genuinely does see the nave open up above them. The later waypoints
// keep their height because a preview has to see the couple over the congregation,
// which an honest 1.02-unit eye level cannot do from the back of a full church.
const walkthrough: Waypoint[] = [
  // Arrival — standing in the open portal at the height of the doorway, looking
  // the length of the nave. Verified on screen.
  //
  // A west-facing beat that actually SHOWS the doors swinging open was written and
  // then pulled, because it could not be verified: every other waypoint in this
  // list targets the altar, so the doors can open perfectly and no camera ever
  // sees it. Showing them needs a shot looking back at the portal, and that shot
  // frames a void — the nave floor stops 0.24 units past the west wall and beyond
  // it the scene holds nothing but the sky dome. It belongs with the facade, in
  // docs/blender-baked-venue.md, not in a camera path.
  // MEASURED against the rooms, after the audit found seven of these outside the
  // room they point at. Church interior (world): x ±4.85, z -5.49..6.44, y 0..5.6.
  // Hall interior (world): x ±4.81, z -5.40..6.25, ceiling y 2.375 units = 3.78 m.
  // A standing eye is 1.04 units (1.65 m / SCENE_UNIT_METRES 1.591) — the old
  // heights of 1.85-2.5 units were 2.9-4.0 m, i.e. filmed from a stepladder, and
  // two of them were literally above the dinner hall's ceiling.
  { camera: { position: [0, 1.1, 6.1], still: true, target: [0, 1.05, -4.4] }, doorsOpen: true, lighting: "day", step: "preview" }, // Arrival — inside the portal
  { camera: { position: [0, 1.15, 4.3], target: [0, 1.05, -4.4] }, doorsOpen: true, lighting: "day", step: "preview" }, // Prelude — down the aisle
  // THE PROCESSIONAL IS FILMED FROM THE FRONT OF THE AISLE, LOOKING BACK.
  // Every other shot in this list points at the altar, which put the camera
  // AHEAD of the couple facing away from them: they walked up the aisle behind
  // the lens and the owner never saw them arrive. A wedding videographer stands
  // where the couple are going, not where they came from.
  //
  // The first attempt at that put the lens at world z -3.2 — which is where the
  // OFFICIANT stands (ceremonyStagingMarks.celebrant, local -3.55 + INTERIOR_Z),
  // so the shot was the inside of a person and rendered as a blank cream frame.
  // This sits at z -1.0, ahead of where the couple stop (-2.30) and inside the
  // clear aisle (|x| < 0.925, from PEW_BLOCK_X 2.2 and PEW_BENCH_WIDTH 2.55), so
  // they approach the camera for the whole walk. They pass it at the very end,
  // which is fine: the next moment cuts to the vows at the altar.
  { camera: { position: [0.72, 1.15, -1], target: [0, 1.05, 4.2] }, lighting: "day", step: "preview" }, // Processional — they walk toward us
  { camera: { position: [0, 1.15, 0.6], target: [0, 1.05, -3.4] }, lighting: "day", step: "preview" }, // Vows — close on the couple at z -2.3
  { camera: { position: [0, 1.2, 2.2], target: [0, 1.05, -4.4] }, lighting: "day", step: "preview" }, // Recessional
  { camera: { position: [2.2, 1.3, 2.4], target: [0, 1.05, -3] }, lighting: "day", step: "preview" }, // Group photos — side angle
  // The dinner is an ENCLOSED hall with a ceiling at ~3.8 m — every reception
  // shot stays inside the room at guest height, gliding between the candlelit
  // tables. The hall's own side walls used to stop at world z 4.30 because the
  // bake deleted them (scripts/bake-hall-shell.py), which is why these numbers
  // and the room disagreed for so long.
  { camera: { position: [0, 1.2, 5.8], target: [0, 1, -1.6] }, lighting: "dusk", step: "reception" }, // Cocktail hour — at the open end
  { camera: { position: [0, 1.1, 5.2], target: [0, 0.95, -1] }, lighting: "dusk", step: "reception" }, // Entrance — stepping into the room
  { camera: { position: [0, 1.3, 4.4], target: [0, 0.55, -0.8] }, lighting: "dusk", step: "reception" }, // Dinner — over the tables
  { camera: { position: [0, 1.3, 4], target: [0, 0.8, -3.6] }, lighting: "dusk", step: "reception" }, // Speeches — toward the head table
  { camera: { position: [-1.5, 1.25, -2.4], target: [-2.9, 0.55, -4.65] }, lighting: "dusk", step: "reception" }, // Cake — the cake table is at (-2.9, -4.65), which the old shot missed by 15 m
  { camera: { position: [0, 1.3, 6], target: [0, 0.8, 4.3] }, lighting: "dusk", step: "reception" }, // First dance — looking AT the dance floor (world z 3.45..5.65), not standing on it
  { camera: { position: [0, 1.3, 5.6], target: [0, 0.7, 0.5] }, lighting: "dusk", step: "reception" } // Party — pulled back inside the room
];

// Exposed so a surface that already renders CeremonyScene (the home studio) can
// drive THAT scene through the walkthrough instead of mounting a second one.
// Mounting a second one tore the first down on every Edit⇄Preview switch and
// rebuilt ~900 meshes, which is what made Preview look broken for tens of
// seconds. Routes with no editor above them keep using the component below.
export function walkthroughWaypoint(phaseIndex: number): Waypoint {
  return walkthrough[Math.min(Math.max(phaseIndex, 0), walkthrough.length - 1)] ?? walkthrough[0];
}

// The couple actually walks in during the processional (phase 2) and stays at
// the altar through the ceremony.
export function isAutoProcessional(phaseIndex: number, waypoint: Waypoint): boolean {
  return waypoint.step !== "reception" && phaseIndex >= 2;
}

type PreviewWalkthroughProps = {
  phaseIndex: number;
  // The home studio hands over its LIVE state so Edit → Preview shows the same
  // scene. Without these the preview re-read localStorage and silently dropped
  // staging and the uploaded faces, so pressing Preview lost the groom waiting at
  // the altar, the singer, and every guest's face. Omitted on /preview, which has
  // no editor above it and falls back to the stored layout.
  congregationPhotos?: (string | null)[];
  couplePhotos?: { bride: string | null; groom: string | null };
  plan?: WeddingStudioPlan;
  sceneEdits?: StudioSceneEdits;
  staging?: CeremonyStaging;
};

export function PreviewWalkthrough({
  phaseIndex,
  congregationPhotos,
  couplePhotos,
  plan: livePlan,
  sceneEdits: liveSceneEdits,
  staging
}: PreviewWalkthroughProps) {
  const { dinnerTables, hasLocalProject, wedding } = useLocalProject();
  const activeWedding = hasLocalProject ? wedding : sampleWedding;

  const derivedPlan = useMemo(() => createWeddingStudioPlanFromWedding(activeWedding, defaultWeddingStudioPlan), [activeWedding]);

  // Reflect the couple's actual saved studio plan AND scene edits (style, decor,
  // seating, object nudges) — the preview used to ignore both, so switching
  // Edit → Preview on the home studio visibly reverted the look. Read post-mount
  // to stay hydration-safe.
  const [storedPlan, setStoredPlan] = useState<WeddingStudioPlan | null>(null);
  const [storedSceneEdits, setStoredSceneEdits] = useState<StudioSceneEdits>(defaultStudioSceneEdits);
  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredWeddingStudioLayout();
      if (stored) {
        setStoredPlan(stored.plan);
        setStoredSceneEdits(stored.sceneEdits);
      }
    });
  }, []);

  const plan = livePlan ?? storedPlan ?? derivedPlan;
  const sceneEdits = liveSceneEdits ?? storedSceneEdits;
  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);

  const waypoint = walkthroughWaypoint(phaseIndex);
  const autoProcessional = isAutoProcessional(phaseIndex, waypoint);

  return (
    <CeremonyScene
      activeStep={waypoint.step}
      aisleWidthFeet={plan.aisleWidthFeet}
      autoProcessional={autoProcessional}
      budgetLevel={plan.budgetLevel}
      dinnerTables={dinnerTables}
      seatingLayout={plan.seatingLayout}
      cameraOverride={waypoint.camera}
      capacity={capacity}
      colorDirection={plan.colorDirection}
      congregationPhotos={congregationPhotos}
      couplePhotos={couplePhotos}
      lighting={waypoint.lighting}
      onMoveObject={() => {}}
      onSelectObject={() => {}}
      sceneEdits={sceneEdits}
      selectedObjectId="focalPoint"
      staging={staging}
      style={plan.style}
      venueType={plan.venueType}
      viewMode="3d"
    />
  );
}
