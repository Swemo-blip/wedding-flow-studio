"use client";

import { useMemo, useState } from "react";
import { SecretLayerBadge } from "@/components/speeches/secret-layer-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioCommand } from "@/components/ui/studio-command";
import { FlowAnalysis } from "@/components/wedding/flow-analysis";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import type { Speech, Visibility } from "@/lib/wedding-types";

const speechRiskIds = ["risk-speech-length", "risk-secret-technical"];
const visibilityOptions: Visibility[] = ["everyone", "couple", "toastmaster", "planner", "vendor", "secret"];

export function SpeechStudio() {
  const { hasLocalProject, resetSpeeches, speeches, timelineItems, updateSpeech, updatedAt } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const [selectedSpeechId, setSelectedSpeechId] = useState(speeches[0]?.id ?? "");
  const selectedSpeech = speeches.find((speech) => speech.id === selectedSpeechId) ?? speeches[0];
  const speechRisks = useMemo(
    () =>
      filterResolvedRisks(analyzeWeddingFlow({ timeline: timelineItems, speechItems: speeches }), resolvedRiskIds).filter((risk) =>
        speechRiskIds.includes(risk.id)
      ),
    [resolvedRiskIds, speeches, timelineItems]
  );
  const selectedSpeechRisks = selectedSpeech
    ? speechRisks.filter((risk) => risk.relatedEntityId === selectedSpeech.id || risk.relatedEntityId === "all-speeches")
    : [];
  const totalSpeechMinutesBeforeCake = speeches
    .filter((speech) => speech.timelineItemId !== "couple-thank-you")
    .reduce((total, speech) => total + speech.durationMinutes, 0);
  const secretCount = speeches.filter((speech) => speech.isSecret).length;
  const saveStatus = hasLocalProject && updatedAt ? `Saved locally ${formatSavedAt(updatedAt)}` : "Autosave ready";

  function updateSelectedSpeech(updates: Partial<Speech>) {
    if (!selectedSpeech) {
      return;
    }

    updateSpeech(selectedSpeech.id, updates);
  }

  function applySmartProgramFix() {
    if (selectedSpeechRisks.some((risk) => risk.id === "risk-speech-length")) {
      const durationTargets: Record<string, number> = {
        "speech-brides-father": 6,
        "speech-grooms-sister": 5,
        "speech-best-man": 5,
        "speech-friends-song": 4
      };

      speeches.forEach((speech) => {
        if (durationTargets[speech.id]) {
          updateSpeech(speech.id, {
            durationMinutes: durationTargets[speech.id],
            notes: appendNote(speech.notes, "Program fix: adjusted duration to protect dinner rhythm before cake cutting.")
          });
        }
      });
      return;
    }

    if (selectedSpeechRisks.some((risk) => risk.id === "risk-secret-technical")) {
      const secretTechnicalSpeech = speeches.find((speech) => speech.isSecret && speech.technicalNeeds.length > 0);
      if (secretTechnicalSpeech) {
        updateSpeech(secretTechnicalSpeech.id, {
          notes: appendNote(secretTechnicalSpeech.notes, "Secret technical support confirmed with Toastmaster, DJ, and venue.")
        });
      }
    }
  }

  return (
    <div className="two-column speech-studio">
      <section className="page-grid">
        <StudioCommand
          actions={[
            { href: "/director", label: "Open Director Mode" },
            { label: "Reset speeches", onClick: resetSpeeches, variant: "secondary" }
          ]}
          description="Edit one active speech at a time while Secret Layers, timing, technical needs, and Toastmaster handoffs stay connected to the day."
          eyebrow="Speech Studio"
          metrics={[
            { label: "Active speech", value: selectedSpeech?.title ?? "No speech selected" },
            { label: "Before cake", tone: totalSpeechMinutesBeforeCake > 25 ? "medium" : "confirmed", value: `${totalSpeechMinutesBeforeCake} minutes` },
            { label: "Secret layers", tone: secretCount > 0 ? "secret" : "neutral", value: `${secretCount}` },
            { label: "Warnings", tone: speechRisks.length > 0 ? "medium" : "confirmed", value: `${speechRisks.length}` }
          ]}
          status={{ label: saveStatus, tone: "confirmed" }}
          title="Shape the program without exposing surprises too early."
        >
          <label className="field speech-select-field">
            <span>Active speech</span>
            <select aria-label="Choose speech" onChange={(event) => setSelectedSpeechId(event.target.value)} value={selectedSpeech?.id ?? ""}>
              {speeches.map((speech) => (
                <option key={speech.id} value={speech.id}>
                  {speech.timing} - {speech.title}
                </option>
              ))}
            </select>
          </label>
        </StudioCommand>

        {selectedSpeech ? (
          <>
            <div className="speech-program-canvas" aria-label="Speech program canvas">
              <div className="speech-program-track">
                {speeches.map((speech, index) => {
                  const isSelected = speech.id === selectedSpeech.id;
                  const hasRisk = speechRisks.some((risk) => risk.relatedEntityId === speech.id || risk.relatedEntityId === "all-speeches");

                  return (
                    <button
                      aria-pressed={isSelected}
                      className="speech-program-node"
                      data-risk={hasRisk}
                      data-secret={speech.isSecret}
                      data-selected={isSelected}
                      key={speech.id}
                      onClick={() => setSelectedSpeechId(speech.id)}
                      type="button"
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{speech.title}</strong>
                      <small>
                        {speech.timing} · {speech.durationMinutes} minutes
                      </small>
                      <em>{speech.speakerName}</em>
                    </button>
                  );
                })}
              </div>

              <Card className="speech-selected-panel">
                <CardContent>
                  <div className="summary-between">
                    <div>
                      <p className="eyebrow">Selected Program Moment</p>
                      <h3 className="card-title">{selectedSpeech.title}</h3>
                    </div>
                    <SecretLayerBadge isSecret={selectedSpeech.isSecret} />
                  </div>
                  <div className="speech-selected-grid">
                    <div>
                      <span>Speaker</span>
                      <strong>{selectedSpeech.speakerName}</strong>
                      <small>{selectedSpeech.relation}</small>
                    </div>
                    <div>
                      <span>Timing</span>
                      <strong>{selectedSpeech.timing}</strong>
                      <small>{selectedSpeech.durationMinutes} minutes</small>
                    </div>
                    <div>
                      <span>Intro</span>
                      <strong>{selectedSpeech.introPerson}</strong>
                      <small>Toastmaster handoff</small>
                    </div>
                    <div>
                      <span>Technical</span>
                      <strong>{selectedSpeech.technicalNeeds.join(", ") || "None"}</strong>
                      <small>{selectedSpeech.visibility === "secret" ? "Director Mode only" : formatOption(selectedSpeech.visibility)}</small>
                    </div>
                  </div>
                  {selectedSpeechRisks.length > 0 ? (
                    <div className="speech-smart-fix">
                      <div>
                        <p className="eyebrow">Best Program Fix</p>
                        <strong>{selectedSpeechRisks[0].title}</strong>
                        <span>{selectedSpeechRisks[0].suggestedFix}</span>
                      </div>
                      <Button onClick={applySmartProgramFix} size="small">Apply Fix</Button>
                    </div>
                  ) : (
                    <div className="speech-smart-fix" data-clear="true">
                      <div>
                        <p className="eyebrow">Program Readiness</p>
                        <strong>This speech layer is ready for Director Mode.</strong>
                        <span>Timing, visibility, technical needs, and notes are connected to the production map.</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <details className="studio-detail-drawer">
              <summary>
                <span>Edit selected speech details</span>
                <strong>{selectedSpeech.title}</strong>
              </summary>
              <Card className="speech-editor-card">
                <CardContent>
                  <div className="form-grid speech-editor-form">
                    <label className="field">
                      <span>Title</span>
                      <input onChange={(event) => updateSelectedSpeech({ title: event.target.value })} value={selectedSpeech.title} />
                    </label>
                    <label className="field">
                      <span>Speaker name</span>
                      <input onChange={(event) => updateSelectedSpeech({ speakerName: event.target.value })} value={selectedSpeech.speakerName} />
                    </label>
                    <label className="field">
                      <span>Relation</span>
                      <input onChange={(event) => updateSelectedSpeech({ relation: event.target.value })} value={selectedSpeech.relation} />
                    </label>
                    <label className="field">
                      <span>Timing</span>
                      <input onChange={(event) => updateSelectedSpeech({ timing: event.target.value })} value={selectedSpeech.timing} />
                    </label>
                    <label className="field">
                      <span>Duration minutes</span>
                      <input
                        min={1}
                        onChange={(event) => updateSelectedSpeech({ durationMinutes: Number(event.target.value) })}
                        type="number"
                        value={selectedSpeech.durationMinutes}
                      />
                    </label>
                    <label className="field">
                      <span>Visibility</span>
                      <select
                        onChange={(event) => {
                          const visibility = event.target.value as Visibility;
                          updateSelectedSpeech({ visibility, isSecret: visibility === "secret" });
                        }}
                        value={selectedSpeech.visibility}
                      >
                        {visibilityOptions.map((visibility) => (
                          <option key={visibility} value={visibility}>
                            {formatOption(visibility)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Intro person</span>
                      <input onChange={(event) => updateSelectedSpeech({ introPerson: event.target.value })} value={selectedSpeech.introPerson} />
                    </label>
                    <label className="field">
                      <span>Technical needs</span>
                      <input
                        onChange={(event) =>
                          updateSelectedSpeech({
                            technicalNeeds: event.target.value
                              .split(",")
                              .map((need) => need.trim())
                              .filter(Boolean)
                          })
                        }
                        value={selectedSpeech.technicalNeeds.join(", ")}
                      />
                    </label>
                    <label className="field speech-wide-field">
                      <span>Program notes</span>
                      <textarea onChange={(event) => updateSelectedSpeech({ notes: event.target.value })} rows={5} value={selectedSpeech.notes} />
                    </label>
                  </div>
                </CardContent>
              </Card>
            </details>
          </>
        ) : null}
      </section>

      <aside className="page-grid">
        <FlowAnalysis risks={speechRisks} title="Speech Readiness" />
        <Card>
          <CardContent>
            <p className="eyebrow">Secret Layers</p>
            <h3 className="card-title">Surprises stay operational without becoming visible too early.</h3>
            <p className="card-copy">
              Locked items remain visible in Director Mode and exportable briefs while preserving the emotional reveal for the couple.
            </p>
            <div className="timeline-meta">
              <Badge tone="secret">{secretCount} secret layers</Badge>
              <Badge>{totalSpeechMinutesBeforeCake} minutes before cake</Badge>
            </div>
          </CardContent>
        </Card>
      </aside>
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

function formatOption(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appendNote(notes: string, note: string) {
  if (notes.includes(note)) {
    return notes;
  }

  return `${notes}\n\n${note}`;
}
