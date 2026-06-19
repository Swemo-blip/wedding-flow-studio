"use client";

import { Suspense, useMemo, useState } from "react";
import { SceneEditor } from "@/components/overview/scene-editor";
import { CeremonyScene, type SceneCameraOverride, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
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

type InspectorRow = { label: string; value: string };
type Inspector = {
  eyebrow: string;
  title: string;
  rows: InspectorRow[];
  recommendation: string;
  tone: "confirmed" | "medium" | "high";
};

function buildInspector(
  objectId: StudioSceneObjectId,
  plan: WeddingStudioPlan,
  capacity: WeddingStudioCapacity,
  t: (source: string, params?: Record<string, string | number>) => string
): Inspector {
  const accessibility =
    plan.accessibilitySeats > 0
      ? t("{count} accessible seats reserved near the aisle.", { count: plan.accessibilitySeats })
      : t("No accessible seats reserved yet.");

  const capacityTone = capacity.capacityStatus === "over_capacity" ? "high" : capacity.capacityStatus === "full" ? "medium" : "confirmed";
  const capacityRecommendation =
    capacity.capacityStatus === "over_capacity"
      ? t("Over comfortable capacity — consider a larger venue or fewer guests.")
      : capacity.capacityStatus === "full"
        ? t("Nearly full — the aisle and guest flow will feel tight at this count.")
        : t("Fills the room comfortably with a clear aisle.");

  if (objectId === "focalPoint") {
    return {
      eyebrow: t("Focal point"),
      title: t("Altar & ceremony front"),
      rows: [
        { label: t("Style"), value: plan.style },
        { label: t("Decoration"), value: plan.decorLevel },
        { label: t("Color direction"), value: plan.colorDirection }
      ],
      recommendation: t("The altar, florals and lighting follow the chosen style and decoration level."),
      tone: "confirmed"
    };
  }

  if (objectId === "ceremonyPath") {
    return {
      eyebrow: t("Aisle"),
      title: t("Processional aisle"),
      rows: [
        { label: t("Guests"), value: `${plan.guestCount}` },
        { label: t("Rows"), value: `${capacity.recommendedRows}` }
      ],
      recommendation:
        capacity.capacityStatus === "balanced"
          ? t("The aisle stays clear for the processional.")
          : t("The aisle may feel narrow at full capacity."),
      tone: capacityTone
    };
  }

  if (objectId === "lighting") {
    return {
      eyebrow: t("Lighting"),
      title: t("Ceremony lighting"),
      rows: [{ label: t("Decoration"), value: plan.decorLevel }],
      recommendation: t("Warm lighting lifts the altar and softens the room for photos."),
      tone: "confirmed"
    };
  }

  return {
    eyebrow: t("Guest seating"),
    title: t("{count} guests", { count: plan.guestCount }),
    rows: [
      { label: t("Rows"), value: t("{count} rows", { count: capacity.recommendedRows }) },
      { label: t("Seats per row"), value: `${capacity.seatsPerRow}` },
      { label: t("Capacity used"), value: `${capacity.usedCapacityPercent}%` },
      { label: t("Accessible"), value: accessibility }
    ],
    recommendation: capacityRecommendation,
    tone: capacityTone
  };
}

export function CeremonyStudio() {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [sceneEdits] = useState(defaultStudioSceneEdits);
  const [selectedObjectId, setSelectedObjectId] = useState<StudioSceneObjectId>("guestSeating");
  const [preset, setPreset] = useState<PresetKey>("overview");
  const [lighting, setLighting] = useState<SceneLighting>("day");
  const [viewMode, setViewMode] = useState<StudioViewMode>("3d");

  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);
  const inspector = buildInspector(selectedObjectId, plan, capacity, t);

  return (
    <div className="studio-workspace">
      <aside aria-label={t("Ceremony controls")} className="studio-pane studio-pane-controls">
        <div className="studio-pane-head">
          <p className="eyebrow">{t("Ceremony Studio")}</p>
          <h2>{t("Design the ceremony")}</h2>
        </div>
        <SceneEditor capacity={capacity} onChange={setPlan} plan={plan} />
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
                aria-pressed={viewMode === "3d" && preset === key}
                data-active={viewMode === "3d" && preset === key}
                key={key}
                onClick={() => {
                  setPreset(key);
                  setViewMode("3d");
                }}
                type="button"
              >
                {t(PRESET_LABELS[key])}
              </button>
            ))}
            <button aria-pressed={viewMode === "top"} data-active={viewMode === "top"} onClick={() => setViewMode("top")} type="button">
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
              cameraOverride={viewMode === "3d" ? CAMERA_PRESETS[preset] : null}
              capacity={capacity}
              colorDirection={plan.colorDirection}
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

      <aside aria-label={t("Inspector")} className="studio-pane studio-pane-inspector">
        <div className="studio-pane-head">
          <p className="eyebrow">{inspector.eyebrow}</p>
          <h3>{inspector.title}</h3>
        </div>
        <dl className="studio-inspector-list">
          {inspector.rows.map((row) => (
            <div className="studio-inspector-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="studio-inspector-note" data-tone={inspector.tone}>
          <p>{inspector.recommendation}</p>
        </div>
      </aside>
    </div>
  );
}
