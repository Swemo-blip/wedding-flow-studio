"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { ReceptionSeating3D } from "@/components/reception/reception-seating-3d";
import { TableCard } from "@/components/reception/table-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioSceneSurface } from "@/components/ui/studio-scene-surface";
import { FlowAnalysis } from "@/components/wedding/flow-analysis";
import { buildGuestProfile } from "@/lib/guest-identity";
import { useTranslation } from "@/lib/i18n";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import { venueLayout } from "@/lib/wedding-data";
import type { DinnerTable, Guest } from "@/lib/wedding-types";

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
  const childSetupCount = guests.filter((guest) => guest.tags.some((tag) => tag.toLowerCase().includes("child"))).length;
  const selectedTableGuests = selectedTable
    ? selectedTable.assignedGuestIds.map((guestId) => guests.find((guest) => guest.id === guestId)).filter((guest): guest is Guest => Boolean(guest))
    : [];

  function updateSelectedGuest(updates: Partial<Guest>) {
    if (!selectedGuest) {
      return;
    }

    updateGuest(selectedGuest.id, updates);
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
    <StudioRouteFrame
      description="See your guests at their tables, then sort seating, meals and accessibility."
      eyebrow="Reception studio"
      meta={[
        { label: "Tables", value: `${dinnerTables.length}` },
        { label: "Allergies", value: `${allergyGuestCount}` },
        { label: "To review", value: `${receptionRisks.length}` }
      ]}
      primaryAction={{ href: "/", label: "Open 3D Studio" }}
      secondaryAction={{ href: "/exports", label: "Export Seating" }}
      title="Design the reception room."
    >
      <div className="reception-studio page-grid">
        <section className="module-decision-strip studio-route-decision-strip" aria-label={t("Next seating decision")}>
          <div>
            <span>{t("Next seating decision")}</span>
            <strong>{bestReceptionRisk ? t(bestReceptionRisk.title) : t("Seating looks ready to review.")}</strong>
            <p>{bestReceptionRisk ? t(bestReceptionRisk.suggestedFix) : t("Review the room once more before exporting the seating plan and venue setup brief.")}</p>
          </div>
          {bestReceptionRisk ? <Button onClick={applyGuestJourneyFix} size="small">{t("Apply this fix")}</Button> : null}
        </section>

      <details className="studio-detail-drawer reception-context-drawer">
        <summary>
          <span>{t("Reception Signals")}</span>
          <strong>{saveStatus}</strong>
        </summary>
        <div className="reception-command-badges" aria-label={t("Reception Signals")}>
          <span>{dinnerTables.length} {t("tables")}</span>
          <span>{allergyGuestCount} {t("allergy notes")}</span>
          <span>{accessibilityGuestCount} {t("accessibility notes")}</span>
          <span>{childSetupCount} {t("child setup notes")}</span>
        </div>
      </details>

      <div className="sr-only" aria-live="polite">
        {saveStatus}
      </div>

      <StudioSceneSurface
        aside={
          <div className="reception-scene-side">
            <Card className="guest-inspector-card">
              <CardContent>
                <div className="summary-between">
                  <div>
                    <p className="eyebrow">{t("Guest Identity")}</p>
                    <h3 className="card-title">{selectedGuest?.name}</h3>
                    {guestProfile ? (
                      <p className="reception-guest-relation">
                        {guestProfile.relationToCouple} · {t(rsvpLabel(guestProfile.rsvpStatus))}
                      </p>
                    ) : null}
                  </div>
                  {guestProfile?.isSpeaker ? (
                    <span className="reception-state-line" data-tone="confirmed">{t("Speaking")}</span>
                  ) : selectedGuest?.accessibilityNotes ? (
                    <span className="reception-state-line" data-tone="medium">{t("accessibility")}</span>
                  ) : null}
                </div>

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

              {selectedGuest ? (
                <>
                  <div className="selected-guest-journey" aria-label={t("Guest identity")}>
                    <div>
                      <span>{t("Seat")}</span>
                      <strong>{guestProfile?.table ? guestProfile.seatLabel : t("Unassigned")}</strong>
                    </div>
                    <div>
                      <span>{t("Meal")}</span>
                      <strong>{selectedGuest.mealChoice}</strong>
                    </div>
                    <div>
                      <span>{t("Speech")}</span>
                      <strong>
                        {guestProfile?.speech
                          ? `${guestProfile.speech.title} · ${guestProfile.speech.timing}`
                          : t("Not speaking")}
                      </strong>
                    </div>
                    <div data-tone={guestProfile?.hasAllergies ? "alert" : undefined}>
                      <span>{t("Allergies")}</span>
                      <strong>{guestProfile?.hasAllergies ? guestProfile.allergies.join(", ") : t("None")}</strong>
                    </div>
                  </div>

                  {guestProfile && guestProfile.tablemates.length > 0 ? (
                    <p className="reception-tablemates">
                      <span>{t("Seated with")}</span>
                      {formatTablemates(guestProfile.tablemates)}
                    </p>
                  ) : null}

                  <details className="reception-guest-details">
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
                        <input
                          onChange={(event) => updateSelectedGuest({ relationship: event.target.value })}
                          value={selectedGuest.relationship}
                        />
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
                </>
              ) : null}

              {selectedGuestRisks.length > 0 ? (
                <div className="guest-smart-fix">
                  <div>
                    <p className="eyebrow">{t("Suggested fix")}</p>
                    <strong>{t(selectedGuestRisks[0].title)}</strong>
                    <span>{t(selectedGuestRisks[0].suggestedFix)}</span>
                  </div>
                  <Button onClick={applyGuestJourneyFix} size="small">{t("Apply this fix")}</Button>
                </div>
              ) : (
                <div className="guest-smart-fix" data-clear="true">
                  <div>
                    <p className="eyebrow">{t("Guest Journey")}</p>
                    <strong>{t("This guest is clear for the current reception plan.")}</strong>
                    <span>{t("Meal, table, accessibility, and service notes are connected to the production map.")}</span>
                  </div>
                </div>
              )}
              </CardContent>
            </Card>

            <details className="studio-detail-drawer reception-readiness-drawer">
              <summary>
                <span>{t("Readiness signals")}</span>
                <strong>{receptionRisks.length > 0 ? `${receptionRisks.length} ${t("signals")}` : t("Ready")}</strong>
              </summary>
              <FlowAnalysis risks={receptionRisks} title="Guest Journey Readiness" />
            </details>
          </div>
        }
        description={`${selectedTable?.name} selected. ${selectedTableGuests.length}/${selectedTable?.capacity ?? 0} seats assigned for this table.`}
        eyebrow="Rosewood Hall Ballroom"
        title="Reception room scene"
      >
        <div className="reception-view-toggle" role="group" aria-label={t("Seating view")}>
          <button aria-pressed={seatingView === "plan"} data-active={seatingView === "plan"} onClick={() => setSeatingView("plan")} type="button">
            {t("2D plan")}
          </button>
          <button aria-pressed={seatingView === "3d"} data-active={seatingView === "3d"} onClick={() => setSeatingView("3d")} type="button">
            {t("3D seating")}
          </button>
        </div>
        {seatingView === "3d" ? (
          <ReceptionSeating3D guests={guests} onSelectGuest={setSelectedGuestId} selectedGuestId={selectedGuest?.id ?? ""} tables={dinnerTables} />
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
              onSelect={(tableId) => {
                const firstGuestAtTable = guests.find((guest) => guest.tableId === tableId);
                if (firstGuestAtTable) {
                  setSelectedGuestId(firstGuestAtTable.id);
                }
              }}
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
      </StudioSceneSurface>

      <details className="reception-detail-drawer">
        <summary>
          <span>{t("Room Intelligence")}</span>
          <small>{t("Open autosave, guest journey, readiness metrics, and reset controls when you need the deeper setup layer.")}</small>
        </summary>

        <div className="reception-detail-drawer-content">
          <div className="reception-journey-strip" aria-label={t("Guest journey sequence")}>
            {["Entrance", "Table", "Dinner", "Speeches", "Cake", "Dance Floor"].map((step, stepIndex) => (
              <div key={step}>
                <span>{String(stepIndex + 1).padStart(2, "0")}</span>
                <strong>{t(step)}</strong>
              </div>
            ))}
          </div>

          <Card className="reception-console">
            <CardContent>
              <div className="summary-between">
                <div>
                  <p className="eyebrow">{t("Guest Journey Studio")}</p>
                  <h3 className="card-title">{t("Reception data autosaves in this browser.")}</h3>
                  <p className="card-copy">{t("Guests, tables, meal notes, accessibility, and seating risks now feed the same digital twin.")}</p>
                </div>
                <div className="timeline-meta">
                  <span className="copy-status">{saveStatus}</span>
                  <Button onClick={resetReception} size="small" variant="secondary">{t("Reset reception")}</Button>
                </div>
              </div>
              <div className="reception-metrics">
                <div>
                  <span>{t("Tracked guests")}</span>
                  <strong>{guests.length}</strong>
                </div>
                <div>
                  <span>{t("Tables")}</span>
                  <strong>{dinnerTables.length}</strong>
                </div>
                <div>
                  <span>{t("Warnings")}</span>
                  <strong>{receptionRisks.length}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </details>
      </div>
    </StudioRouteFrame>
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
