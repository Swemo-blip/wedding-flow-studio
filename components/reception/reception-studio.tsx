"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { TableCard } from "@/components/reception/table-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioCommand } from "@/components/ui/studio-command";
import { FlowAnalysis } from "@/components/wedding/flow-analysis";
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
  const {
    assignGuestToTable,
    dinnerTables,
    guests,
    hasLocalProject,
    resetReception,
    timelineItems,
    updateGuest,
    updatedAt
  } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const [selectedGuestId, setSelectedGuestId] = useState("anna-carter");
  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? guests[0];
  const selectedTable = dinnerTables.find((table) => table.id === selectedGuest?.tableId) ?? dinnerTables[0];
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
    <div className="reception-studio page-grid">
      <StudioCommand
        actions={[
          { href: "/", label: "Open 3D Studio" },
          { href: "/exports", label: "Export Seating Plan", variant: "secondary" }
        ]}
        description="Turn seating, meal notes, service paths, speeches, accessibility, and room flow into one calm production canvas."
        eyebrow="Reception Room Digital Twin"
        metrics={[
          { label: "Tables", tone: "confirmed", value: `${dinnerTables.length}` },
          { label: "Allergy notes", tone: allergyGuestCount > 0 ? "medium" : "confirmed", value: `${allergyGuestCount}` },
          { label: "Accessibility", tone: accessibilityGuestCount > 0 ? "medium" : "confirmed", value: `${accessibilityGuestCount}` },
          { label: "Child setup", value: `${childSetupCount}` }
        ]}
        status={{ label: saveStatus, tone: "confirmed" }}
        title="Design the room around the guest journey."
      >
        <div className="module-decision-strip" aria-label="Best seating decision">
          <div>
            <span>Best seating decision</span>
            <strong>{bestReceptionRisk?.title ?? "Reception flow is ready for review."}</strong>
            <p>{bestReceptionRisk?.suggestedFix ?? "Review the room once more before exporting the seating plan and venue setup brief."}</p>
          </div>
          {bestReceptionRisk ? <Button onClick={applyGuestJourneyFix} size="small">Apply Best Fix</Button> : null}
        </div>
      </StudioCommand>

      <details className="studio-detail-drawer reception-context-drawer">
        <summary>
          <span>Reception Signals</span>
          <strong>Guest journey indicators</strong>
        </summary>
        <div className="reception-command-badges" aria-label="Reception planning signals">
          <span>{dinnerTables.length} tables</span>
          <span>{allergyGuestCount} allergy notes</span>
          <span>{accessibilityGuestCount} accessibility note</span>
          <span>{childSetupCount} child setup notes</span>
        </div>
      </details>

      <div className="sr-only" aria-live="polite">
        {saveStatus}
      </div>

      <div className="two-column">
        <div className="canvas reception-canvas" aria-label="Reception seating plan preview">
          <div className="reception-room-header">
            <div>
              <span>Rosewood Hall Ballroom</span>
              <strong>Guest Journey Canvas</strong>
            </div>
            <Badge tone={receptionRisks.length > 0 ? "medium" : "confirmed"}>
              {receptionRisks.length > 0 ? `${receptionRisks.length} signals` : "ready"}
            </Badge>
          </div>
          <div className="reception-canvas-hud" aria-hidden="true">
            <span>Entrance route</span>
            <span>Service path</span>
            <span>Dance transition</span>
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
          <div className="reception-selected-table-card" aria-label="Selected table summary">
            <span>Selected Table</span>
            <strong>{selectedTable?.name}</strong>
            <p>
              {selectedTableGuests.length}/{selectedTable?.capacity ?? 0} guests ·{" "}
              {selectedTableGuests.some((guest) => guest.allergies.length > 0) ? "allergy note attached" : "no allergy note"}
            </p>
          </div>
        </div>

        <aside className="page-grid">
          <Card className="guest-inspector-card">
            <CardContent>
              <div className="summary-between">
                <div>
                  <p className="eyebrow">Guest Inspector</p>
                  <h3 className="card-title">{selectedGuest?.name}</h3>
                </div>
                {selectedGuest?.accessibilityNotes ? <Badge tone="medium">accessibility</Badge> : null}
              </div>

              <label className="field reception-select-field">
                <span>Active guest</span>
                <select aria-label="Choose guest" onChange={(event) => setSelectedGuestId(event.target.value)} value={selectedGuest?.id ?? ""}>
                  {guests.map((guest) => (
                    <option key={guest.id} value={guest.id}>
                      {guest.name} - {guest.tableId}
                    </option>
                  ))}
                </select>
              </label>

              {selectedGuest ? (
                <>
                  <div className="selected-guest-journey" aria-label="Selected guest journey">
                    <div>
                      <span>Arrival</span>
                      <strong>{selectedGuest.accessibilityNotes ? "Needs clear route" : "Standard route"}</strong>
                    </div>
                    <div>
                      <span>Table</span>
                      <strong>{selectedTable?.name ?? "Unassigned"}</strong>
                    </div>
                    <div>
                      <span>Meal</span>
                      <strong>{selectedGuest.mealChoice}</strong>
                    </div>
                    <div>
                      <span>Notes</span>
                      <strong>{selectedGuest.allergies[0] ?? selectedGuest.tags[0] ?? "Clear"}</strong>
                    </div>
                  </div>

                  <details className="reception-guest-details">
                    <summary>
                      <span>Edit Guest Details</span>
                      <small>Open only when you need to adjust meal, tags, table, or accessibility notes.</small>
                    </summary>
                    <div className="form-grid reception-guest-form">
                      <label className="field">
                        <span>Name</span>
                        <input onChange={(event) => updateSelectedGuest({ name: event.target.value })} value={selectedGuest.name} />
                      </label>
                      <label className="field">
                        <span>Meal choice</span>
                        <input onChange={(event) => updateSelectedGuest({ mealChoice: event.target.value })} value={selectedGuest.mealChoice} />
                      </label>
                      <label className="field">
                        <span>Table</span>
                        <select onChange={(event) => assignGuestToTable(selectedGuest.id, event.target.value)} value={selectedGuest.tableId}>
                          {dinnerTables.map((table) => (
                            <option key={table.id} value={table.id}>
                              {table.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Language</span>
                        <input onChange={(event) => updateSelectedGuest({ language: event.target.value })} value={selectedGuest.language} />
                      </label>
                      <label className="field reception-wide-field">
                        <span>Allergies</span>
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
                        <span>Tags</span>
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
                        <span>Accessibility notes</span>
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
                    <p className="eyebrow">Smart Guest Fix</p>
                    <strong>{selectedGuestRisks[0].title}</strong>
                    <span>{selectedGuestRisks[0].suggestedFix}</span>
                  </div>
                  <Button onClick={applyGuestJourneyFix} size="small">Apply Guest Fix</Button>
                </div>
              ) : (
                <div className="guest-smart-fix" data-clear="true">
                  <div>
                    <p className="eyebrow">Guest Journey</p>
                    <strong>This guest is clear for the current reception plan.</strong>
                    <span>Meal, table, accessibility, and service notes are connected to the production map.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <FlowAnalysis risks={receptionRisks} title="Guest Journey Readiness" />
        </aside>
      </div>

      <details className="reception-detail-drawer">
        <summary>
          <span>Room Intelligence</span>
          <small>Open autosave, guest journey, readiness metrics, and reset controls when you need the deeper setup layer.</small>
        </summary>

        <div className="reception-detail-drawer-content">
          <div className="reception-journey-strip" aria-label="Guest journey sequence">
            {["Entrance", "Table", "Dinner", "Speeches", "Cake", "Dance Floor"].map((step, stepIndex) => (
              <div key={step}>
                <span>{String(stepIndex + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>

          <Card className="reception-console">
            <CardContent>
              <div className="summary-between">
                <div>
                  <p className="eyebrow">Guest Journey Studio</p>
                  <h3 className="card-title">Reception data autosaves in this browser.</h3>
                  <p className="card-copy">Guests, tables, meal notes, accessibility, and seating risks now feed the same digital twin.</p>
                </div>
                <div className="timeline-meta">
                  <span className="copy-status">{saveStatus}</span>
                  <Button onClick={resetReception} size="small" variant="secondary">Reset reception</Button>
                </div>
              </div>
              <div className="reception-metrics">
                <div>
                  <span>Tracked guests</span>
                  <strong>{guests.length}</strong>
                </div>
                <div>
                  <span>Tables</span>
                  <strong>{dinnerTables.length}</strong>
                </div>
                <div>
                  <span>Warnings</span>
                  <strong>{receptionRisks.length}</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
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
