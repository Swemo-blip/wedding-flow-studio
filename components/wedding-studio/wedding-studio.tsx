"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CeremonyScene } from "@/components/wedding-studio/church-scene";
import { StudioControls } from "@/components/wedding-studio/studio-controls";
import { StudioQuickStrip } from "@/components/wedding-studio/studio-quick-strip";
import { StudioSummary } from "@/components/wedding-studio/studio-summary";
import { StudioToolkit } from "@/components/wedding-studio/studio-toolkit";
import { clearStoredProject } from "@/lib/local-project-store";
import { useLocalProject } from "@/lib/use-local-project";
import { sampleWedding } from "@/lib/wedding-data";
import { clearStoredWeddingStudioLayout, readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  clampSceneOffset,
  createWeddingStudioPlanFromWedding,
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
  const localProject = useLocalProject();
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [activeStep, setActiveStep] = useState<StudioPlanningStepId>("vision");
  const [viewMode, setViewMode] = useState<StudioViewMode>("3d");
  const [sceneEdits, setSceneEdits] = useState<StudioSceneEdits>(defaultStudioSceneEdits);
  const [selectedObjectId, setSelectedObjectId] = useState<StudioSceneObjectId>("focalPoint");
  const [syncedProjectKey, setSyncedProjectKey] = useState<string | null>(null);
  const activeWedding = localProject.hasLocalProject ? localProject.wedding : sampleWedding;
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

  useEffect(() => {
    if (!localProject.hasLocalProject) {
      return;
    }

    const projectKey = `${localProject.wedding.id}:${localProject.updatedAt ?? "local"}`;
    if (syncedProjectKey === projectKey) {
      return;
    }

    queueMicrotask(() => {
      const nextPlan = createWeddingStudioPlanFromWedding(localProject.wedding, defaultWeddingStudioPlan);
      setPlan(nextPlan);
      setActiveStep("vision");
      writeStoredWeddingStudioLayout(nextPlan, sceneEdits, "vision");
      setSyncedProjectKey(projectKey);
    });
  }, [localProject.hasLocalProject, localProject.updatedAt, localProject.wedding, sceneEdits, syncedProjectKey]);

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

  function resetGeneratedProject() {
    clearStoredProject();
    clearStoredWeddingStudioLayout();
    localProject.resetLocalProject();
    setPlan(defaultWeddingStudioPlan);
    setActiveStep("vision");
    setSceneEdits(defaultStudioSceneEdits);
    setSelectedObjectId("focalPoint");
    setSyncedProjectKey(null);
  }

  return (
    <section className="wedding-planning-studio" aria-label="Wedding Planning Studio">
      <div className="wedding-studio-hero wedding-studio-focus-hero">
        <div>
          <span>{localProject.hasLocalProject ? "Your wedding studio" : "Wedding Planning Studio"}</span>
          <h1>{localProject.hasLocalProject ? activeWedding.coupleNames : "See the day before it unfolds."}</h1>
          <div className="studio-focus-meta" aria-label="Wedding facts">
            <span>{activeWedding.date}</span>
            <span>{activeWedding.receptionLocation}</span>
            <span>{plan.guestCount} guests</span>
          </div>
        </div>
        <div className="studio-hero-actions" aria-label="Primary studio actions">
          {localProject.hasLocalProject ? (
            <>
              <Button href="/preview">Preview the day</Button>
              <button className="studio-text-action" onClick={resetGeneratedProject} type="button">
                Start over
              </button>
            </>
          ) : (
            <Button href="/intake">Start with 5 questions</Button>
          )}
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

        <main className="wedding-studio-stage" id="studio-canvas" aria-label="3D wedding planning studio">
        <div className="studio-stage-switcher" aria-label="Scene view controls">
          <div>
              <span>Studio Canvas</span>
              <strong>{activeCopy.sceneTitle}</strong>
            </div>
            <div className="studio-view-switcher" role="group" aria-label="Choose scene view">
              {renderViewButton("3d", "3D")}
              {renderViewButton("top", "Plan")}
              {renderViewButton("guest", "Guest")}
              {renderViewButton("walkthrough", "Walk")}
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
          <details className="studio-quick-drawer">
            <summary>
              <span>Quick adjustments</span>
              <small>Guests, venue, style, decor, and accessibility.</small>
            </summary>
            <StudioQuickStrip onChange={updatePlan} plan={plan} />
          </details>
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
