"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CeremonyScene } from "@/components/wedding-studio/church-scene";
import { StudioControls } from "@/components/wedding-studio/studio-controls";
import { StudioQuickStrip } from "@/components/wedding-studio/studio-quick-strip";
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
  type StudioViewMode,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

export function WeddingStudio() {
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [activeStep, setActiveStep] = useState<StudioPlanningStepId>("vision");
  const [viewMode, setViewMode] = useState<StudioViewMode>("3d");
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
          <span>Wedding Planning Studio</span>
          <h1>See your wedding before it happens.</h1>
          <p>Plan the ceremony, reception, guests, timeline, and handoff in one calm visual studio with smart guidance.</p>
        </div>
        <div className="studio-hero-actions" aria-label="Primary studio actions">
          <Button href="/intake">Start with 5 questions</Button>
          <Button href="/preview" variant="secondary">
            Watch demo
          </Button>
        </div>
        <div className="studio-focus-meta" aria-label="Current studio context">
          <span>{sampleWedding.coupleNames}</span>
          <span>{plan.guestCount} guests</span>
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
          onStepChange={updateActiveStep}
          plan={plan}
          sceneEdits={sceneEdits}
          selectedObjectId={activeSelectedObjectId}
        />

        <main className="wedding-studio-stage" aria-label="3D wedding planning studio">
          <div className="studio-stage-switcher" aria-label="Scene view controls">
            <div>
              <span>Visual Planning Canvas</span>
              <strong>{activeCopy.sceneTitle}</strong>
            </div>
            <div className="studio-view-switcher" role="group" aria-label="Choose scene view">
              {renderViewButton("3d", "3D View")}
              {renderViewButton("top", "Top View")}
              {renderViewButton("guest", "Guest View")}
              {renderViewButton("walkthrough", "Walkthrough")}
            </div>
          </div>
          <CeremonyScene
            activeStep={activeStep}
            budgetLevel={plan.budgetLevel}
            capacity={capacity}
            colorDirection={plan.colorDirection}
            onMoveObject={moveSceneObject}
            onSelectObject={setSelectedObjectId}
            sceneEdits={sceneEdits}
            selectedObjectId={activeSelectedObjectId}
            style={plan.style}
            venueType={plan.venueType}
            viewMode={viewMode}
          />
          <StudioQuickStrip onChange={updatePlan} plan={plan} />
        </main>

        <StudioSummary activeStep={activeStep} capacity={capacity} plan={plan} />
      </div>

      <StudioToolkit />
    </section>
  );

  function renderViewButton(mode: StudioViewMode, label: string) {
    return (
      <button aria-pressed={viewMode === mode} data-active={viewMode === mode} key={mode} onClick={() => setViewMode(mode)} type="button">
        {label}
      </button>
    );
  }
}
