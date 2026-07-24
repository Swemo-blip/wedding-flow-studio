"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, ChevronRight, Maximize2 } from "lucide-react";
import { ReceptionSeating3D } from "@/components/reception/reception-seating-3d";
import { Donut } from "@/components/ui/donut";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";

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

  // Seed selection with the first unseated guest (the one most worth placing),
  // falling back to the first guest — never a hardcoded name.
  const [selectedGuestId, setSelectedGuestId] = useState(
    () => guests.find((guest) => !guest.tableId)?.id ?? guests[0]?.id ?? ""
  );
  const [highQuality, setHighQuality] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);

  // The initial useState seed runs against the pre-hydration sample guest list
  // (localStorage hydrates in a post-commit microtask), so on a direct page load
  // the seeded id may not exist once the real guests arrive. Re-derive the
  // effective selection each render whenever the held id isn't in the live list.
  const effectiveSelectedId = guests.some((guest) => guest.id === selectedGuestId)
    ? selectedGuestId
    : guests.find((guest) => !guest.tableId)?.id ?? guests[0]?.id ?? "";
  const selectedGuest = guests.find((guest) => guest.id === effectiveSelectedId) ?? guests[0];

  // Every number is real: seats come from the actual dinner tables, seated from
  // actual assignments — no invented denominators.
  const invitedCount = guests.length;
  const totalSeats = useMemo(() => dinnerTables.reduce((sum, table) => sum + table.capacity, 0), [dinnerTables]);
  const seatedCount = useMemo(
    () => dinnerTables.reduce((sum, table) => sum + table.assignedGuestIds.length, 0),
    [dinnerTables]
  );
  const unseatedCount = Math.max(0, invitedCount - seatedCount);
  const seatsRemaining = Math.max(0, totalSeats - seatedCount);
  const capacityPercent = totalSeats > 0 ? Math.min(140, Math.round((seatedCount / totalSeats) * 100)) : 0;
  const overCapacity = invitedCount > totalSeats;
  const nearlyFull = !overCapacity && capacityPercent >= 85;
  const comfortDonut = overCapacity || nearlyFull ? "gold" : "sage";
  const comfortLabel = overCapacity ? "Over capacity" : nearlyFull ? "Nearly full" : "Comfortable";
  const comfortSpacing = overCapacity ? "Tight — add room" : nearlyFull ? "Snug spacing" : "Good spacing";

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

  return (
    <div className="studio-workspace">
      <aside aria-label={t("Reception setup")} className="studio-pane studio-pane-controls">
        <div className="studio-pane-head">
          <p className="eyebrow">{t("Reception setup")}</p>
        </div>

        <div className="setup-field">
          <div className="setup-field-head">
            <span className="setup-label">{t("Guest Count")}</span>
            <span className="setup-value">{invitedCount}</span>
          </div>
          <p className="setup-hint">{t("From your guest list — edit it on the Guests page.")}</p>
        </div>

        <div className="setup-field">
          <div className="setup-field-head">
            <span className="setup-label">{t("Tables")}</span>
            <span className="setup-value">{dinnerTables.length}</span>
          </div>
          <p className="setup-hint">
            {t("{seats} seats across {tables} tables", { seats: totalSeats, tables: dinnerTables.length })}
          </p>
        </div>

        <div className="setup-field">
          <div className="setup-field-head">
            <span className="setup-label">{t("Seated")}</span>
            <span className="setup-value">
              {seatedCount} / {invitedCount}
            </span>
          </div>
          <p className="setup-hint">{t("Drag a guest in the 3D room to change their seat — it saves instantly.")}</p>
        </div>

        <a className="rail-link" href="/guests">
          {t("View Guest List")} <ChevronRight aria-hidden="true" size={14} />
        </a>
      </aside>

      <section aria-label={t("Reception preview")} className="studio-pane studio-pane-stage">
        <div className="stage-tabbar">
          <div className="stage-tabs" role="presentation">
            <button aria-pressed data-active type="button">
              {t("3D Studio")}
            </button>
          </div>
          <div className="stage-icons">
            <button aria-label={t("Save a still")} className="stage-icon" onClick={captureView} title={t("Save a still")} type="button">
              <Camera aria-hidden="true" size={16} />
            </button>
            <button
              aria-pressed={highQuality}
              className="stage-hd"
              data-active={highQuality}
              onClick={() => setHighQuality((value) => !value)}
              type="button"
            >
              {t("HD")}
            </button>
            <button aria-label={t("Fullscreen")} className="stage-icon" onClick={toggleFullscreen} title={t("Fullscreen")} type="button">
              <Maximize2 aria-hidden="true" size={15} />
            </button>
          </div>
        </div>

        <div className="studio-stage-canvas" ref={stageRef}>
          <ReceptionSeating3D
            cameraMode="orbit"
            guests={guests}
            highQuality={highQuality}
            onReassignGuest={assignGuestToTable}
            onSelectGuest={setSelectedGuestId}
            selectedGuestId={selectedGuest?.id ?? ""}
            tables={dinnerTables}
          />
        </div>
      </section>

      <aside aria-label={t("Reception summary")} className="studio-pane studio-pane-inspector">
        <div className="studio-rail-block">
          <div className="rail-block-head">
            <p className="eyebrow">{t("Reception summary")}</p>
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
            {unseatedCount > 0 ? (
              <div className="studio-inspector-row">
                <dt>{t("Unseated")}</dt>
                <dd>{unseatedCount}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="studio-rail-block">
          <p className="eyebrow">{t("Capacity & comfort")}</p>
          <div className="studio-capacity">
            <Donut percent={Math.min(100, capacityPercent)} tone={comfortDonut}>
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
      </aside>
    </div>
  );
}
