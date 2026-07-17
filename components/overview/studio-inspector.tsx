"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, Dot, Sunrise, SunMedium } from "lucide-react";
import type { SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
import {
  colorDirectionOptions,
  decorLevelOptions,
  mapDecorLevelToBudget,
  MAX_AISLE_WIDTH_FEET,
  MIN_AISLE_WIDTH_FEET,
  seatingLayoutOptions,
  studioEditableObjects,
  styleOptions,
  type StudioColorDirection,
  type StudioDecorLevel,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type StudioStyle,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

export type StudioTool = "overview" | "objects" | "style" | "seating" | "lighting";

export type SceneWarning = {
  actionLabel: string;
  href: string;
  id: string;
  text: string;
};

const styleSwatches: Record<string, string> = {
  classic: "#c9a767",
  modern: "#aebdb0",
  romantic: "#d8a79c",
  rustic: "#b08a52"
};

// How far one nudge-button press moves an object, in scene metres. Matches the
// feel of dragging in the 3D view without letting a tap fling anything.
const NUDGE_STEP = 0.15;

type StudioInspectorProps = {
  activeTool: StudioTool;
  beginsAt: string | null;
  capacity: WeddingStudioCapacity;
  editableObjectIds: StudioSceneObjectId[];
  invitedGuests: number;
  lighting: SceneLighting;
  onLightingChange: (lighting: SceneLighting) => void;
  onMoveObject: (objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) => void;
  onSelectObject: (objectId: StudioSceneObjectId) => void;
  onSelectTool: (tool: StudioTool) => void;
  plan: WeddingStudioPlan;
  receptionSeatCount: number;
  receptionTableCount: number;
  sceneEdits: StudioSceneEdits;
  sceneKind: "ceremony" | "reception";
  seatedGuests: number;
  selectedObjectId: StudioSceneObjectId;
  updatePlan: (plan: WeddingStudioPlan) => void;
  warnings: SceneWarning[];
};

export function StudioInspector({
  activeTool,
  beginsAt,
  capacity,
  editableObjectIds,
  invitedGuests,
  lighting,
  onLightingChange,
  onMoveObject,
  onSelectObject,
  onSelectTool,
  plan,
  receptionSeatCount,
  receptionTableCount,
  sceneEdits,
  sceneKind,
  seatedGuests,
  selectedObjectId,
  updatePlan,
  warnings
}: StudioInspectorProps) {
  const { t } = useTranslation();

  if (activeTool === "objects") {
    const offset = sceneEdits[selectedObjectId];

    return (
      <div className="vstudio-panel">
        <h2>{t("Objects")}</h2>
        <div className="vstudio-object-list" role="group" aria-label={t("Scene objects")}>
          {editableObjectIds.map((objectId) => (
            <button
              aria-pressed={objectId === selectedObjectId}
              data-active={objectId === selectedObjectId}
              key={objectId}
              onClick={() => onSelectObject(objectId)}
              type="button"
            >
              {t(studioEditableObjects[objectId].label)}
            </button>
          ))}
        </div>

        <p className="vstudio-panel-hint">{t("Nudge the selected object, or drag it directly in the scene.")}</p>

        <div className="vstudio-nudge" role="group" aria-label={t("Nudge {object}", { object: t(studioEditableObjects[selectedObjectId].label) })}>
          <span />
          <button aria-label={t("Nudge away from camera")} onClick={() => onMoveObject(selectedObjectId, 0, -NUDGE_STEP)} type="button">
            <ArrowUp aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <span />
          <button aria-label={t("Nudge left")} onClick={() => onMoveObject(selectedObjectId, -NUDGE_STEP, 0)} type="button">
            <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <button
            aria-label={t("Reset position")}
            className="vstudio-nudge-reset"
            disabled={offset.x === 0 && offset.z === 0}
            onClick={() => onMoveObject(selectedObjectId, -offset.x, -offset.z)}
            title={t("Reset position")}
            type="button"
          >
            <Dot aria-hidden="true" size={18} strokeWidth={2.4} />
          </button>
          <button aria-label={t("Nudge right")} onClick={() => onMoveObject(selectedObjectId, NUDGE_STEP, 0)} type="button">
            <ArrowRight aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <span />
          <button aria-label={t("Nudge toward camera")} onClick={() => onMoveObject(selectedObjectId, 0, NUDGE_STEP)} type="button">
            <ArrowDown aria-hidden="true" size={15} strokeWidth={1.9} />
          </button>
          <span />
        </div>

        <p className="vstudio-offset" aria-live="polite">
          {t("Offset")}: {offset.x.toFixed(2)} m · {offset.z.toFixed(2)} m
        </p>
      </div>
    );
  }

  if (activeTool === "style") {
    return (
      <div className="vstudio-panel">
        <h2>{t("Style")}</h2>

        <fieldset className="vstudio-field">
          <legend>{t("Floral Style")}</legend>
          <div className="vstudio-choice-grid" role="group" aria-label={t("Floral Style")}>
            {styleOptions.map((option) => (
              <button
                aria-pressed={plan.style === option.value}
                data-active={plan.style === option.value}
                key={option.value}
                onClick={() => updatePlan({ ...plan, style: option.value as StudioStyle })}
                type="button"
              >
                <i aria-hidden="true" style={{ background: styleSwatches[option.value] ?? "#c9a767" }} />
                {t(option.label)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="vstudio-field">
          <span>{t("Color direction")}</span>
          <select
            onChange={(event) => updatePlan({ ...plan, colorDirection: event.target.value as StudioColorDirection })}
            value={plan.colorDirection}
          >
            {colorDirectionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="vstudio-field">
          <legend>{t("Decor level")}</legend>
          <div className="vstudio-choice-row" role="group" aria-label={t("Decor level")}>
            {decorLevelOptions.map((option) => (
              <button
                aria-pressed={plan.decorLevel === option.value}
                data-active={plan.decorLevel === option.value}
                key={option.value}
                onClick={() =>
                  updatePlan({
                    ...plan,
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
      </div>
    );
  }

  if (activeTool === "seating") {
    return (
      <div className="vstudio-panel">
        <h2>{t("Seating")}</h2>

        <label className="vstudio-field">
          <span>{t("Seating Layout")}</span>
          <select onChange={(event) => updatePlan({ ...plan, seatingLayout: event.target.value })} value={plan.seatingLayout}>
            {seatingLayoutOptions.map((option) => (
              <option key={option} value={option}>
                {t(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="vstudio-field">
          <span className="vstudio-field-split">
            {t("Aisle Width")}
            <strong>
              {plan.aisleWidthFeet} {t("ft")}
            </strong>
          </span>
          <input
            max={MAX_AISLE_WIDTH_FEET}
            min={MIN_AISLE_WIDTH_FEET}
            onChange={(event) => updatePlan({ ...plan, aisleWidthFeet: Number(event.target.value) })}
            type="range"
            value={plan.aisleWidthFeet}
          />
        </label>

        <p className="vstudio-panel-hint">
          {sceneKind === "reception"
            ? t("{seated} of {invited} guests have a seat", { invited: invitedGuests, seated: seatedGuests })
            : `${t(capacity.capacityLabel)} · ${invitedGuests} ${t("guests")}, ${capacity.totalCapacity} ${t("seats")}`}
        </p>

        <Link className="vstudio-link" href="/reception">
          {t("Open Seating Plan")} <ChevronRight aria-hidden="true" size={14} />
        </Link>
      </div>
    );
  }

  if (activeTool === "lighting") {
    return (
      <div className="vstudio-panel">
        <h2>{t("Lighting")}</h2>
        <div className="vstudio-choice-row" role="group" aria-label={t("Lighting")}>
          <button aria-pressed={lighting === "day"} data-active={lighting === "day"} onClick={() => onLightingChange("day")} type="button">
            <SunMedium aria-hidden="true" size={15} strokeWidth={1.8} />
            {t("Daylight")}
          </button>
          <button aria-pressed={lighting === "dusk"} data-active={lighting === "dusk"} onClick={() => onLightingChange("dusk")} type="button">
            <Sunrise aria-hidden="true" size={15} strokeWidth={1.8} />
            {t("Golden hour")}
          </button>
        </div>
        <p className="vstudio-panel-hint">{t("In preview, light follows the time of day automatically.")}</p>
      </div>
    );
  }

  // Default: the scene overview — real facts, real problems, real next steps.
  return (
    <div className="vstudio-panel">
      <h2>{t("Scene overview")}</h2>

      <dl className="vstudio-facts">
        <div>
          <dt>{t("Guests")}</dt>
          <dd>
            {sceneKind === "reception"
              ? t("{seated} of {invited} guests have a seat", { invited: invitedGuests, seated: seatedGuests })
              : `${invitedGuests} ${t("invited")}`}
          </dd>
        </div>
        <div>
          <dt>{t("Seats")}</dt>
          <dd>
            {sceneKind === "reception"
              ? t("{seats} seats across {tables} tables", { seats: receptionSeatCount, tables: receptionTableCount })
              : `${capacity.totalCapacity} · ${t(capacity.capacityLabel)}`}
          </dd>
        </div>
        {beginsAt ? (
          <div>
            <dt>{sceneKind === "reception" ? t("Reception begins") : t("Ceremony begins")}</dt>
            <dd>{beginsAt}</dd>
          </div>
        ) : null}
      </dl>

      <h3>{t("Scene check")}</h3>
      {warnings.length === 0 ? (
        <p className="vstudio-allclear">{t("All clear — nothing needs attention in this scene.")}</p>
      ) : (
        <ul className="vstudio-warnings">
          {warnings.map((warning) => (
            <li key={warning.id}>
              <Link href={warning.href}>
                <span>{warning.text}</span>
                <em>
                  {warning.actionLabel} <ChevronRight aria-hidden="true" size={13} />
                </em>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h3>{t("Quick actions")}</h3>
      <div className="vstudio-quick">
        <button onClick={() => onSelectTool("seating")} type="button">
          {t("Edit seating")}
        </button>
        <button onClick={() => onSelectTool("lighting")} type="button">
          {t("Adjust lighting")}
        </button>
        <Link className="vstudio-quick-link" href="/day-flow">
          {t("Open the timeline")}
        </Link>
      </div>
    </div>
  );
}
