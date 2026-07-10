"use client";

import { useMemo, useState } from "react";
import { CueStatusBadge } from "@/components/music/cue-status-badge";
import { Button } from "@/components/ui/button";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import type { MusicCue, MusicCueStatus } from "@/lib/wedding-types";

const musicCueStatuses: MusicCueStatus[] = ["confirmed", "needs-confirmation", "needs-backup", "needs-cue"];
const musicRiskIds = ["risk-music-backup", "risk-music-start-cue", "risk-couple-entrance-confirmation"];

export function MusicCueStudio() {
  const { t } = useTranslation();
  const { musicCues, resetMusicCues, timelineItems, updateMusicCue } = useLocalProject();
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
    <StudioRouteFrame
      eyebrow="Music"
      primaryAction={{ href: "/preview", label: "Preview cues" }}
      title="The soundtrack of the day."
    >
      <div className="detail-studio">
        <div aria-label={t("Music cues")} className="detail-studio-list" role="tablist">
          {musicCues.map((cue, index) => {
            const isSelected = cue.id === selectedCue?.id;
            const hasRisk = musicRisks.some((risk) => risk.relatedEntityId === cue.id);

            return (
              <button
                aria-selected={isSelected}
                className="detail-studio-item"
                data-risk={hasRisk ? "true" : undefined}
                data-selected={isSelected}
                key={cue.id}
                onClick={() => setSelectedCueId(cue.id)}
                role="tab"
                type="button"
              >
                <span className="detail-studio-item-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="detail-studio-item-main">
                  <strong>{t(cue.moment)}</strong>
                  <small>{cue.songTitle}</small>
                </span>
                <span aria-hidden="true" className="detail-studio-dot" data-status={cue.status} />
              </button>
            );
          })}
        </div>

        {selectedCue ? (
          <div className="detail-studio-detail">
            <div className="detail-studio-detail-head">
              <div>
                <p className="eyebrow">{t("Selected cue")}</p>
                <h2>{selectedCue.songTitle}</h2>
                <p className="detail-studio-sub">
                  {t(selectedCue.moment)} · {selectedCue.artist}
                </p>
              </div>
              <CueStatusBadge status={selectedCue.status} />
            </div>

            <dl className="studio-inspector-list">
              <div className="studio-inspector-row">
                <dt>{t("Responsible")}</dt>
                <dd>{selectedCue.responsiblePerson}</dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Start cue")}</dt>
                <dd>{selectedCue.startCue || t("Not set")}</dd>
              </div>
              <div className="studio-inspector-row" data-tone={selectedCue.backupPlan ? undefined : "alert"}>
                <dt>{t("Backup")}</dt>
                <dd>{selectedCue.backupPlan || t("Missing")}</dd>
              </div>
            </dl>

            {selectedCueRisks.length > 0 ? (
              <div className="studio-inspector-note" data-tone="medium">
                <strong>{t(selectedCueRisks[0].title)}</strong>
                <p>{t(selectedCueRisks[0].suggestedFix)}</p>
                <Button onClick={applySmartCueFix} size="small">{t("Apply this fix")}</Button>
              </div>
            ) : (
              <div className="studio-inspector-note" data-tone="confirmed">
                <strong>{t("This cue is ready.")}</strong>
                <p>{t("Preview, Director Mode, and Exports can use this cue without an active music warning.")}</p>
              </div>
            )}

            <details className="reception-guest-details">
              <summary>
                <span>{t("Edit selected cue")}</span>
                <small>{t("Open to adjust the song, people, start cue, backup, and notes.")}</small>
              </summary>
              <div className="form-grid music-cue-form">
                <label className="field">
                  <span>{t("Moment")}</span>
                  <input onChange={(event) => updateSelectedCue({ moment: event.target.value })} value={selectedCue.moment} />
                </label>
                <label className="field">
                  <span>{t("Song title")}</span>
                  <input onChange={(event) => updateSelectedCue({ songTitle: event.target.value })} value={selectedCue.songTitle} />
                </label>
                <label className="field">
                  <span>{t("Artist or composer")}</span>
                  <input onChange={(event) => updateSelectedCue({ artist: event.target.value })} value={selectedCue.artist} />
                </label>
                <label className="field">
                  <span>{t("Responsible person")}</span>
                  <input onChange={(event) => updateSelectedCue({ responsiblePerson: event.target.value })} value={selectedCue.responsiblePerson} />
                </label>
                <label className="field">
                  <span>{t("Status")}</span>
                  <select onChange={(event) => updateSelectedCue({ status: event.target.value as MusicCueStatus })} value={selectedCue.status}>
                    {musicCueStatuses.map((status) => (
                      <option key={status} value={status}>
                        {t(formatStatus(status))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("Planning link")}</span>
                  <input onChange={(event) => updateSelectedCue({ link: event.target.value })} value={selectedCue.link} />
                </label>
                <label className="field music-cue-wide-field">
                  <span>{t("Start cue")}</span>
                  <textarea onChange={(event) => updateSelectedCue({ startCue: event.target.value })} rows={3} value={selectedCue.startCue} />
                </label>
                <label className="field music-cue-wide-field">
                  <span>{t("Backup plan")}</span>
                  <textarea onChange={(event) => updateSelectedCue({ backupPlan: event.target.value })} rows={3} value={selectedCue.backupPlan} />
                </label>
                <label className="field music-cue-wide-field">
                  <span>{t("Production notes")}</span>
                  <textarea onChange={(event) => updateSelectedCue({ notes: event.target.value })} rows={4} value={selectedCue.notes} />
                </label>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </StudioRouteFrame>
  );
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
