"use client";

import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, Maximize2, Minus, Music, Plus, Settings, Users } from "lucide-react";
import { ReceptionSeating3D, type ReceptionCameraMode } from "@/components/reception/reception-seating-3d";
import { TableCard } from "@/components/reception/table-card";
import { Donut } from "@/components/ui/donut";
import { CEREMONY_REFERENCES, StyleReferenceThumb, StyleReferences } from "@/components/wedding/style-references";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { venueLayout } from "@/lib/wedding-data";
import { colorDirectionOptions, type StudioColorDirection } from "@/lib/wedding-studio-plan";

type CanvasTab = "studio" | "plan" | "camera";

const TABLE_STYLES = ["Round", "Long", "Mixed"];
const DANCE_FLOOR_SIZES = ["Small (12' x 12')", "Medium (16' x 16')", "Large (20' x 20')"];
const ENTERTAINMENT_OPTIONS = ["Live Band", "DJ", "Acoustic", "Playlist"];
const RECEPTION_FLORAL = ["Garden Romantic", "Garden Classic", "Romantic Blooms", "Modern Minimal", "Rustic Wild"];

const LIGHTING_MOODS = ["Warm & Romantic", "Bright & Airy", "Golden Hour", "Candlelit", "Cool Evening"];

const COLOR_SWATCHES: Record<StudioColorDirection, string> = {
  neutral: "#cdb79a",
  blush: "#d8a79c",
  green: "#7e8d6e",
  warm: "#c9a767",
  blue: "#8aa0b4",
  bold: "#7a5a86"
};

const THEME_COLORS = ["#5f7355", "#9aa98c", "#efe6d4", "#d8b6ad", "#cdb38a", "#c19a52"];

const NEXT_DECISIONS: Array<{ due: string; label: string }> = [
  { due: "Due in 5 days", label: "Confirm menu selections" },
  { due: "Due in 6 days", label: "Finalize the seating chart" },
  { due: "Due in 1 week", label: "Review lighting & AV" }
];

function formatWeddingDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });
}

export function ReceptionStudio() {
  const { t } = useTranslation();
  const { assignGuestToTable, dinnerTables, guests, wedding } = useLocalProject();

  const [selectedGuestId, setSelectedGuestId] = useState("anna-carter");

  // Canvas view state.
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("studio");
  const [cameraMode, setCameraMode] = useState<ReceptionCameraMode>("orbit");
  const [highQuality, setHighQuality] = useState(true);

  // Room-design state. Table count + seats drive the planning numbers and the
  // Table Layout diagram; the rest hold live state for the design.
  const [tableStyle, setTableStyle] = useState(TABLE_STYLES[0]);
  const [tableCount, setTableCount] = useState(Math.max(1, dinnerTables.length));
  const [seatsPerTable, setSeatsPerTable] = useState(8);
  const [sweetheart, setSweetheart] = useState(true);
  const [danceFloor, setDanceFloor] = useState(true);
  const [danceFloorSize, setDanceFloorSize] = useState(DANCE_FLOOR_SIZES[2]);
  const [floralStyle, setFloralStyle] = useState(RECEPTION_FLORAL[0]);
  const [lightingMood, setLightingMood] = useState(LIGHTING_MOODS[0]);
  const [colorDirection, setColorDirection] = useState<StudioColorDirection>("green");
  const [entertainment, setEntertainment] = useState(ENTERTAINMENT_OPTIONS[0]);
  const [decisionsDone, setDecisionsDone] = useState<Record<string, boolean>>({});

  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? guests[0];
  const selectedTable = dinnerTables.find((table) => table.id === selectedGuest?.tableId) ?? dinnerTables[0];

  // Planning numbers derive from the room-design controls so the capacity donut,
  // summary and Table Layout diagram all stay consistent as you adjust them.
  const totalSeats = tableCount * seatsPerTable;
  const invitedCount = guests.length;
  const realSeated = useMemo(
    () => dinnerTables.reduce((sum, table) => sum + table.assignedGuestIds.length, 0),
    [dinnerTables]
  );
  const seatedCount = Math.min(realSeated, totalSeats);
  const seatsRemaining = Math.max(0, totalSeats - seatedCount);
  const unseatedCount = Math.max(0, invitedCount - seatedCount);
  const capacityPercent = totalSeats > 0 ? Math.min(140, Math.round((seatedCount / totalSeats) * 100)) : 0;
  const overCapacity = seatedCount > totalSeats;
  const nearlyFull = !overCapacity && capacityPercent >= 85;
  const comfortDonut = overCapacity || nearlyFull ? "gold" : "sage";
  const comfortLabel = overCapacity ? "Over capacity" : nearlyFull ? "Nearly full" : "Comfortable";
  const comfortSpacing = overCapacity ? "Tight — add room" : nearlyFull ? "Snug spacing" : "Good spacing";

  function resetView() {
    setCanvasTab("studio");
    setCameraMode("orbit");
  }

  function captureView() {
    const canvas = stageRef.current?.querySelector("canvas");
    if (!canvas) return;
    try {
      const url = (canvas as HTMLCanvasElement).toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "reception-view.png";
      link.click();
    } catch {
      // Capture can fail on some GPUs; fail quietly.
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

  const showThreeD = canvasTab !== "plan";

  return (
    <>
      <div className="studio-workspace">
        <aside aria-label={t("Reception setup")} className="studio-pane studio-pane-controls" ref={controlsRef}>
          <div className="studio-pane-head">
            <p className="eyebrow">{t("Reception setup")}</p>
          </div>

          <div className="setup-field">
            <div className="setup-field-head">
              <span className="setup-label">{t("Guest Count")}</span>
              <span className="setup-value">{invitedCount}</span>
            </div>
            <input
              aria-label={t("Guest Count")}
              className="setup-range"
              max={200}
              min={20}
              onChange={() => undefined}
              readOnly
              type="range"
              value={Math.min(200, invitedCount)}
            />
            <div className="setup-range-scale">
              <span>20</span>
              <span>200</span>
            </div>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Table Style")}</span>
            <select
              aria-label={t("Table Style")}
              className="setup-select"
              onChange={(event) => setTableStyle(event.target.value)}
              value={tableStyle}
            >
              {TABLE_STYLES.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="setup-field">
            <div className="setup-field-head">
              <span className="setup-label">{t("Number of Tables")}</span>
              <div className="setup-stepper">
                <button
                  aria-label={t("Fewer tables")}
                  disabled={tableCount <= 1}
                  onClick={() => setTableCount((value) => Math.max(1, value - 1))}
                  type="button"
                >
                  <Minus aria-hidden="true" size={13} />
                </button>
                <span className="setup-stepper-value">{tableCount}</span>
                <button
                  aria-label={t("More tables")}
                  disabled={tableCount >= 30}
                  onClick={() => setTableCount((value) => Math.min(30, value + 1))}
                  type="button"
                >
                  <Plus aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="setup-field">
            <div className="setup-field-head">
              <span className="setup-label">{t("Seats per Table")}</span>
              <div className="setup-stepper">
                <button
                  aria-label={t("Fewer seats")}
                  disabled={seatsPerTable <= 4}
                  onClick={() => setSeatsPerTable((value) => Math.max(4, value - 1))}
                  type="button"
                >
                  <Minus aria-hidden="true" size={13} />
                </button>
                <span className="setup-stepper-value">{seatsPerTable}</span>
                <button
                  aria-label={t("More seats")}
                  disabled={seatsPerTable >= 12}
                  onClick={() => setSeatsPerTable((value) => Math.min(12, value + 1))}
                  type="button"
                >
                  <Plus aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="setup-field setup-field-row">
            <span className="setup-label">{t("Sweetheart Table")}</span>
            <button
              aria-label={t("Sweetheart Table")}
              aria-pressed={sweetheart}
              className="setup-switch"
              data-on={sweetheart}
              onClick={() => setSweetheart((value) => !value)}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
          </div>

          <div className="setup-field">
            <div className="setup-field-row">
              <span className="setup-label">{t("Dance Floor")}</span>
              <button
                aria-label={t("Dance Floor")}
                aria-pressed={danceFloor}
                className="setup-switch"
                data-on={danceFloor}
                onClick={() => setDanceFloor((value) => !value)}
                type="button"
              >
                <span aria-hidden="true" />
              </button>
            </div>
            {danceFloor ? (
              <select
                aria-label={t("Dance Floor Size")}
                className="setup-select"
                onChange={(event) => setDanceFloorSize(event.target.value)}
                value={danceFloorSize}
              >
                {DANCE_FLOOR_SIZES.map((option) => (
                  <option key={option} value={option}>
                    {t(option)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Floral Style")}</span>
            <select
              aria-label={t("Floral Style")}
              className="setup-select"
              onChange={(event) => setFloralStyle(event.target.value)}
              value={floralStyle}
            >
              {RECEPTION_FLORAL.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
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
              onChange={(event) => setLightingMood(event.target.value)}
              value={lightingMood}
            >
              {LIGHTING_MOODS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
            <div aria-label={t("Lighting Mood")} className="setup-thumb-row" role="group">
              {LIGHTING_MOODS.map((option) => (
                <button
                  aria-label={t(option)}
                  aria-pressed={lightingMood === option}
                  className="setup-thumb"
                  data-active={lightingMood === option}
                  data-mood="dusk"
                  key={option}
                  onClick={() => setLightingMood(option)}
                  title={t(option)}
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
                  aria-pressed={colorDirection === option.value}
                  className="setup-color"
                  data-active={colorDirection === option.value}
                  key={option.value}
                  onClick={() => setColorDirection(option.value as StudioColorDirection)}
                  style={{ background: COLOR_SWATCHES[option.value] }}
                  title={t(option.label)}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="setup-field">
            <span className="setup-label">{t("Entertainment Setup")}</span>
            <select
              aria-label={t("Entertainment Setup")}
              className="setup-select"
              onChange={(event) => setEntertainment(event.target.value)}
              value={entertainment}
            >
              {ENTERTAINMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
            <div className="setup-ensemble">
              <Music aria-hidden="true" size={15} />
              <span>{t(entertainment)}</span>
            </div>
          </div>
        </aside>

        <section aria-label={t("Reception preview")} className="studio-pane studio-pane-stage">
          <div className="stage-tabbar">
            <div aria-label={t("Canvas view")} className="stage-tabs" role="group">
              <button aria-pressed={canvasTab === "studio"} data-active={canvasTab === "studio"} onClick={() => setCanvasTab("studio")} type="button">
                {t("3D Studio")}
              </button>
              <button aria-pressed={canvasTab === "plan"} data-active={canvasTab === "plan"} onClick={() => setCanvasTab("plan")} type="button">
                {t("Plan View")}
              </button>
              <button aria-pressed={canvasTab === "camera"} data-active={canvasTab === "camera"} onClick={() => setCanvasTab("camera")} type="button">
                {t("Camera Views")}
              </button>
            </div>
            <div className="stage-icons">
              <button aria-label={t("Reset view")} className="stage-icon" onClick={resetView} title={t("Reset view")} type="button">
                <Settings aria-hidden="true" size={16} />
              </button>
              <button aria-label={t("Save a still")} className="stage-icon" onClick={captureView} title={t("Save a still")} type="button">
                <Camera aria-hidden="true" size={16} />
              </button>
            </div>
          </div>

          <div className="studio-stage-canvas" ref={stageRef}>
            {showThreeD ? (
              <ReceptionSeating3D
                cameraMode={cameraMode}
                guests={guests}
                highQuality={highQuality}
                onReassignGuest={assignGuestToTable}
                onSelectGuest={setSelectedGuestId}
                selectedGuestId={selectedGuest?.id ?? ""}
                tables={dinnerTables}
              />
            ) : (
              <div aria-label={t("Reception room scene")} className="canvas reception-canvas">
                {venueLayout.objects.map((object) => {
                  const style: CSSProperties = {
                    left: `${object.position.x}%`,
                    top: `${object.position.y}%`,
                    width: object.size ? `${object.size.width}%` : undefined,
                    height: object.size ? `${object.size.height}%` : undefined
                  };

                  return (
                    <div className={`room-object room-object-${object.type}`} key={object.id} style={style}>
                      {object.label}
                    </div>
                  );
                })}
                {dinnerTables.map((table) => (
                  <TableCard
                    guests={guests}
                    isSelected={table.id === selectedTable?.id}
                    key={table.id}
                    onReassignGuest={assignGuestToTable}
                    onSelect={(tableId) => {
                      const firstGuestAtTable = guests.find((guest) => guest.tableId === tableId);
                      if (firstGuestAtTable) {
                        setSelectedGuestId(firstGuestAtTable.id);
                      }
                    }}
                    onSelectGuest={setSelectedGuestId}
                    table={table}
                  />
                ))}
              </div>
            )}

            {showThreeD ? (
              <div aria-label={t("Camera motion")} className="stage-overlay stage-overlay-center" role="group">
                <button aria-pressed={cameraMode === "walk"} data-active={cameraMode === "walk"} onClick={() => setCameraMode("walk")} type="button">
                  {t("Walk")}
                </button>
                <button aria-pressed={cameraMode === "orbit"} data-active={cameraMode === "orbit"} onClick={() => setCameraMode("orbit")} type="button">
                  {t("Orbit")}
                </button>
                <button aria-pressed={cameraMode === "fly"} data-active={cameraMode === "fly"} onClick={() => setCameraMode("fly")} type="button">
                  {t("Fly")}
                </button>
              </div>
            ) : null}

            <div className="stage-overlay stage-overlay-right">
              <button aria-pressed={highQuality} className="stage-hd" data-active={highQuality} onClick={() => setHighQuality((value) => !value)} type="button">
                {t("HD")}
              </button>
              <button aria-label={t("Fullscreen")} className="stage-icon" onClick={toggleFullscreen} title={t("Fullscreen")} type="button">
                <Maximize2 aria-hidden="true" size={15} />
              </button>
            </div>
          </div>
        </section>

        <aside aria-label={t("Reception summary")} className="studio-pane studio-pane-inspector">
          <div className="studio-rail-block">
            <div className="rail-block-head">
              <p className="eyebrow">{t("Reception summary")}</p>
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
                <dd>{wedding.receptionLocation}</dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Guests")}</dt>
                <dd>
                  {invitedCount} {t("invited")} · {seatedCount} {t("seated")}
                </dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Style")}</dt>
                <dd>{t(floralStyle)}</dd>
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
              <Donut percent={capacityPercent} tone={comfortDonut}>
                <strong>{capacityPercent}%</strong>
                <span>{t(comfortLabel)}</span>
              </Donut>
              <div className="studio-capacity-stats">
                <div>
                  <strong>{seatedCount}</strong>
                  <span>{t("of {count} max capacity", { count: totalSeats })}</span>
                </div>
                <div>
                  <strong>{seatsRemaining}</strong>
                  <span>{t("seats remaining")}</span>
                </div>
                <span className="studio-capacity-spacing" data-tone={comfortDonut === "gold" ? "medium" : "confirmed"}>
                  {t(comfortSpacing)}
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
                      onChange={() => setDecisionsDone((previous) => ({ ...previous, [decision.label]: !previous[decision.label] }))}
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
            <p className="studio-rail-note">{t("Live band plays 6:00–10:30 PM. Uplighting in warm amber.")}</p>
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
              <strong>{invitedCount}</strong>
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

        <section aria-label={t("Table layout")} className="studio-card">
          <div className="studio-card-head">
            <h3>{t("Table layout")}</h3>
          </div>
          <div className="table-layout-figure">
            <svg aria-label={t("Table layout")} role="img" viewBox="0 0 220 150">
              {entertainment !== "Playlist" ? (
                <g>
                  <rect className="table-layout-band" height="16" rx="3" width="70" x="75" y="6" />
                  <text className="table-layout-tag" x="110" y="17">
                    {t("Band")}
                  </text>
                </g>
              ) : null}
              {danceFloor ? (
                <g>
                  <rect className="table-layout-dance" height="40" rx="4" width="60" x="80" y="56" />
                  <text className="table-layout-tag" x="110" y="79">
                    {t("Dance")}
                  </text>
                </g>
              ) : null}
              {sweetheart ? <circle className="table-layout-sweetheart" cx="110" cy="38" r="7" /> : null}
              {Array.from({ length: Math.min(tableCount, 16) }).map((_, index) => {
                const perimeter = [
                  [26, 42], [26, 80], [26, 116], [60, 132], [110, 134], [160, 132], [194, 116], [194, 80], [194, 42], [160, 28],
                  [52, 116], [168, 116], [40, 60], [180, 60], [70, 130], [150, 130]
                ];
                const [cx, cy] = perimeter[index] ?? [110, 75];
                return <circle className="table-layout-table" cx={cx} cy={cy} key={index} r="9" />;
              })}
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
