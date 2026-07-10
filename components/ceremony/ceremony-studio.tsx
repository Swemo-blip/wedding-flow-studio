"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, Maximize2, Music, Play, Settings, Sun, Users } from "lucide-react";
import { Donut } from "@/components/ui/donut";
import { CEREMONY_REFERENCES, StyleReferenceThumb, StyleReferences } from "@/components/wedding/style-references";
import { CeremonyScene, type CeremonyFirstPerson, type SceneCameraOverride, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  colorDirectionOptions,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  styleOptions,
  type StudioColorDirection,
  type StudioSceneObjectId,
  type StudioStyle,
  type StudioViewMode,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type CanvasTab = "studio" | "plan" | "camera";
type CameraMotion = "walk" | "orbit" | "fly";
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

// Walk/Orbit/Fly map to real camera framings. "Orbit" keeps the scene's own slow
// drift (no override); walk rides eye-level down the aisle; fly lifts overhead.
const MOTION_OVERRIDES: Record<CameraMotion, SceneCameraOverride | null> = {
  orbit: null,
  walk: { position: [0, 1.72, 7.6], target: [0, 1.2, -3] },
  fly: { position: [0, 6.6, 9.2], target: [0, 1, -3] }
};

const SEATING_LAYOUTS = ["Traditional", "Semi-circle", "Curved rows", "Spaced rows"];
const MUSIC_SETUPS = ["Live Music", "Recorded", "DJ", "Acoustic"];

const FLORAL_STYLE_LABELS: Record<StudioStyle, string> = {
  classic: "Garden Classic",
  romantic: "Romantic Blooms",
  modern: "Modern Minimal",
  rustic: "Rustic Wild"
};

const LIGHTING_MOODS: Array<{ id: string; label: string; mood: SceneLighting }> = [
  { id: "warm", label: "Warm & Romantic", mood: "dusk" },
  { id: "airy", label: "Bright & Airy", mood: "day" },
  { id: "golden", label: "Golden Hour", mood: "dusk" },
  { id: "candlelit", label: "Candlelit", mood: "dusk" },
  { id: "cool", label: "Cool Evening", mood: "dusk" }
];

const COLOR_SWATCHES: Record<StudioColorDirection, string> = {
  neutral: "#cdb79a",
  blush: "#d8a79c",
  green: "#7e8d6e",
  warm: "#c9a767",
  blue: "#8aa0b4",
  bold: "#7a5a86"
};

// The studio's signature theme palette (sage → ivory → champagne → blush → tan → gold).
const THEME_COLORS = ["#5f7355", "#9aa98c", "#efe6d4", "#d8b6ad", "#cdb38a", "#c19a52"];

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

  // Canvas view state. The interactive 3D twin is the studio's focus.
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("studio");
  const [cameraMotion, setCameraMotion] = useState<CameraMotion>("orbit");
  const [preset, setPreset] = useState<PresetKey>("overview");
  const [firstPerson, setFirstPerson] = useState<CeremonyFirstPerson>(null);
  const [lighting, setLighting] = useState<SceneLighting>("day");
  const [highQuality, setHighQuality] = useState(true);

  // Setup-panel state. Guest count, style, color and lighting drive the scene;
  // the remaining controls hold their own state to keep the panel fully live.
  const [seatingLayout, setSeatingLayout] = useState(SEATING_LAYOUTS[0]);
  const [lightingMoodId, setLightingMoodId] = useState("airy");
  const [aisleWidth, setAisleWidth] = useState(5);
  const [musicSetup, setMusicSetup] = useState(MUSIC_SETUPS[0]);
  const [decisionsDone, setDecisionsDone] = useState<Record<string, boolean>>({});

  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Share the plan with the home Overview studio through the persisted layout
  // store, so the ceremony opens on the same guest count, venue and style — and
  // any change here flows back to the same store.
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
  // The live guest list is the single source of truth for headcount. The plan's
  // stored guestCount is overridden with the real invited count, so the
  // ceremony numbers, capacity, and the 3D pew-fill always match the Guests
  // page instead of a separate slider value.
  const invitedGuests = guests.length;
  const capacity = useMemo(
    () => calculateWeddingStudioCapacity({ ...plan, guestCount: invitedGuests }),
    [plan, invitedGuests]
  );
  const comfort = comfortFromCapacity(capacity.capacityStatus);
  const seatedCount = Math.min(invitedGuests, capacity.totalCapacity);
  const seatsRemaining = Math.max(0, capacity.totalCapacity - invitedGuests);
  const unseatedCount = Math.max(0, invitedGuests - seatedCount);

  const viewMode: StudioViewMode = canvasTab === "plan" ? "top" : "3d";
  const cameraOverride =
    canvasTab === "plan" ? null : canvasTab === "camera" ? CAMERA_PRESETS[preset] : MOTION_OVERRIDES[cameraMotion];
  const effectiveFirstPerson = canvasTab === "camera" ? firstPerson : null;

  function chooseLightingMood(id: string) {
    const mood = LIGHTING_MOODS.find((option) => option.id === id);
    if (!mood) return;
    setLightingMoodId(id);
    setLighting(mood.mood);
  }

  function resetView() {
    setCanvasTab("studio");
    setCameraMotion("orbit");
    setPreset("overview");
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
        <aside aria-label={t("Ceremony setup")} className="studio-pane studio-pane-controls" ref={controlsRef}>
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
              onChange={(event) => setSeatingLayout(event.target.value)}
              value={seatingLayout}
            >
              {SEATING_LAYOUTS.map((option) => (
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
            <div aria-hidden="true" className="setup-swatch-row">
              {THEME_COLORS.map((color, index) => (
                <span key={index} style={{ background: color }} />
              ))}
            </div>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Lighting Mood")}</span>
            <select
              aria-label={t("Lighting Mood")}
              className="setup-select"
              onChange={(event) => chooseLightingMood(event.target.value)}
              value={lightingMoodId}
            >
              {LIGHTING_MOODS.map((mood) => (
                <option key={mood.id} value={mood.id}>
                  {t(mood.label)}
                </option>
              ))}
            </select>
            <div aria-label={t("Lighting Mood")} className="setup-thumb-row" role="group">
              {LIGHTING_MOODS.map((mood) => (
                <button
                  aria-label={t(mood.label)}
                  aria-pressed={lightingMoodId === mood.id}
                  className="setup-thumb"
                  data-active={lightingMoodId === mood.id}
                  data-mood={mood.mood}
                  key={mood.id}
                  onClick={() => chooseLightingMood(mood.id)}
                  title={t(mood.label)}
                  type="button"
                />
              ))}
            </div>
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
                {aisleWidth} {t("ft")}
              </span>
            </div>
            <input
              aria-label={t("Aisle Width")}
              className="setup-range"
              max={8}
              min={3}
              onChange={(event) => setAisleWidth(Number(event.target.value))}
              type="range"
              value={aisleWidth}
            />
            <div className="setup-range-scale">
              <span>3 {t("ft")}</span>
              <span>8 {t("ft")}</span>
            </div>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Music Setup")}</span>
            <select
              aria-label={t("Music Setup")}
              className="setup-select"
              onChange={(event) => setMusicSetup(event.target.value)}
              value={musicSetup}
            >
              {MUSIC_SETUPS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
            <div className="setup-ensemble">
              <Music aria-hidden="true" size={15} />
              <span>{t("String Quartet")}</span>
              <button aria-label={t("Preview music")} className="setup-ensemble-play" type="button">
                <Play aria-hidden="true" size={12} />
              </button>
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
              <button
                aria-pressed={canvasTab === "camera"}
                data-active={canvasTab === "camera"}
                onClick={() => setCanvasTab("camera")}
                type="button"
              >
                {t("Camera Views")}
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
                selectedObjectId={selectedObjectId}
                style={plan.style}
                venueType={plan.venueType}
                viewMode={viewMode}
              />
            </Suspense>

            {canvasTab === "camera" ? (
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

            {canvasTab === "studio" ? (
              <div aria-label={t("Camera motion")} className="stage-overlay stage-overlay-center" role="group">
                <button
                  aria-pressed={cameraMotion === "walk"}
                  data-active={cameraMotion === "walk"}
                  onClick={() => setCameraMotion("walk")}
                  type="button"
                >
                  {t("Walk")}
                </button>
                <button
                  aria-pressed={cameraMotion === "orbit"}
                  data-active={cameraMotion === "orbit"}
                  onClick={() => setCameraMotion("orbit")}
                  type="button"
                >
                  {t("Orbit")}
                </button>
                <button
                  aria-pressed={cameraMotion === "fly"}
                  data-active={cameraMotion === "fly"}
                  onClick={() => setCameraMotion("fly")}
                  type="button"
                >
                  {t("Fly")}
                </button>
              </div>
            ) : null}

            <div className="stage-overlay stage-overlay-right">
              {canvasTab === "studio" || canvasTab === "camera" ? (
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
              <button
                className="rail-edit"
                onClick={() => controlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                type="button"
              >
                {t("Edit")}
              </button>
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
                <dt>{t("Style")}</dt>
                <dd>{t(FLORAL_STYLE_LABELS[plan.style])}</dd>
              </div>
              <div className="studio-inspector-row studio-inspector-row-colors">
                <dt>{t("Theme Colors")}</dt>
                <dd className="rail-theme-colors">
                  {THEME_COLORS.map((color, index) => (
                    <span aria-hidden="true" key={index} style={{ background: color }} />
                  ))}
                </dd>
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

          <div className="studio-rail-block">
            <p className="eyebrow">{t("Next decisions")}</p>
            <ul className="rail-decision-list">
              {NEXT_DECISIONS.map((decision) => (
                <li key={decision.label}>
                  <label className="rail-decision">
                    <input
                      checked={Boolean(decisionsDone[decision.label])}
                      onChange={() =>
                        setDecisionsDone((previous) => ({ ...previous, [decision.label]: !previous[decision.label] }))
                      }
                      type="checkbox"
                    />
                    <span className="rail-decision-label">{t(decision.label)}</span>
                  </label>
                  <small>{t(decision.due)}</small>
                </li>
              ))}
            </ul>
            <a className="rail-link" href="/day-flow">
              {t("View all decisions")} <ChevronRight aria-hidden="true" size={14} />
            </a>
          </div>

          <div className="studio-rail-block">
            <p className="eyebrow">{t("Notes")}</p>
            <p className="studio-rail-note">{t("The couple would like soft candlelight for the ceremony.")}</p>
            <p className="rail-byline">{t("Updated today by {name}", { name: "Olivia Hart" })}</p>
          </div>
        </aside>
      </div>

      <div className="studio-cards">
        <section aria-label={t("Guest overview")} className="studio-card">
          <div className="studio-card-head">
            <Users aria-hidden="true" size={15} />
            <h3>{t("Guest overview")}</h3>
          </div>
          <div className="studio-card-stats">
            <div>
              <strong>{invitedGuests}</strong>
              <span>{t("Invited")}</span>
            </div>
            <div>
              <strong>{seatedCount}</strong>
              <span>{t("Seated")}</span>
            </div>
            <div>
              <strong>{unseatedCount}</strong>
              <span>{t("Unseated")}</span>
            </div>
            <div>
              <strong>6</strong>
              <span>{t("Vendors")}</span>
            </div>
          </div>
          <a className="rail-link" href="/guests">
            {t("View Guest List")} <ChevronRight aria-hidden="true" size={14} />
          </a>
        </section>

        <section aria-label={t("Seating map")} className="studio-card">
          <div className="studio-card-head">
            <h3>{t("Seating map")}</h3>
          </div>
          <div className="seating-map-figure">
            <svg aria-label={t("Seating map")} role="img" viewBox="0 0 200 120">
              <rect className="seating-altar" height="6" rx="3" width="46" x="77" y="3" />
              {Array.from({ length: 7 }).map((_, row) => (
                <g key={row}>
                  <rect className="seating-pew" height="9" rx="2" width="62" x="26" y={16 + row * 13} />
                  <rect className="seating-pew" height="9" rx="2" width="62" x="112" y={16 + row * 13} />
                </g>
              ))}
              <rect className="seating-aisle" height="98" rx="3" width="14" x="93" y="14" />
            </svg>
          </div>
        </section>

        <section aria-label={t("Style references")} className="studio-card">
          <div className="studio-card-head">
            <h3>{t("Style references")}</h3>
          </div>
          <div className="style-ref-card-body">
            <div className="style-ref-thumbs">
              {CEREMONY_REFERENCES.slice(0, 3).map((reference) => (
                <StyleReferenceThumb key={reference.id} reference={reference} />
              ))}
            </div>
            <div aria-hidden="true" className="style-ref-swatch-col">
              {THEME_COLORS.slice(0, 3).map((color, index) => (
                <span key={index} style={{ background: color }} />
              ))}
            </div>
          </div>
          <a className="rail-link" href="#style-board">
            {t("View Style Board")} <ChevronRight aria-hidden="true" size={14} />
          </a>
        </section>
      </div>

      <div id="style-board">
        <StyleReferences />
      </div>
    </>
  );
}
