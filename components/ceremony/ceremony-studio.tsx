"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { SceneEditor } from "@/components/overview/scene-editor";
import { Donut } from "@/components/ui/donut";
import { CeremonyScene, type CeremonyFirstPerson, type SceneCameraOverride, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  type StudioSceneObjectId,
  type StudioViewMode,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type PresetKey = "overview" | "entrance" | "couple" | "side" | "top";

const CAMERA_PRESETS: Record<PresetKey, SceneCameraOverride | null> = {
  overview: null,
  entrance: { position: [0, 1.85, 8.4], target: [0, 1.05, -3] },
  couple: { position: [0, 1.95, -3.1], target: [0, 1.25, 4.6] },
  side: { position: [7.6, 3.1, 1.6], target: [0, 0.85, -2.2] },
  top: { position: [0, 13, 1.2], target: [0, 0, -1.6] }
};

const PRESET_LABELS: Record<PresetKey, string> = {
  overview: "Overview",
  entrance: "From entrance",
  couple: "Couple view",
  side: "Side view",
  top: "Top view"
};

const NEXT_DECISIONS: Array<{ due: string; label: string }> = [
  { due: "Due in 3 days", label: "Confirm ceremony music" },
  { due: "Due in 5 days", label: "Review the final proposal" },
  { due: "Due in 1 week", label: "Finalize the seating chart" }
];

function comfortFromCapacity(status: WeddingStudioCapacity["capacityStatus"]): {
  donut: "gold" | "sage";
  label: string;
  spacing: string;
} {
  if (status === "over_capacity") {
    return { donut: "gold", label: "Over capacity", spacing: "Tight — add room" };
  }
  if (status === "full") {
    return { donut: "gold", label: "Nearly full", spacing: "Snug spacing" };
  }
  return { donut: "sage", label: "Comfortable", spacing: "Good spacing" };
}

function formatWeddingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
}

export function CeremonyStudio() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [sceneEdits] = useState(defaultStudioSceneEdits);
  const [selectedObjectId, setSelectedObjectId] = useState<StudioSceneObjectId>("guestSeating");
  const [preset, setPreset] = useState<PresetKey>("overview");
  const [lighting, setLighting] = useState<SceneLighting>("day");
  const [viewMode, setViewMode] = useState<StudioViewMode>("3d");
  const [firstPerson, setFirstPerson] = useState<CeremonyFirstPerson>(null);

  // Share the plan with the home Overview studio through the persisted layout
  // store, so the ceremony opens on the same guest count, venue and style the
  // couple set there — and any change here flows back to the same store.
  useEffect(() => {
    const stored = readStoredWeddingStudioLayout();
    if (stored) {
      queueMicrotask(() => setPlan(stored.plan));
    }
  }, []);

  function applyPlan(nextPlan: WeddingStudioPlan) {
    setPlan(nextPlan);
    writeStoredWeddingStudioLayout(nextPlan, sceneEdits, "vision");
  }

  const { wedding } = useLocalProject();
  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);
  const comfort = comfortFromCapacity(capacity.capacityStatus);
  const seatedCount = Math.min(plan.guestCount, capacity.totalCapacity);
  const seatsRemaining = Math.max(0, capacity.totalCapacity - plan.guestCount);

  return (
    <div className="studio-workspace">
      <aside aria-label={t("Ceremony controls")} className="studio-pane studio-pane-controls">
        <div className="studio-pane-head">
          <p className="eyebrow">{t("Ceremony Studio")}</p>
          <h2>{t("Design the ceremony")}</h2>
        </div>
        <SceneEditor capacity={capacity} onChange={applyPlan} plan={plan} />
        <div className="studio-control-block">
          <span className="studio-control-label">{t("Lighting mood")}</span>
          <div className="studio-segment" role="group" aria-label={t("Lighting mood")}>
            <button aria-pressed={lighting === "day"} data-active={lighting === "day"} onClick={() => setLighting("day")} type="button">
              {t("Daylight")}
            </button>
            <button aria-pressed={lighting === "dusk"} data-active={lighting === "dusk"} onClick={() => setLighting("dusk")} type="button">
              {t("Golden hour")}
            </button>
          </div>
        </div>
      </aside>

      <section aria-label={t("Ceremony preview")} className="studio-pane studio-pane-stage">
        <div className="studio-stage-toolbar">
          <div className="studio-preset-row" role="group" aria-label={t("Camera view")}>
            {(Object.keys(CAMERA_PRESETS) as PresetKey[]).map((key) => (
              <button
                aria-pressed={viewMode === "3d" && preset === key && !firstPerson}
                data-active={viewMode === "3d" && preset === key && !firstPerson}
                key={key}
                onClick={() => {
                  setPreset(key);
                  setViewMode("3d");
                  setFirstPerson(null);
                }}
                type="button"
              >
                {t(PRESET_LABELS[key])}
              </button>
            ))}
            <button
              aria-pressed={firstPerson === "bride"}
              data-active={firstPerson === "bride"}
              onClick={() => {
                setFirstPerson("bride");
                setViewMode("3d");
              }}
              type="button"
            >
              {t("Bride's eyes")}
            </button>
            <button
              aria-pressed={firstPerson === "groom"}
              data-active={firstPerson === "groom"}
              onClick={() => {
                setFirstPerson("groom");
                setViewMode("3d");
              }}
              type="button"
            >
              {t("Groom's eyes")}
            </button>
            <button
              aria-pressed={viewMode === "top"}
              data-active={viewMode === "top"}
              onClick={() => {
                setViewMode("top");
                setFirstPerson(null);
              }}
              type="button"
            >
              {t("2D plan")}
            </button>
          </div>
          <span className="studio-twin-status">{t("Live 3D · updates as you plan")}</span>
        </div>
        <div className="studio-stage-canvas">
          <Suspense fallback={<div aria-hidden="true" className="studio-stage-skeleton" />}>
            <CeremonyScene
              activeStep="ceremony"
              budgetLevel={plan.budgetLevel}
              cameraOverride={viewMode === "3d" && !firstPerson ? CAMERA_PRESETS[preset] : null}
              capacity={capacity}
              colorDirection={plan.colorDirection}
              firstPerson={firstPerson}
              lighting={lighting}
              onMoveObject={() => undefined}
              onSelectObject={setSelectedObjectId}
              sceneEdits={sceneEdits}
              selectedObjectId={selectedObjectId}
              style={plan.style}
              venueType={plan.venueType}
              viewMode={viewMode}
            />
          </Suspense>
        </div>
      </section>

      <aside aria-label={t("Ceremony summary")} className="studio-pane studio-pane-inspector">
        <div className="studio-rail-block">
          <p className="eyebrow">{t("Ceremony summary")}</p>
          <dl className="studio-inspector-list">
            <div className="studio-inspector-row">
              <dt>{t("Date")}</dt>
              <dd>{formatWeddingDate(wedding.date)}</dd>
            </div>
            <div className="studio-inspector-row">
              <dt>{t("Venue")}</dt>
              <dd>{wedding.ceremonyLocation}</dd>
            </div>
            <div className="studio-inspector-row">
              <dt>{t("Guests")}</dt>
              <dd>
                {plan.guestCount} {t("invited")} · {seatedCount} {t("seated")}
              </dd>
            </div>
            <div className="studio-inspector-row">
              <dt>{t("Style")}</dt>
              <dd>{plan.style}</dd>
            </div>
          </dl>
        </div>

        <div className="studio-rail-block">
          <p className="eyebrow">{t("Capacity & comfort")}</p>
          <div className="studio-capacity">
            <Donut percent={capacity.usedCapacityPercent} tone={comfort.donut}>
              <strong>{capacity.usedCapacityPercent}%</strong>
              <span>{t(comfort.label)}</span>
            </Donut>
            <div className="studio-capacity-stats">
              <div>
                <strong>{seatedCount}</strong>
                <span>{t("of {count} seats", { count: capacity.totalCapacity })}</span>
              </div>
              <div>
                <strong>{seatsRemaining}</strong>
                <span>{t("seats remaining")}</span>
              </div>
              <span className="studio-capacity-spacing" data-tone={comfort.donut === "gold" ? "medium" : "confirmed"}>
                {t(comfort.spacing)}
              </span>
            </div>
          </div>
        </div>

        <div className="studio-rail-block">
          <p className="eyebrow">{t("Next decisions")}</p>
          <ul className="studio-decision-list">
            {NEXT_DECISIONS.map((decision) => (
              <li key={decision.label}>
                <span aria-hidden="true" className="studio-decision-mark" />
                <span className="studio-decision-label">{t(decision.label)}</span>
                <small>{t(decision.due)}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="studio-rail-block">
          <p className="eyebrow">{t("Notes")}</p>
          <p className="studio-rail-note">{t("The couple would like soft candlelight for the ceremony.")}</p>
        </div>
      </aside>
    </div>
  );
}
