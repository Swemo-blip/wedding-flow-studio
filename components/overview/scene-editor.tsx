"use client";

import type { ChangeEvent } from "react";
import {
  clampAccessibilitySeats,
  clampGuestCount,
  colorDirectionOptions,
  decorLevelOptions,
  mapDecorLevelToBudget,
  styleOptions,
  venueOptions,
  type StudioColorDirection,
  type StudioDecorLevel,
  type StudioStyle,
  type StudioVenueType,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

const styleSwatches: Record<string, string> = {
  classic: "#c9a767",
  modern: "#aebdb0",
  romantic: "#d8a79c",
  rustic: "#b08a52"
};

type SceneEditorProps = {
  capacity: WeddingStudioCapacity;
  onChange: (plan: WeddingStudioPlan) => void;
  plan: WeddingStudioPlan;
};

export function SceneEditor({ capacity, onChange, plan }: SceneEditorProps) {
  function updatePlan(updates: Partial<WeddingStudioPlan>) {
    onChange({ ...plan, ...updates });
  }

  function updateGuestCount(event: ChangeEvent<HTMLInputElement>) {
    updatePlan({ guestCount: clampGuestCount(Number(event.target.value)) });
  }

  return (
    <div className="scene-editor">
      <fieldset className="scene-editor-group">
        <legend>Venue</legend>
        <div className="scene-editor-venues" role="group" aria-label="Choose venue type">
          {venueOptions.map((option) => (
            <button
              aria-pressed={plan.venueType === option.value}
              data-active={plan.venueType === option.value}
              key={option.value}
              onClick={() => updatePlan({ venueType: option.value as StudioVenueType })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>Style</legend>
        <div className="scene-editor-styles" role="group" aria-label="Choose wedding style">
          {styleOptions.map((option) => (
            <button
              aria-pressed={plan.style === option.value}
              data-active={plan.style === option.value}
              key={option.value}
              onClick={() => updatePlan({ style: option.value as StudioStyle })}
              type="button"
            >
              <i aria-hidden="true" style={{ background: styleSwatches[option.value] ?? "#c9a767" }} />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="scene-editor-group">
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

      <fieldset className="scene-editor-group">
        <legend>Decor level</legend>
        <div className="scene-editor-decor" role="group" aria-label="Choose decor level">
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

      <fieldset className="scene-editor-group">
        <legend>
          Guests
          <strong>{plan.guestCount}</strong>
        </legend>
        <input aria-label="Guest count" max={180} min={10} onChange={updateGuestCount} type="range" value={plan.guestCount} />
        <p className="scene-editor-note">{capacity.capacityLabel}</p>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>
          Accessible seats
          <strong>{plan.accessibilitySeats}</strong>
        </legend>
        <input
          aria-label="Accessible seats"
          max={24}
          min={0}
          onChange={(event) => updatePlan({ accessibilitySeats: clampAccessibilitySeats(Number(event.target.value)) })}
          type="range"
          value={plan.accessibilitySeats}
        />
      </fieldset>
    </div>
  );
}
