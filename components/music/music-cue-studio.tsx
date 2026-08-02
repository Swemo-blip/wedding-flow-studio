"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { CueStatusBadge } from "@/components/music/cue-status-badge";
import { Button } from "@/components/ui/button";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { useTranslation } from "@/lib/i18n";
import { analyzeWeddingFlow, isRiskOfKind } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import type { MusicCue, MusicCueStatus } from "@/lib/wedding-types";

const musicCueStatuses: MusicCueStatus[] = ["confirmed", "needs-confirmation", "needs-backup", "needs-cue"];
// Risk KINDS shown on this surface; ids now carry an entity suffix.
const musicRiskKinds = ["risk-music-backup", "risk-music-start-cue", "risk-cue-confirmation"];

export function MusicCueStudio() {
  const { t } = useTranslation();
  const { addMusicCue, musicCues, removeMusicCue, resetMusicCues, timelineItems, updateMusicCue, updateTimelineItems, updateWedding, wedding } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const [selectedCueId, setSelectedCueId] = useState(musicCues[0]?.id ?? "");
  const selectedCue = musicCues.find((cue) => cue.id === selectedCueId) ?? musicCues[0];
  const musicRisks = useMemo(
    () =>
      filterResolvedRisks(analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues, wedding }), resolvedRiskIds).filter((risk) =>
        musicRiskKinds.some((kind) => isRiskOfKind(risk, kind))
      ),
    [musicCues, resolvedRiskIds, timelineItems, wedding]
  );
  const selectedCueRisks = selectedCue ? musicRisks.filter((risk) => risk.relatedEntityId === selectedCue.id) : [];
  const confirmedCueCount = musicCues.filter((cue) => cue.status === "confirmed").length;

  // Cues were created with timelineItemId: "" and NO control ever wrote it, while
  // five consumers read it — Preview, the DJ brief, the Director board, the role
  // production sheet and the twin map all saw an unlinked cue and rendered
  // nothing. The couple's own song choices never left this screen. Both sides of
  // the link are written here: a moment holds one cue, a cue holds one moment, so
  // pointing a cue at a new moment must also release the old pairing.
  function linkSelectedCueToMoment(timelineItemId: string) {
    if (!selectedCue) {
      return;
    }

    updateMusicCue(selectedCue.id, { timelineItemId });
    updateTimelineItems((items) =>
      items.map((item) => {
        if (item.id === timelineItemId) {
          return { ...item, musicCueId: selectedCue.id };
        }
        // Release whichever moment used to own this cue.
        if (item.musicCueId === selectedCue.id) {
          return { ...item, musicCueId: undefined };
        }
        return item;
      })
    );
  }

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

    if (selectedCueRisks.some((risk) => isRiskOfKind(risk, "risk-music-backup"))) {
      updateSelectedCue({
        backupPlan: "DJ local file and offline ceremony playlist",
        status: selectedCue.status === "needs-backup" ? "confirmed" : selectedCue.status
      });
      return;
    }

    if (selectedCueRisks.some((risk) => isRiskOfKind(risk, "risk-music-start-cue"))) {
      updateSelectedCue({
        startCue: "Start at 0:00 on Toastmaster's nod; fade after final chorus",
        status: "confirmed"
      });
      return;
    }

    if (selectedCueRisks.some((risk) => isRiskOfKind(risk, "risk-cue-confirmation"))) {
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
      {/* The couple's own playlist, as a link they paste. No streaming integration
          and no API — the app opens what they already built where they built it. */}
      <label className="field music-playlist-field">
        <span>{t("Your playlist")}</span>
        <input
          onChange={(event) => updateWedding({ playlistUrl: event.target.value })}
          placeholder={t("Paste a Spotify or Apple Music link")}
          value={wedding.playlistUrl ?? ""}
        />
      </label>
      {(wedding.playlistUrl ?? "").trim() ? (
        <a className="button-secondary music-playlist-open" href={wedding.playlistUrl} rel="noreferrer" target="_blank">
          {t("Open the playlist")}
        </a>
      ) : null}

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
          {/* The cue list was edit-only: a couple could not add a song for a
              moment the sample never had, nor delete one they didn't want. */}
          <button className="guests-add" onClick={() => addMusicCue()} type="button">
            <Plus aria-hidden="true" size={15} />
            {t("Add cue")}
          </button>
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
              <span style={{ alignItems: "center", display: "inline-flex", gap: 8 }}>
                <CueStatusBadge status={selectedCue.status} />
                <button
                  aria-label={t("Remove cue")}
                  className="guests-remove"
                  onClick={() => {
                    const nextId = musicCues.find((cue) => cue.id !== selectedCue.id)?.id ?? "";
                    removeMusicCue(selectedCue.id);
                    setSelectedCueId(nextId);
                  }}
                  title={t("Remove cue")}
                  type="button"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </span>
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
                  <span>{t("Plays at")}</span>
                  <select onChange={(event) => linkSelectedCueToMoment(event.target.value)} value={selectedCue.timelineItemId}>
                    <option value="">{t("Not tied to a moment yet")}</option>
                    {timelineItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.time} · {t(item.title)}
                      </option>
                    ))}
                  </select>
                </label>
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
