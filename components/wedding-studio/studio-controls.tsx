"use client";

import type { ChangeEvent } from "react";
import {
  budgetLevelOptions,
  clampGuestCount,
  studioEditableObjects,
  styleOptions,
  venueOptions,
  type StudioBudgetLevel,
  type StudioPlanningStepId,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type StudioStyle,
  type StudioVenueType,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type StudioControlsProps = {
  activeStep: StudioPlanningStepId;
  capacity: WeddingStudioCapacity;
  editableObjectIds: StudioSceneObjectId[];
  onChange: (plan: WeddingStudioPlan) => void;
  onMoveSelectedObject: (deltaX: number, deltaZ: number) => void;
  onResetSelectedObject: () => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  plan: WeddingStudioPlan;
  sceneEdits: StudioSceneEdits;
  selectedObjectId: StudioSceneObjectId;
};

export function StudioControls({
  activeStep,
  capacity,
  editableObjectIds,
  onChange,
  onMoveSelectedObject,
  onResetSelectedObject,
  onSelectObject,
  plan,
  sceneEdits,
  selectedObjectId
}: StudioControlsProps) {
  function updatePlan(updates: Partial<WeddingStudioPlan>) {
    onChange({ ...plan, ...updates });
  }

  function updateGuestCount(event: ChangeEvent<HTMLInputElement>) {
    updatePlan({ guestCount: clampGuestCount(Number(event.target.value)) });
  }

  return (
    <aside className="wedding-studio-panel studio-controls-panel" aria-label="Wedding studio controls">
      <div className="studio-panel-header">
        <span>Active Controls</span>
        <h2>{getControlTitle(activeStep)}</h2>
      </div>

      {activeStep === "venue" ? renderVenueControls() : null}
      {activeStep === "guests" ? renderGuestControls("Guest count") : null}
      {activeStep === "ceremony" ? renderCeremonyControls() : null}
      {activeStep === "reception" ? renderReceptionControls() : null}
      {activeStep === "details" ? renderDetailsControls() : null}

      {renderSceneEditor()}
    </aside>
  );

  function renderGuestControls(label: string) {
    return (
      <div className="studio-control-group studio-primary-control">
        <div className="summary-between">
          <label htmlFor="studio-guest-count">{label}</label>
          <strong>{plan.guestCount}</strong>
        </div>
        <input
          aria-describedby="studio-guest-help"
          id="studio-guest-count"
          max={180}
          min={10}
          onChange={updateGuestCount}
          type="range"
          value={plan.guestCount}
        />
        <div className="studio-number-row">
          <input
            aria-label="Guest count"
            max={180}
            min={10}
            onChange={updateGuestCount}
            type="number"
            value={plan.guestCount}
          />
          <small id="studio-guest-help">The scene updates instantly.</small>
        </div>
      </div>
    );
  }

  function renderVenueControls() {
    return (
      <fieldset className="studio-control-group">
        <legend>Venue model</legend>
        <div className="studio-option-grid">
          {venueOptions.map((option) => (
            <button
              aria-pressed={plan.venueType === option.value}
              className="studio-choice-card"
              data-active={plan.venueType === option.value}
              key={option.value}
              onClick={() => updatePlan({ venueType: option.value as StudioVenueType })}
              type="button"
            >
              <strong>{option.label}</strong>
              <small>3D scene</small>
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  function renderCeremonyControls() {
    return (
      <div className="studio-control-stack">
        {renderGuestControls("Ceremony guests")}
        <div className="studio-mini-stat-grid" aria-label="Ceremony layout calculation">
          <div>
            <span>Rows</span>
            <strong>{capacity.recommendedRows}</strong>
          </div>
          <div>
            <span>Seats</span>
            <strong>{capacity.totalCapacity}</strong>
          </div>
        </div>
      </div>
    );
  }

  function renderReceptionControls() {
    const tableCount = Math.min(10, Math.max(4, Math.ceil(capacity.visibleGuestMarkers / 14)));

    return (
      <div className="studio-control-stack">
        {renderGuestControls("Reception guests")}
        <div className="studio-mini-stat-grid" aria-label="Reception layout calculation">
          <div>
            <span>Tables</span>
            <strong>{tableCount}</strong>
          </div>
          <div>
            <span>Flow</span>
            <strong>{capacity.capacityStatus === "over_capacity" ? "Tight" : "Clear"}</strong>
          </div>
        </div>
      </div>
    );
  }

  function renderDetailsControls() {
    return (
      <div className="studio-control-stack">
        <fieldset className="studio-control-group">
          <legend>Style</legend>
          <div className="studio-segmented-control" role="group" aria-label="Choose wedding style">
            {styleOptions.map((option) => (
              <button
                aria-pressed={plan.style === option.value}
                data-active={plan.style === option.value}
                key={option.value}
                onClick={() => updatePlan({ style: option.value as StudioStyle })}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="studio-control-group">
          <legend>Detail level</legend>
          <div className="studio-segmented-control" role="group" aria-label="Choose detail level">
            {budgetLevelOptions.map((option) => (
              <button
                aria-pressed={plan.budgetLevel === option.value}
                data-active={plan.budgetLevel === option.value}
                key={option.value}
                onClick={() => updatePlan({ budgetLevel: option.value as StudioBudgetLevel })}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  function renderSceneEditor() {
    const selectedOffset = sceneEdits[selectedObjectId];

    return (
      <section className="studio-scene-editor" aria-label="3D scene object editor">
        <div className="studio-editor-heading">
          <span>Scene Edit</span>
          <strong>{studioEditableObjects[selectedObjectId].label}</strong>
        </div>

        <div className="studio-object-grid" role="group" aria-label="Choose object to edit">
          {editableObjectIds.map((objectId) => (
            <button
              aria-pressed={selectedObjectId === objectId}
              data-active={selectedObjectId === objectId}
              key={objectId}
              onClick={() => onSelectObject(objectId)}
              type="button"
            >
              {studioEditableObjects[objectId].shortLabel}
            </button>
          ))}
        </div>

        <div className="studio-nudge-grid" aria-label={`Move ${studioEditableObjects[selectedObjectId].label}`}>
          <button aria-label="Move selected object forward" className="studio-nudge-forward" onClick={() => onMoveSelectedObject(0, -0.2)} type="button">
            Up
          </button>
          <button aria-label="Move selected object left" className="studio-nudge-left" onClick={() => onMoveSelectedObject(-0.2, 0)} type="button">
            Left
          </button>
          <button aria-label="Reset selected object position" className="studio-nudge-reset" onClick={onResetSelectedObject} type="button">
            Reset
          </button>
          <button aria-label="Move selected object right" className="studio-nudge-right" onClick={() => onMoveSelectedObject(0.2, 0)} type="button">
            Right
          </button>
          <button aria-label="Move selected object back" className="studio-nudge-back" onClick={() => onMoveSelectedObject(0, 0.2)} type="button">
            Down
          </button>
        </div>

        <div className="studio-offset-readout" aria-live="polite">
          <span>X {selectedOffset.x.toFixed(1)}</span>
          <span>Z {selectedOffset.z.toFixed(1)}</span>
        </div>
      </section>
    );
  }
}

function getControlTitle(activeStep: StudioPlanningStepId) {
  const titles: Record<StudioPlanningStepId, string> = {
    ceremony: "Tune the ceremony.",
    details: "Set the atmosphere.",
    guests: "Shape the guest density.",
    reception: "Balance dinner flow.",
    venue: "Choose the room model."
  };

  return titles[activeStep];
}
