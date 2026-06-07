"use client";

import { useEffect, useMemo, useState } from "react";
import { CeremonyScene } from "@/components/wedding-studio/church-scene";
import { PlanningStepper } from "@/components/wedding-studio/planning-stepper";
import { StudioControls } from "@/components/wedding-studio/studio-controls";
import { StudioSummary } from "@/components/wedding-studio/studio-summary";
import { StudioToolkit } from "@/components/wedding-studio/studio-toolkit";
import { sampleWedding } from "@/lib/wedding-data";
import { readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  clampSceneOffset,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  getEditableObjectsForStep,
  studioStepCopy,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type StudioPlanningStepId,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

export function WeddingStudio() {
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [activeStep, setActiveStep] = useState<StudioPlanningStepId>("ceremony");
  const [sceneEdits, setSceneEdits] = useState<StudioSceneEdits>(defaultStudioSceneEdits);
  const [selectedObjectId, setSelectedObjectId] = useState<StudioSceneObjectId>("focalPoint");
  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);
  const activeCopy = studioStepCopy[activeStep];
  const editableObjectIds = useMemo(() => getEditableObjectsForStep(activeStep), [activeStep]);
  const activeSelectedObjectId = editableObjectIds.includes(selectedObjectId) ? selectedObjectId : (editableObjectIds[0] ?? "focalPoint");

  useEffect(() => {
    queueMicrotask(() => {
      const storedLayout = readStoredWeddingStudioLayout();

      if (storedLayout) {
        setPlan(storedLayout.plan);
        setSceneEdits(storedLayout.sceneEdits);
        setActiveStep(storedLayout.activeStep);
      }
    });
  }, []);

  function updatePlan(nextPlan: WeddingStudioPlan) {
    setPlan(nextPlan);
    writeStoredWeddingStudioLayout(nextPlan, sceneEdits, activeStep);
  }

  function updateActiveStep(nextStep: StudioPlanningStepId) {
    setActiveStep(nextStep);
    writeStoredWeddingStudioLayout(plan, sceneEdits, nextStep);
  }

  function moveSceneObject(objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) {
    setSceneEdits((currentEdits) => {
      const currentOffset = currentEdits[objectId];
      const nextEdits = {
        ...currentEdits,
        [objectId]: {
          x: clampSceneOffset(currentOffset.x + deltaX),
          z: clampSceneOffset(currentOffset.z + deltaZ)
        }
      };

      writeStoredWeddingStudioLayout(plan, nextEdits, activeStep);

      return nextEdits;
    });
  }

  function moveSelectedObject(deltaX: number, deltaZ: number) {
    moveSceneObject(activeSelectedObjectId, deltaX, deltaZ);
  }

  function resetSelectedObject() {
    setSceneEdits((currentEdits) => {
      const nextEdits = {
        ...currentEdits,
        [activeSelectedObjectId]: defaultStudioSceneEdits[activeSelectedObjectId]
      };

      writeStoredWeddingStudioLayout(plan, nextEdits, activeStep);

      return nextEdits;
    });
  }

  return (
    <section className="wedding-planning-studio" aria-label="Wedding Planning Studio">
      <div className="wedding-studio-hero wedding-studio-focus-hero">
        <div>
          <span>Wedding Studio OS</span>
          <h1>See the plan in 3D.</h1>
          <p>{activeCopy.caption}</p>
        </div>
        <div className="studio-focus-meta" aria-label="Current studio context">
          <span>{sampleWedding.coupleNames}</span>
          <span>{sampleWedding.guestCount} guests</span>
          <span>{activeCopy.sceneTitle}</span>
        </div>
      </div>

      <div className="wedding-studio-focus-grid">
        <StudioControls
          activeStep={activeStep}
          capacity={capacity}
          editableObjectIds={editableObjectIds}
          onChange={updatePlan}
          onMoveSelectedObject={moveSelectedObject}
          onResetSelectedObject={resetSelectedObject}
          onSelectObject={setSelectedObjectId}
          plan={plan}
          sceneEdits={sceneEdits}
          selectedObjectId={activeSelectedObjectId}
        />

        <main className="wedding-studio-stage" aria-label="3D wedding planning studio">
          <div className="studio-stage-switcher">
            <PlanningStepper activeStep={activeStep} onChange={updateActiveStep} />
          </div>
          <CeremonyScene
            activeStep={activeStep}
            budgetLevel={plan.budgetLevel}
            capacity={capacity}
            onMoveObject={moveSceneObject}
            onSelectObject={setSelectedObjectId}
            sceneEdits={sceneEdits}
            selectedObjectId={activeSelectedObjectId}
            style={plan.style}
            venueType={plan.venueType}
          />
        </main>

        <StudioSummary activeStep={activeStep} capacity={capacity} plan={plan} />
      </div>

      <StudioToolkit />
    </section>
  );
}
