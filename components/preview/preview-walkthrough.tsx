"use client";

import { useMemo } from "react";
import { CeremonyScene, type SceneCameraOverride, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useLocalProject } from "@/lib/use-local-project";
import { sampleWedding } from "@/lib/wedding-data";
import {
  calculateWeddingStudioCapacity,
  createWeddingStudioPlanFromWedding,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  type StudioPlanningStepId
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
  { camera: { position: [0, 4.6, 9], target: [0, 0.5, -1.2] }, lighting: "dusk", step: "reception" }, // Cocktail hour
  { camera: { position: [0, 5, 9], target: [0, 0.4, -1] }, lighting: "dusk", step: "reception" }, // Reception entrance
  { camera: { position: [0, 3.3, 6.4], target: [0, 0.4, -0.6] }, lighting: "dusk", step: "reception" }, // Dinner
  { camera: { position: [0, 2.3, 5.6], target: [0, 0.7, -3.8] }, lighting: "dusk", step: "reception" }, // Speeches
  { camera: { position: [1.7, 1.7, 3.4], target: [0, 0.6, -0.4] }, lighting: "dusk", step: "reception" }, // Cake
  { camera: { position: [0, 2.1, 4.6], target: [0, 0.6, 0.9] }, lighting: "dusk", step: "reception" }, // First dance
  { camera: { position: [0, 3.4, 6.4], target: [0, 0.5, 0.6] }, lighting: "dusk", step: "reception" } // Party
];

type PreviewWalkthroughProps = {
  phaseIndex: number;
};

export function PreviewWalkthrough({ phaseIndex }: PreviewWalkthroughProps) {
  const { hasLocalProject, wedding } = useLocalProject();
  const activeWedding = hasLocalProject ? wedding : sampleWedding;

  const plan = useMemo(() => createWeddingStudioPlanFromWedding(activeWedding, defaultWeddingStudioPlan), [activeWedding]);
  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);

  const waypoint = walkthrough[Math.min(phaseIndex, walkthrough.length - 1)] ?? walkthrough[0];

  return (
    <CeremonyScene
      activeStep={waypoint.step}
      budgetLevel={plan.budgetLevel}
      cameraOverride={waypoint.camera}
      capacity={capacity}
      colorDirection={plan.colorDirection}
      lighting={waypoint.lighting}
      onMoveObject={() => {}}
      onSelectObject={() => {}}
      sceneEdits={defaultStudioSceneEdits}
      selectedObjectId="focalPoint"
      style={plan.style}
      venueType={plan.venueType}
      viewMode="3d"
    />
  );
}
