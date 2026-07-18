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
  type StudioSceneEdits,
  type StudioPlanningStepId,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type Waypoint = {
  camera: SceneCameraOverride;
  lighting: SceneLighting;
  step: StudioPlanningStepId;
};

// One cinematic waypoint per preview moment, in the same order as previewPhases.
// Ceremony moments fly the aisle in daylight; the day warms to dusk as the
// reception unfolds, so the camera literally walks the day before it happens.
const walkthrough: Waypoint[] = [
  { camera: { position: [0, 1.95, 5.3], target: [0, 1.05, -4.4] }, lighting: "day", step: "preview" }, // Guest arrival — back of the nave
  { camera: { position: [0, 1.85, 3.9], target: [0, 1.05, -4.4] }, lighting: "day", step: "preview" }, // Prelude — down the aisle
  { camera: { position: [0, 1.7, 2.3], target: [0, 1.1, -4.5] }, lighting: "day", step: "preview" }, // Processional
  { camera: { position: [0, 1.62, 1.2], target: [0, 1.05, -4.5] }, lighting: "day", step: "preview" }, // Vows — framing the altar
  { camera: { position: [0, 1.75, 2.6], target: [0, 1.05, -4.4] }, lighting: "day", step: "preview" }, // Recessional
  { camera: { position: [2.4, 1.95, 3], target: [0, 1, -4.2] }, lighting: "day", step: "preview" }, // Group photos — side angle
  // The dinner is an ENCLOSED hall with a ceiling at ~3.8 m — every reception
  // shot stays inside the room at guest height, entering through the doorway
  // and gliding between the candlelit tables.
  { camera: { position: [0, 1.9, 7.4], target: [0, 1, -1.6] }, lighting: "dusk", step: "reception" }, // Cocktail hour — at the doorway
  { camera: { position: [0, 1.8, 6.2], target: [0, 0.95, -1] }, lighting: "dusk", step: "reception" }, // Entrance — stepping into the room
  { camera: { position: [0, 2.4, 5.6], target: [0, 0.5, -0.8] }, lighting: "dusk", step: "reception" }, // Dinner — over the tables
  { camera: { position: [0, 2.1, 5.4], target: [0, 0.8, -3.6] }, lighting: "dusk", step: "reception" }, // Speeches — toward the head table
  { camera: { position: [1.7, 1.7, 3.4], target: [0, 0.6, -0.4] }, lighting: "dusk", step: "reception" }, // Cake
  { camera: { position: [0, 2, 4.6], target: [0, 0.6, 0.9] }, lighting: "dusk", step: "reception" }, // First dance
  { camera: { position: [0, 2.5, 5.9], target: [0, 0.6, 0.5] }, lighting: "dusk", step: "reception" } // Party — pulled back inside the room
];

type PreviewWalkthroughProps = {
  phaseIndex: number;
};

export function PreviewWalkthrough({ phaseIndex }: PreviewWalkthroughProps) {
  const { hasLocalProject, wedding } = useLocalProject();
  const activeWedding = hasLocalProject ? wedding : sampleWedding;

  const derivedPlan = useMemo(() => createWeddingStudioPlanFromWedding(activeWedding, defaultWeddingStudioPlan), [activeWedding]);

  // Reflect the couple's actual saved studio plan AND scene edits (style, decor,
  // seating, object nudges) — the preview used to ignore both, so switching
  // Edit → Preview on the home studio visibly reverted the look. Read post-mount
  // to stay hydration-safe.
  const [storedPlan, setStoredPlan] = useState<WeddingStudioPlan | null>(null);
  const [sceneEdits, setSceneEdits] = useState<StudioSceneEdits>(defaultStudioSceneEdits);
  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredWeddingStudioLayout();
      if (stored) {
        setStoredPlan(stored.plan);
        setSceneEdits(stored.sceneEdits);
      }
    });
  }, []);

  const plan = storedPlan ?? derivedPlan;
  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);

  const waypoint = walkthrough[Math.min(phaseIndex, walkthrough.length - 1)] ?? walkthrough[0];

  // The couple actually walks in during the processional (phase 2) and stays at
  // the altar through the ceremony — previously they stood frozen at the back
  // of the aisle the whole time, absent from their own vows.
  const autoProcessional = waypoint.step !== "reception" && phaseIndex >= 2;

  return (
    <CeremonyScene
      activeStep={waypoint.step}
      aisleWidthFeet={plan.aisleWidthFeet}
      autoProcessional={autoProcessional}
      budgetLevel={plan.budgetLevel}
      seatingLayout={plan.seatingLayout}
      cameraOverride={waypoint.camera}
      capacity={capacity}
      colorDirection={plan.colorDirection}
      lighting={waypoint.lighting}
      onMoveObject={() => {}}
      onSelectObject={() => {}}
      sceneEdits={sceneEdits}
      selectedObjectId="focalPoint"
      style={plan.style}
      venueType={plan.venueType}
      viewMode="3d"
    />
  );
}
