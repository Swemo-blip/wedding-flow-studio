"use client";

import type { ChangeEvent } from "react";
import { PlanningStepper } from "@/components/wedding-studio/planning-stepper";
import {
  budgetLevelOptions,
  clampAccessibilitySeats,
  clampGuestCount,
  colorDirectionOptions,
  decorLevelOptions,
  mapDecorLevelToBudget,
  studioEditableObjects,
  styleOptions,
  venueOptions,
  type StudioBudgetLevel,
  type StudioColorDirection,
  type StudioDecorLevel,
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
  onStepChange: (step: StudioPlanningStepId) => void;
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
  onStepChange,
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

  function updateAccessibilitySeats(event: ChangeEvent<HTMLInputElement>) {
    updatePlan({ accessibilitySeats: clampAccessibilitySeats(Number(event.target.value)) });
  }

  return (
    <aside className="wedding-studio-panel studio-controls-panel" aria-label="Guided wedding studio controls">
      <div className="studio-panel-header">
        <span>Guided Plan</span>
        <h2>Start simple. Refine only what matters.</h2>
        <p>Move through the plan step by step. The 3D scene stays in sync.</p>
      </div>

      <PlanningStepper activeStep={activeStep} onChange={onStepChange} />

      <section className="studio-step-card" aria-label="Current planning step controls">
        {renderActiveStepControls()}
      </section>

      <details className="studio-advanced-editor">
        <summary>
          <span>Advanced edit</span>
          <small>Move zones only when you need planner-level control.</small>
        </summary>
        {renderSceneEditor()}
      </details>
    </aside>
  );

  function renderActiveStepControls() {
    if (activeStep === "vision") {
      return (
        <div className="studio-control-stack">
          <div className="studio-step-intro">
            <span>Step 1</span>
            <strong>Let the system create a useful first plan.</strong>
          </div>
          {renderSegmentedStyle()}
          {renderColorDirection()}
          {renderDecorLevel()}
        </div>
      );
    }

    if (activeStep === "venue") {
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
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </fieldset>
      );
    }

    if (activeStep === "guests") {
      return (
        <div className="studio-control-stack">
          {renderGuestControls("Guest count")}
          {renderAccessibilityControls()}
          <div className="studio-plain-note">
            <strong>{capacity.capacityLabel}</strong>
            <span>{capacity.comfortLabel}</span>
          </div>
        </div>
      );
    }

    if (activeStep === "ceremony") {
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

    if (activeStep === "reception") {
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

    if (activeStep === "timeline") {
      return (
        <div className="studio-control-stack">
          <div className="studio-step-intro">
            <span>Timeline</span>
            <strong>Build the day from modular moments.</strong>
          </div>
          <div className="studio-moment-mini-list" aria-label="Core wedding day moments">
            {["Ceremony", "Cocktail Hour", "Dinner", "Speeches", "Party"].map((moment) => (
              <span key={moment}>{moment}</span>
            ))}
          </div>
        </div>
      );
    }

    if (activeStep === "budget") {
      return (
        <div className="studio-control-stack">
          {renderBudgetLevel()}
          {renderDecorLevel()}
          <div className="studio-plain-note">
            <strong>Plan tradeoffs early.</strong>
            <span>Keep the visual plan aligned with the level of detail you want to produce.</span>
          </div>
        </div>
      );
    }

    if (activeStep === "preview") {
      return (
        <div className="studio-control-stack">
          <div className="studio-step-intro">
            <span>Preview</span>
            <strong>Use the center view controls to inspect the plan.</strong>
          </div>
          <div className="studio-plain-note">
            <strong>{capacity.capacityLabel}</strong>
            <span>The preview updates with guests, venue type, style, and accessibility needs.</span>
          </div>
        </div>
      );
    }

    return (
      <div className="studio-control-stack">
        <div className="studio-step-intro">
          <span>Share</span>
          <strong>Create a clean summary before exporting details.</strong>
        </div>
        <div className="studio-moment-mini-list" aria-label="Shareable planning outputs">
          {["Planning Summary", "Vendor Brief", "Guest View", "Run of Show"].map((output) => (
            <span key={output}>{output}</span>
          ))}
        </div>
      </div>
    );
  }

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
          <input aria-label="Guest count" max={180} min={10} onChange={updateGuestCount} type="number" value={plan.guestCount} />
          <small id="studio-guest-help">The scene updates instantly.</small>
        </div>
      </div>
    );
  }

  function renderAccessibilityControls() {
    return (
      <div className="studio-control-group">
        <div className="summary-between">
          <label htmlFor="studio-accessibility-seats">Accessibility seats</label>
          <strong>{plan.accessibilitySeats}</strong>
        </div>
        <input
          id="studio-accessibility-seats"
          max={24}
          min={0}
          onChange={updateAccessibilitySeats}
          type="range"
          value={plan.accessibilitySeats}
        />
      </div>
    );
  }

  function renderSegmentedStyle() {
    return (
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
    );
  }

  function renderColorDirection() {
    return (
      <fieldset className="studio-control-group">
        <legend>Color direction</legend>
        <select
          aria-label="Choose color direction"
          onChange={(event) => updatePlan({ colorDirection: event.target.value as StudioColorDirection })}
          value={plan.colorDirection}
        >
          {colorDirectionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </fieldset>
    );
  }

  function renderDecorLevel() {
    return (
      <fieldset className="studio-control-group">
        <legend>Decor level</legend>
        <div className="studio-segmented-control" role="group" aria-label="Choose decor level">
          {decorLevelOptions.map((option) => (
            <button
              aria-pressed={plan.decorLevel === option.value}
              data-active={plan.decorLevel === option.value}
              key={option.value}
              onClick={() =>
                updatePlan({
                  budgetLevel: mapDecorLevelToBudget(option.value as StudioDecorLevel),
                  decorLevel: option.value as StudioDecorLevel
                })
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  function renderBudgetLevel() {
    return (
      <fieldset className="studio-control-group">
        <legend>Budget level</legend>
        <div className="studio-segmented-control" role="group" aria-label="Choose budget level">
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
    );
  }

  function renderSceneEditor() {
    const selectedOffset = sceneEdits[selectedObjectId];

    return (
      <section className="studio-scene-editor" aria-label="3D scene zone editor">
        <div className="studio-editor-heading">
          <span>Selected zone</span>
          <strong>{studioEditableObjects[selectedObjectId].label}</strong>
        </div>

        <div className="studio-object-grid" role="group" aria-label="Choose zone to edit">
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
          <button aria-label="Move selected zone forward" className="studio-nudge-forward" onClick={() => onMoveSelectedObject(0, -0.2)} type="button">
            Up
          </button>
          <button aria-label="Move selected zone left" className="studio-nudge-left" onClick={() => onMoveSelectedObject(-0.2, 0)} type="button">
            Left
          </button>
          <button aria-label="Reset selected zone position" className="studio-nudge-reset" onClick={onResetSelectedObject} type="button">
            Reset
          </button>
          <button aria-label="Move selected zone right" className="studio-nudge-right" onClick={() => onMoveSelectedObject(0.2, 0)} type="button">
            Right
          </button>
          <button aria-label="Move selected zone back" className="studio-nudge-back" onClick={() => onMoveSelectedObject(0, 0.2)} type="button">
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
