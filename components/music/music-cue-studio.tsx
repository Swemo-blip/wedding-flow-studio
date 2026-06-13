"use client";

import { useMemo, useState } from "react";
import { CueStatusBadge } from "@/components/music/cue-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioCommand } from "@/components/ui/studio-command";
import { FlowAnalysis } from "@/components/wedding/flow-analysis";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import type { MusicCue, MusicCueStatus } from "@/lib/wedding-types";

const musicCueStatuses: MusicCueStatus[] = ["confirmed", "needs-confirmation", "needs-backup", "needs-cue"];
const musicRiskIds = ["risk-music-backup", "risk-music-start-cue", "risk-couple-entrance-confirmation"];

export function MusicCueStudio() {
  const { hasLocalProject, musicCues, resetMusicCues, timelineItems, updateMusicCue, updatedAt } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const [selectedCueId, setSelectedCueId] = useState(musicCues[0]?.id ?? "");
  const selectedCue = musicCues.find((cue) => cue.id === selectedCueId) ?? musicCues[0];
  const musicRisks = useMemo(
    () =>
      filterResolvedRisks(analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues }), resolvedRiskIds).filter((risk) =>
        musicRiskIds.includes(risk.id)
      ),
    [musicCues, resolvedRiskIds, timelineItems]
  );
  const selectedCueRisks = selectedCue ? musicRisks.filter((risk) => risk.relatedEntityId === selectedCue.id) : [];
  const saveStatus = hasLocalProject && updatedAt ? `Saved locally ${formatSavedAt(updatedAt)}` : "Autosave ready";
  const confirmedCueCount = musicCues.filter((cue) => cue.status === "confirmed").length;

  function updateSelectedCue(updates: Partial<MusicCue>) {
    if (!selectedCue) {
      return;
    }

    updateMusicCue(selectedCue.id, updates);
  }

  function applySmartCueFix() {
    if (!selectedCue) {
      return;
    }

    if (selectedCueRisks.some((risk) => risk.id === "risk-music-backup")) {
      updateSelectedCue({
        backupPlan: "DJ local file and offline ceremony playlist",
        status: selectedCue.status === "needs-backup" ? "confirmed" : selectedCue.status
      });
      return;
    }

    if (selectedCueRisks.some((risk) => risk.id === "risk-music-start-cue")) {
      updateSelectedCue({
        startCue: "Start at 0:00 on Toastmaster's nod; fade after final chorus",
        status: "confirmed"
      });
      return;
    }

    if (selectedCueRisks.some((risk) => risk.id === "risk-couple-entrance-confirmation")) {
      updateSelectedCue({
        status: "confirmed",
        notes: appendNote(selectedCue.notes, "Confirmed arrangement length and cue point for rehearsal.")
      });
    }
  }

  return (
    <div className="two-column music-cue-studio">
      <section className="page-grid">
        <StudioCommand
          actions={[
            { href: "/preview", label: "Preview Cues" },
            { label: "Reset music cues", onClick: resetMusicCues, variant: "secondary" }
          ]}
          description="Work from one active cue while backup plans, start cues, responsible people, and brief outputs stay synchronized."
          eyebrow="Music Cue Studio"
          metrics={[
            { label: "Active cue", value: selectedCue ? selectedCue.moment : "No cue selected" },
            { label: "Cue status", tone: selectedCue?.status === "confirmed" ? "confirmed" : "medium", value: selectedCue ? formatStatus(selectedCue.status) : "Not selected" },
            { label: "Confirmed", tone: confirmedCueCount === musicCues.length ? "confirmed" : "low", value: `${confirmedCueCount}/${musicCues.length}` },
            { label: "Warnings", tone: musicRisks.length > 0 ? "medium" : "confirmed", value: `${musicRisks.length}` }
          ]}
          status={{ label: saveStatus, tone: "confirmed" }}
          title="Coordinate the soundtrack as one cue sheet."
        >
          <label className="field music-cue-select">
            <span>Active cue</span>
            <select aria-label="Choose music cue" onChange={(event) => setSelectedCueId(event.target.value)} value={selectedCue?.id ?? ""}>
              {musicCues.map((cue) => (
                <option key={cue.id} value={cue.id}>
                  {cue.moment} - {cue.songTitle}
                </option>
              ))}
            </select>
          </label>
        </StudioCommand>

        {selectedCue ? (
          <>
            <div className="music-cue-board" aria-label="Music cue production board">
              <div className="music-cue-sequence">
                {musicCues.map((cue, index) => {
                  const isSelected = cue.id === selectedCue.id;
                  const hasRisk = musicRisks.some((risk) => risk.relatedEntityId === cue.id);

                  return (
                    <button
                      aria-pressed={isSelected}
                      className="music-cue-node"
                      data-risk={hasRisk}
                      data-selected={isSelected}
                      data-status={cue.status}
                      key={cue.id}
                      onClick={() => setSelectedCueId(cue.id)}
                      type="button"
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{cue.moment}</strong>
                      <small>{cue.songTitle}</small>
                    </button>
                  );
                })}
              </div>

              <Card className="music-selected-panel">
                <CardContent>
                  <div className="summary-between">
                    <div>
                      <p className="eyebrow">Selected Cue</p>
                      <h3 className="card-title">{selectedCue.songTitle}</h3>
                    </div>
                    <CueStatusBadge status={selectedCue.status} />
                  </div>
                  <div className="music-selected-grid">
                    <div>
                      <span>Moment</span>
                      <strong>{selectedCue.moment}</strong>
                      <small>{selectedCue.artist}</small>
                    </div>
                    <div>
                      <span>Responsible</span>
                      <strong>{selectedCue.responsiblePerson}</strong>
                      <small>{formatStatus(selectedCue.status)}</small>
                    </div>
                    <div>
                      <span>Start cue</span>
                      <strong>{selectedCue.startCue}</strong>
                      <small>Production trigger</small>
                    </div>
                    <div>
                      <span>Backup</span>
                      <strong>{selectedCue.backupPlan || "Missing"}</strong>
                      <small>Offline fallback</small>
                    </div>
                  </div>

                  {selectedCueRisks.length > 0 ? (
                    <div className="music-smart-fix">
                      <div>
                        <p className="eyebrow">Best Cue Fix</p>
                        <strong>{selectedCueRisks[0].title}</strong>
                        <span>{selectedCueRisks[0].suggestedFix}</span>
                      </div>
                      <Button onClick={applySmartCueFix} size="small">Apply Fix</Button>
                    </div>
                  ) : (
                    <div className="music-smart-fix" data-clear="true">
                      <div>
                        <p className="eyebrow">Cue Readiness</p>
                        <strong>This cue is ready for the production map.</strong>
                        <span>Preview, Director Mode, and Exports can use this cue without an active music warning.</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <details className="studio-detail-drawer">
              <summary>
                <span>Edit selected cue details</span>
                <strong>{selectedCue.moment}</strong>
              </summary>
              <Card className="music-cue-editor-card">
                <CardContent>
                  <div className="form-grid music-cue-form">
                    <label className="field">
                      <span>Moment</span>
                      <input onChange={(event) => updateSelectedCue({ moment: event.target.value })} value={selectedCue.moment} />
                    </label>
                    <label className="field">
                      <span>Song title</span>
                      <input onChange={(event) => updateSelectedCue({ songTitle: event.target.value })} value={selectedCue.songTitle} />
                    </label>
                    <label className="field">
                      <span>Artist or composer</span>
                      <input onChange={(event) => updateSelectedCue({ artist: event.target.value })} value={selectedCue.artist} />
                    </label>
                    <label className="field">
                      <span>Responsible person</span>
                      <input
                        onChange={(event) => updateSelectedCue({ responsiblePerson: event.target.value })}
                        value={selectedCue.responsiblePerson}
                      />
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select
                        onChange={(event) => updateSelectedCue({ status: event.target.value as MusicCueStatus })}
                        value={selectedCue.status}
                      >
                        {musicCueStatuses.map((status) => (
                          <option key={status} value={status}>
                            {formatStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Planning link</span>
                      <input onChange={(event) => updateSelectedCue({ link: event.target.value })} value={selectedCue.link} />
                    </label>
                    <label className="field music-cue-wide-field">
                      <span>Start cue</span>
                      <textarea onChange={(event) => updateSelectedCue({ startCue: event.target.value })} rows={3} value={selectedCue.startCue} />
                    </label>
                    <label className="field music-cue-wide-field">
                      <span>Backup plan</span>
                      <textarea
                        onChange={(event) => updateSelectedCue({ backupPlan: event.target.value })}
                        rows={3}
                        value={selectedCue.backupPlan}
                      />
                    </label>
                    <label className="field music-cue-wide-field">
                      <span>Production notes</span>
                      <textarea onChange={(event) => updateSelectedCue({ notes: event.target.value })} rows={4} value={selectedCue.notes} />
                    </label>
                  </div>
                </CardContent>
              </Card>
            </details>
          </>
        ) : null}
      </section>

      <aside className="page-grid">
        <FlowAnalysis risks={musicRisks} title="Music Readiness" />
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

function formatStatus(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appendNote(notes: string, note: string) {
  if (notes.includes(note)) {
    return notes;
  }

  return `${notes}\n\n${note}`;
}
