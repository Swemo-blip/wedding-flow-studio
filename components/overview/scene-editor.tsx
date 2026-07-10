"use client";

import type { ChangeEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  clampAccessibilitySeats,
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
  const { t } = useTranslation();

  function updatePlan(updates: Partial<WeddingStudioPlan>) {
    onChange({ ...plan, ...updates });
  }

  return (
    <div className="scene-editor">
      <fieldset className="scene-editor-group">
        <legend>{t("Venue")}</legend>
        <div className="scene-editor-venues" role="group" aria-label={t("Choose venue type")}>
          {venueOptions.map((option) => (
            <button
              aria-pressed={plan.venueType === option.value}
              data-active={plan.venueType === option.value}
              key={option.value}
              onClick={() => updatePlan({ venueType: option.value as StudioVenueType })}
              type="button"
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>{t("Style")}</legend>
        <div className="scene-editor-styles" role="group" aria-label={t("Choose wedding style")}>
          {styleOptions.map((option) => (
            <button
              aria-pressed={plan.style === option.value}
              data-active={plan.style === option.value}
              key={option.value}
              onClick={() => updatePlan({ style: option.value as StudioStyle })}
              type="button"
            >
              <i aria-hidden="true" style={{ background: styleSwatches[option.value] ?? "#c9a767" }} />
              {t(option.label)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>{t("Color direction")}</legend>
        <select
          aria-label={t("Choose color direction")}
          onChange={(event) => updatePlan({ colorDirection: event.target.value as StudioColorDirection })}
          value={plan.colorDirection}
        >
          {colorDirectionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>{t("Decor level")}</legend>
        <div className="scene-editor-decor" role="group" aria-label={t("Choose decor level")}>
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
              {t(option.label)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>
          {t("Guests")}
          <strong>{plan.guestCount}</strong>
        </legend>
        <p className="scene-editor-note">{capacity.capacityLabel}</p>
        <p className="scene-editor-note">{t("From your guest list — edit it on the Guests page.")}</p>
      </fieldset>

      <fieldset className="scene-editor-group">
        <legend>
          {t("Accessible seats")}
          <strong>{plan.accessibilitySeats}</strong>
        </legend>
        <input
          aria-label={t("Accessible seats")}
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
