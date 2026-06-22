"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { ReceptionSeating3D } from "@/components/reception/reception-seating-3d";
import { TableCard } from "@/components/reception/table-card";
import { Button } from "@/components/ui/button";
import { buildGuestProfile } from "@/lib/guest-identity";
import { useTranslation } from "@/lib/i18n";
import { fileToDownscaledDataUrl } from "@/lib/image-upload";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import { venueLayout } from "@/lib/wedding-data";
import type { Guest } from "@/lib/wedding-types";

const receptionRiskIds = [
  "risk-catering-allergy",
  "risk-vegan-meal",
  "risk-child-meal",
  "risk-accessibility",
  "risk-seating-conflict",
  "risk-service-path"
];

export function ReceptionStudio() {
  const { t } = useTranslation();
  const {
    assignGuestToTable,
    dinnerTables,
    guests,
    hasLocalProject,
    resetReception,
    speeches,
    timelineItems,
    updateGuest,
    updatedAt
  } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const [selectedGuestId, setSelectedGuestId] = useState("anna-carter");
  const [seatingView, setSeatingView] = useState<"plan" | "3d">("3d");
  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? guests[0];
  const selectedTable = dinnerTables.find((table) => table.id === selectedGuest?.tableId) ?? dinnerTables[0];
  const guestProfile = selectedGuest
    ? buildGuestProfile(selectedGuest, { guests, tables: dinnerTables, speeches })
    : null;
  const receptionRisks = useMemo(
    () =>
      filterResolvedRisks(analyzeWeddingFlow({ timeline: timelineItems, guestItems: guests, tables: dinnerTables }), resolvedRiskIds).filter(
        (risk) => receptionRiskIds.includes(risk.id)
      ),
    [dinnerTables, guests, resolvedRiskIds, timelineItems]
  );
  const selectedGuestRisks = selectedGuest
    ? receptionRisks.filter((risk) => risk.relatedEntityId === selectedGuest.id || risk.relatedEntityId === selectedTable?.id)
    : [];
  const saveStatus = hasLocalProject && updatedAt ? `Saved locally ${formatSavedAt(updatedAt)}` : "Autosave ready";
  const bestReceptionRisk = selectedGuestRisks[0] ?? receptionRisks[0] ?? null;
  const allergyGuestCount = guests.filter((guest) => guest.allergies.length > 0).length;
  const accessibilityGuestCount = guests.filter((guest) => Boolean(guest.accessibilityNotes)).length;
  const selectedTableGuests = selectedTable
    ? selectedTable.assignedGuestIds.map((guestId) => guests.find((guest) => guest.id === guestId)).filter((guest): guest is Guest => Boolean(guest))
    : [];

  function updateSelectedGuest(updates: Partial<Guest>) {
    if (!selectedGuest) {
      return;
    }

    updateGuest(selectedGuest.id, updates);
  }

  async function handleSelectedGuestPhoto(file: File | null) {
    if (!file || !selectedGuest) {
      return;
    }

    const photoUrl = await fileToDownscaledDataUrl(file);
    updateGuest(selectedGuest.id, { photoUrl });
  }

  function applyGuestJourneyFix() {
    if (!selectedGuest) {
      return;
    }

    const risk = selectedGuestRisks[0] ?? receptionRisks[0];
    if (!risk) {
      return;
    }

    if (risk.id === "risk-seating-conflict") {
      assignGuestToTable("lisa-ek", "table-4");
      updateGuest("lisa-ek", {
        tags: addUniqueTag(guests.find((guest) => guest.id === "lisa-ek")?.tags ?? [], "seating conflict resolved")
      });
      setSelectedGuestId("lisa-ek");
      return;
    }

    if (risk.id === "risk-catering-allergy") {
      updateGuest(risk.relatedEntityId, {
        tags: addUniqueTag(guests.find((guest) => guest.id === risk.relatedEntityId)?.tags ?? [], "allergy brief sent")
      });
      return;
    }

    if (risk.id === "risk-vegan-meal") {
      updateGuest(risk.relatedEntityId, {
        tags: addUniqueTag(guests.find((guest) => guest.id === risk.relatedEntityId)?.tags ?? [], "meal confirmed")
      });
      return;
    }

    if (risk.id === "risk-child-meal") {
      updateGuest(risk.relatedEntityId, {
        tags: addUniqueTag(guests.find((guest) => guest.id === risk.relatedEntityId)?.tags ?? [], "child setup confirmed")
      });
      return;
    }

    if (risk.id === "risk-accessibility") {
      updateGuest(risk.relatedEntityId, {
        tags: addUniqueTag(guests.find((guest) => guest.id === risk.relatedEntityId)?.tags ?? [], "accessibility route confirmed")
      });
    }
  }

  return (
    <div className="studio-workspace reception-workspace">
      <aside aria-label={t("Reception controls")} className="studio-pane studio-pane-controls">
        <div className="studio-pane-head">
          <p className="eyebrow">{t("Reception studio")}</p>
          <h2>{t("Design the reception room")}</h2>
        </div>

        <div className="studio-control-block">
          <label className="field reception-select-field">
            <span>{t("Active guest")}</span>
            <select aria-label={t("Choose guest")} onChange={(event) => setSelectedGuestId(event.target.value)} value={selectedGuest?.id ?? ""}>
              {guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.name} · {guest.relationship}
                </option>
              ))}
            </select>
          </label>
          <label className="field reception-select-field">
            <span>{t("Seat at table")}</span>
            <select
              aria-label={t("Seat at table")}
              disabled={!selectedGuest}
              onChange={(event) => selectedGuest && assignGuestToTable(selectedGuest.id, event.target.value)}
              value={selectedGuest?.tableId ?? ""}
            >
              {dinnerTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="studio-control-block">
          <span className="studio-control-label">{t("Next seating decision")}</span>
          <div className="studio-inspector-note" data-tone={bestReceptionRisk ? "medium" : "confirmed"}>
            <strong>{bestReceptionRisk ? t(bestReceptionRisk.title) : t("Seating looks ready to review.")}</strong>
            <p>{bestReceptionRisk ? t(bestReceptionRisk.suggestedFix) : t("Review the room once more before exporting the seating plan and venue setup brief.")}</p>
            {bestReceptionRisk ? (
              <Button onClick={applyGuestJourneyFix} size="small">{t("Apply this fix")}</Button>
            ) : null}
          </div>
        </div>

        <div className="studio-control-block">
          <span className="studio-control-label">{t("Room overview")}</span>
          <dl className="studio-inspector-list">
            <div className="studio-inspector-row">
              <dt>{t("Tables")}</dt>
              <dd>{dinnerTables.length}</dd>
            </div>
            <div className="studio-inspector-row">
              <dt>{t("Allergy notes")}</dt>
              <dd>{allergyGuestCount}</dd>
            </div>
            <div className="studio-inspector-row">
              <dt>{t("Accessibility notes")}</dt>
              <dd>{accessibilityGuestCount}</dd>
            </div>
          </dl>
        </div>

        {selectedGuest ? (
          <details className="reception-guest-details studio-control-block">
            <summary>
              <span>{t("Edit Guest Details")}</span>
              <small>{t("Open only when you need to adjust meal, tags, table, or accessibility notes.")}</small>
            </summary>
            <div className="form-grid reception-guest-form">
              <label className="field">
                <span>{t("Name")}</span>
                <input onChange={(event) => updateSelectedGuest({ name: event.target.value })} value={selectedGuest.name} />
              </label>
              <label className="field">
                <span>{t("Relationship to couple")}</span>
                <input onChange={(event) => updateSelectedGuest({ relationship: event.target.value })} value={selectedGuest.relationship} />
              </label>
              <label className="field">
                <span>{t("Meal choice")}</span>
                <input onChange={(event) => updateSelectedGuest({ mealChoice: event.target.value })} value={selectedGuest.mealChoice} />
              </label>
              <label className="field">
                <span>{t("Table")}</span>
                <select onChange={(event) => assignGuestToTable(selectedGuest.id, event.target.value)} value={selectedGuest.tableId}>
                  {dinnerTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{t("Language")}</span>
                <input onChange={(event) => updateSelectedGuest({ language: event.target.value })} value={selectedGuest.language} />
              </label>
              <label className="field reception-wide-field">
                <span>{t("Allergies")}</span>
                <input
                  onChange={(event) =>
                    updateSelectedGuest({
                      allergies: event.target.value
                        .split(",")
                        .map((allergy) => allergy.trim())
                        .filter(Boolean)
                    })
                  }
                  value={selectedGuest.allergies.join(", ")}
                />
              </label>
              <label className="field reception-wide-field">
                <span>{t("Tags")}</span>
                <input
                  onChange={(event) =>
                    updateSelectedGuest({
                      tags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean)
                    })
                  }
                  value={selectedGuest.tags.join(", ")}
                />
              </label>
              <label className="field reception-wide-field">
                <span>{t("Accessibility notes")}</span>
                <textarea
                  onChange={(event) => updateSelectedGuest({ accessibilityNotes: event.target.value })}
                  rows={3}
                  value={selectedGuest.accessibilityNotes}
                />
              </label>
            </div>
          </details>
        ) : null}

        <div className="studio-control-block reception-controls-footer">
          <span className="copy-status">{saveStatus}</span>
          <Button onClick={resetReception} size="small" variant="secondary">{t("Reset reception")}</Button>
        </div>
      </aside>

      <section aria-label={t("Reception preview")} className="studio-pane studio-pane-stage">
        <div className="studio-stage-toolbar">
          <div className="studio-preset-row reception-view-toggle" role="group" aria-label={t("Seating view")}>
            <button aria-pressed={seatingView === "3d"} data-active={seatingView === "3d"} onClick={() => setSeatingView("3d")} type="button">
              {t("3D seating")}
            </button>
            <button aria-pressed={seatingView === "plan"} data-active={seatingView === "plan"} onClick={() => setSeatingView("plan")} type="button">
              {t("2D plan")}
            </button>
          </div>
          <span className="studio-twin-status">
            {selectedTable
              ? `${selectedTable.name} · ${selectedTableGuests.length}/${selectedTable.capacity} ${t("guests")}`
              : t("Live 3D · updates as you plan")}
          </span>
        </div>
        <div className="studio-stage-canvas">
          {seatingView === "3d" ? (
            <ReceptionSeating3D
              guests={guests}
              onReassignGuest={assignGuestToTable}
              onSelectGuest={setSelectedGuestId}
              selectedGuestId={selectedGuest?.id ?? ""}
              tables={dinnerTables}
            />
          ) : (
            <div className="canvas reception-canvas" aria-label={t("Reception room scene")}>
              <div className="reception-room-header">
                <div>
                  <span>Rosewood Hall Ballroom</span>
                  <strong>{t("Guest Journey Canvas")}</strong>
                </div>
                <span className="reception-state-line" data-tone={receptionRisks.length > 0 ? "medium" : "confirmed"}>
                  {receptionRisks.length > 0 ? `${receptionRisks.length} ${t("signals")}` : t("ready")}
                </span>
              </div>
              <div className="reception-canvas-hud" aria-hidden="true">
                <span>{t("Entrance route")}</span>
                <span>{t("Service path")}</span>
                <span>{t("Dance transition")}</span>
              </div>
              <span className="reception-guest-route reception-guest-route-primary" aria-hidden="true" />
              <span className="reception-guest-route reception-guest-route-dance" aria-hidden="true" />
              <span className="reception-service-route" aria-hidden="true" />
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
              <div className="reception-selected-table-card" aria-label={t("Selected Table")}>
                <span>{t("Selected Table")}</span>
                <strong>{selectedTable?.name}</strong>
                <p>
                  {selectedTableGuests.length}/{selectedTable?.capacity ?? 0} {t("guests")} ·{" "}
                  {selectedTableGuests.some((guest) => guest.allergies.length > 0) ? t("allergy note attached") : t("no allergy note")}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <aside aria-label={t("Guest Identity")} className="studio-pane studio-pane-inspector">
        <div className="studio-pane-head reception-identity-head">
          <span className="guests-avatar reception-identity-avatar" data-has-photo={selectedGuest?.photoUrl ? "true" : undefined}>
            {selectedGuest?.photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" src={selectedGuest.photoUrl} />
                <button
                  aria-label={t("Remove photo")}
                  className="guests-avatar-remove"
                  onClick={() => updateSelectedGuest({ photoUrl: undefined })}
                  type="button"
                >
                  ×
                </button>
              </>
            ) : (
              <label className="guests-avatar-add" title={t("Add photo")}>
                <span aria-hidden="true">{selectedGuest ? guestInitials(selectedGuest.name) : ""}</span>
                <input accept="image/*" hidden onChange={(event) => handleSelectedGuestPhoto(event.target.files?.[0] ?? null)} type="file" />
                <span className="sr-only">{t("Add photo")}</span>
              </label>
            )}
          </span>
          <div>
            <p className="eyebrow">{t("Guest Identity")}</p>
            <h3>{selectedGuest?.name}</h3>
            {guestProfile ? (
              <p className="reception-guest-relation">
                {guestProfile.relationToCouple} · {t(rsvpLabel(guestProfile.rsvpStatus))}
              </p>
            ) : null}
          </div>
        </div>
        <dl className="studio-inspector-list">
          <div className="studio-inspector-row">
            <dt>{t("Seat")}</dt>
            <dd>{guestProfile?.table ? guestProfile.seatLabel : t("Unassigned")}</dd>
          </div>
          <div className="studio-inspector-row">
            <dt>{t("Meal")}</dt>
            <dd>{selectedGuest?.mealChoice}</dd>
          </div>
          <div className="studio-inspector-row">
            <dt>{t("Speech")}</dt>
            <dd>
              {guestProfile?.speech ? `${guestProfile.speech.title} · ${guestProfile.speech.timing}` : t("Not speaking")}
            </dd>
          </div>
          <div className="studio-inspector-row" data-tone={guestProfile?.hasAllergies ? "alert" : undefined}>
            <dt>{t("Allergies")}</dt>
            <dd>{guestProfile?.hasAllergies ? guestProfile.allergies.join(", ") : t("None")}</dd>
          </div>
        </dl>
        {guestProfile && guestProfile.tablemates.length > 0 ? (
          <div className="studio-inspector-note" data-tone="confirmed">
            <p>
              <span className="reception-tablemates-label">{t("Seated with")}</span> {formatTablemates(guestProfile.tablemates)}
            </p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function rsvpLabel(status: Guest["rsvpStatus"]) {
  if (status === "attending") {
    return "Attending";
  }

  if (status === "declined") {
    return "Declined";
  }

  return "Pending";
}

function guestInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTablemates(tablemates: Guest[]) {
  const firstNames = tablemates.map((guest) => guest.name.split(" ")[0]);
  const shown = firstNames.slice(0, 3).join(", ");
  const remaining = firstNames.length - 3;

  return remaining > 0 ? `${shown} +${remaining}` : shown;
}

function formatSavedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function addUniqueTag(tags: string[], tag: string) {
  return tags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase()) ? tags : [...tags, tag];
}
