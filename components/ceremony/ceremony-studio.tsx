"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Maximize2, Settings, Sun } from "lucide-react";
import { Donut } from "@/components/ui/donut";
import { StyleReferences } from "@/components/wedding/style-references";
import { CeremonyScene, type CeremonyFirstPerson, type SceneCameraOverride, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  colorDirectionOptions,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  MAX_AISLE_WIDTH_FEET,
  MIN_AISLE_WIDTH_FEET,
  seatingLayoutOptions,
  styleOptions,
  type StudioColorDirection,
  type StudioSceneObjectId,
  type StudioStyle,
  type StudioViewMode,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type CanvasTab = "studio" | "plan";
type PresetKey = "overview" | "entrance" | "couple" | "side";

const CAMERA_PRESETS: Record<PresetKey, SceneCameraOverride> = {
  overview: { position: [0, 2, 8.4], target: [0, 1.05, -3] },
  entrance: { position: [0, 1.85, 9.2], target: [0, 1.05, -3] },
  couple: { position: [0, 1.95, -3.1], target: [0, 1.25, 4.6] },
  side: { position: [7.6, 3.1, 1.6], target: [0, 0.85, -2.2] }
};

const PRESET_LABELS: Record<PresetKey, string> = {
  overview: "Overview",
  entrance: "From entrance",
  couple: "Couple",
  side: "Side"
};

const FLORAL_STYLE_LABELS: Record<StudioStyle, string> = {
  classic: "Garden Classic",
  romantic: "Romantic Blooms",
  modern: "Modern Minimal",
  rustic: "Rustic Wild"
};

const COLOR_SWATCHES: Record<StudioColorDirection, string> = {
  neutral: "#cdb79a",
  blush: "#d8a79c",
  green: "#7e8d6e",
  warm: "#c9a767",
  blue: "#8aa0b4",
  bold: "#7a5a86"
};

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

  // Canvas view state. The interactive 3D twin is the page's focus: one camera
  // row (framings + the couple's own eyes), a Plan View toggle, and nothing else.
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("studio");
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [firstPerson, setFirstPerson] = useState<CeremonyFirstPerson>(null);
  const [lighting, setLighting] = useState<SceneLighting>("day");
  const [highQuality, setHighQuality] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);

  // Share the plan with the home studio through the persisted layout store, so
  // the ceremony opens on the same style/colors/seating — and any change here
  // flows back to the same store.
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

  const { guests, wedding } = useLocalProject();
  // The live guest list is the single source of truth for headcount, so the
  // ceremony numbers, capacity, and the 3D pew-fill always match the Guests page.
  const invitedGuests = guests.length;
  const capacity = useMemo(
    () => calculateWeddingStudioCapacity({ ...plan, guestCount: invitedGuests }),
    [plan, invitedGuests]
  );
  const comfort = comfortFromCapacity(capacity.capacityStatus);
  const seatedCount = Math.min(invitedGuests, capacity.totalCapacity);
  const seatsRemaining = Math.max(0, capacity.totalCapacity - invitedGuests);

  const viewMode: StudioViewMode = canvasTab === "plan" ? "top" : "3d";
  const cameraOverride = canvasTab === "plan" ? null : preset ? CAMERA_PRESETS[preset] : null;
  const effectiveFirstPerson = canvasTab === "plan" ? null : firstPerson;

  function resetView() {
    setCanvasTab("studio");
    setPreset(null);
    setFirstPerson(null);
  }

  function captureView() {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "ceremony-view.png";
      link.click();
    } catch {
      // Capture can fail on some GPUs; fail quietly rather than break the view.
    }
  }

  function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
  }

  return (
    <>
      <div className="studio-workspace">
        <aside aria-label={t("Ceremony setup")} className="studio-pane studio-pane-controls">
          <div className="studio-pane-head">
            <p className="eyebrow">{t("Ceremony setup")}</p>
          </div>

          <div className="setup-field">
            <div className="setup-field-head">
              <span className="setup-label">{t("Guest Count")}</span>
              <span className="setup-value">{invitedGuests}</span>
            </div>
            <p className="setup-hint">{t("From your guest list — edit it on the Guests page.")}</p>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Seating Layout")}</span>
            <select
              aria-label={t("Seating Layout")}
              className="setup-select"
              onChange={(event) => applyPlan({ ...plan, seatingLayout: event.target.value })}
              value={plan.seatingLayout}
            >
              {seatingLayoutOptions.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Floral Style")}</span>
            <select
              aria-label={t("Floral Style")}
              className="setup-select"
              onChange={(event) => applyPlan({ ...plan, style: event.target.value as StudioStyle })}
              value={plan.style}
            >
              {styleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(FLORAL_STYLE_LABELS[option.value])}
                </option>
              ))}
            </select>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Color Palette")}</span>
            <div aria-label={t("Color Palette")} className="setup-color-row" role="group">
              {colorDirectionOptions.map((option) => (
                <button
                  aria-label={t(option.label)}
                  aria-pressed={plan.colorDirection === option.value}
                  className="setup-color"
                  data-active={plan.colorDirection === option.value}
                  key={option.value}
                  onClick={() => applyPlan({ ...plan, colorDirection: option.value as StudioColorDirection })}
                  style={{ background: COLOR_SWATCHES[option.value] }}
                  title={t(option.label)}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="setup-field">
            <div className="setup-field-head">
              <span className="setup-label">{t("Aisle Width")}</span>
              <span className="setup-value">
                {plan.aisleWidthFeet} {t("ft")}
              </span>
            </div>
            <input
              aria-label={t("Aisle Width")}
              className="setup-range"
              max={MAX_AISLE_WIDTH_FEET}
              min={MIN_AISLE_WIDTH_FEET}
              onChange={(event) => applyPlan({ ...plan, aisleWidthFeet: Number(event.target.value) })}
              type="range"
              value={plan.aisleWidthFeet}
            />
            <div className="setup-range-scale">
              <span>3 {t("ft")}</span>
              <span>8 {t("ft")}</span>
            </div>
          </div>
        </aside>

        <section aria-label={t("Ceremony preview")} className="studio-pane studio-pane-stage">
          <div className="stage-tabbar">
            <div aria-label={t("Canvas view")} className="stage-tabs" role="group">
              <button
                aria-pressed={canvasTab === "studio"}
                data-active={canvasTab === "studio"}
                onClick={() => setCanvasTab("studio")}
                type="button"
              >
                {t("3D Studio")}
              </button>
              <button
                aria-pressed={canvasTab === "plan"}
                data-active={canvasTab === "plan"}
                onClick={() => setCanvasTab("plan")}
                type="button"
              >
                {t("Plan View")}
              </button>
            </div>
            <div className="stage-icons">
                <button
                  aria-label={t("Toggle lighting")}
                  aria-pressed={lighting === "dusk"}
                  className="stage-icon"
                  data-active={lighting === "dusk"}
                  onClick={() => setLighting((previous) => (previous === "day" ? "dusk" : "day"))}
                  title={t("Toggle lighting")}
                  type="button"
                >
                  <Sun aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={t("Reset view")}
                  className="stage-icon"
                  onClick={resetView}
                  title={t("Reset view")}
                  type="button"
                >
                  <Settings aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={t("Save a still")}
                  className="stage-icon"
                  onClick={captureView}
                  title={t("Save a still")}
                  type="button"
                >
                  <Camera aria-hidden="true" size={16} />
                </button>
            </div>
          </div>

          <div className="studio-stage-canvas" ref={stageRef}>
            <Suspense fallback={<div aria-hidden="true" className="studio-stage-skeleton" />}>
              <CeremonyScene
                activeStep="ceremony"
                aisleWidthFeet={plan.aisleWidthFeet}
                budgetLevel={plan.budgetLevel}
                cameraOverride={cameraOverride}
                capacity={capacity}
                colorDirection={plan.colorDirection}
                firstPerson={effectiveFirstPerson}
                highQuality={highQuality}
                lighting={lighting}
                onMoveObject={() => undefined}
                onSelectObject={setSelectedObjectId}
                sceneEdits={sceneEdits}
                seatingLayout={plan.seatingLayout}
                selectedObjectId={selectedObjectId}
                style={plan.style}
                venueType="church"
                viewMode={viewMode}
              />
            </Suspense>

            {canvasTab === "studio" ? (
              <div aria-label={t("Camera Views")} className="stage-overlay stage-overlay-center" role="group">
                {(Object.keys(CAMERA_PRESETS) as PresetKey[]).map((key) => (
                  <button
                    aria-pressed={!firstPerson && preset === key}
                    data-active={!firstPerson && preset === key}
                    key={key}
                    onClick={() => {
                      setPreset(key);
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
                  onClick={() => setFirstPerson("bride")}
                  type="button"
                >
                  {t("Bride's eyes")}
                </button>
                <button
                  aria-pressed={firstPerson === "groom"}
                  data-active={firstPerson === "groom"}
                  onClick={() => setFirstPerson("groom")}
                  type="button"
                >
                  {t("Groom's eyes")}
                </button>
              </div>
            ) : null}

            <div className="stage-overlay stage-overlay-right">
              {canvasTab === "studio" ? (
                <button
                  aria-pressed={highQuality}
                  className="stage-hd"
                  data-active={highQuality}
                  onClick={() => setHighQuality((previous) => !previous)}
                  type="button"
                >
                  {t("HD")}
                </button>
              ) : null}
              <button aria-label={t("Fullscreen")} className="stage-icon" onClick={toggleFullscreen} title={t("Fullscreen")} type="button">
                <Maximize2 aria-hidden="true" size={15} />
              </button>
            </div>
          </div>
        </section>

        <aside aria-label={t("Ceremony summary")} className="studio-pane studio-pane-inspector">
          <div className="studio-rail-block">
            <div className="rail-block-head">
              <p className="eyebrow">{t("Ceremony summary")}</p>
            </div>
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
                  {invitedGuests} {t("invited")} · {seatedCount} {t("seated")}
                </dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Seating")}</dt>
                <dd>
                  {t(plan.seatingLayout)} · {plan.aisleWidthFeet} {t("ft")} {t("aisle")}
                </dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Style")}</dt>
                <dd>{t(FLORAL_STYLE_LABELS[plan.style])}</dd>
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
                  <span>{t("of {count} max capacity", { count: capacity.totalCapacity })}</span>
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
        </aside>
      </div>

      <details className="studio-detail-drawer style-board-drawer">
        <summary>
          <span>{t("Style references")}</span>
          <small>{t("Your own reference images — open when you want them.")}</small>
        </summary>
        <StyleReferences />
      </details>
    </>
  );
}
