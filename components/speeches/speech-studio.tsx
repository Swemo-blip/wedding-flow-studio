"use client";

import { useMemo, useState } from "react";
import { SecretLayerBadge } from "@/components/speeches/secret-layer-badge";
import { Button } from "@/components/ui/button";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { findSpeechGuest } from "@/lib/guest-identity";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import type { Speech, Visibility } from "@/lib/wedding-types";

const speechRiskIds = ["risk-speech-length", "risk-secret-technical"];
const visibilityOptions: Visibility[] = ["everyone", "couple", "toastmaster", "planner", "vendor", "secret"];

export function SpeechStudio() {
  const { t } = useTranslation();
  const { dinnerTables, guests, resetSpeeches, speeches, timelineItems, updateSpeech } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const [selectedSpeechId, setSelectedSpeechId] = useState(speeches[0]?.id ?? "");
  const selectedSpeech = speeches.find((speech) => speech.id === selectedSpeechId) ?? speeches[0];
  // The linked timeline item owns the clock time; the speech's own `timing`
  // string is only a fallback for speeches not tied to a timeline moment, so
  // the Speeches screen can never contradict the Day Flow timeline.
  const timelineTimeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of timelineItems) {
      map.set(item.id, item.time);
    }
    return map;
  }, [timelineItems]);
  const speechTiming = (speech: Speech) => timelineTimeById.get(speech.timelineItemId) ?? speech.timing;
  const speakerGuest = selectedSpeech ? findSpeechGuest(selectedSpeech, guests) : null;
  const speakerTable = speakerGuest ? dinnerTables.find((table) => table.id === speakerGuest.tableId) ?? null : null;
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
    <StudioRouteFrame
      eyebrow="Speeches"
      primaryAction={{ href: "/director", label: "See the plan by role" }}
      title="The words of the day."
    >
      <div className="detail-studio">
        <div aria-label={t("Speeches")} className="detail-studio-list" role="tablist">
          {speeches.map((speech, index) => {
            const isSelected = speech.id === selectedSpeech?.id;
            const hasRisk = speechRisks.some((risk) => risk.relatedEntityId === speech.id || risk.relatedEntityId === "all-speeches");
            const dotStatus = hasRisk ? "needs-cue" : speech.isSecret ? "secret" : "confirmed";

            return (
              <button
                aria-selected={isSelected}
                className="detail-studio-item"
                data-risk={hasRisk ? "true" : undefined}
                data-selected={isSelected}
                key={speech.id}
                onClick={() => setSelectedSpeechId(speech.id)}
                role="tab"
                type="button"
              >
                <span className="detail-studio-item-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="detail-studio-item-main">
                  <strong>{speech.title}</strong>
                  <small>
                    {speechTiming(speech)} · {speech.durationMinutes} {t("min")} · {speech.speakerName}
                  </small>
                </span>
                <span aria-hidden="true" className="detail-studio-dot" data-status={dotStatus} />
              </button>
            );
          })}
        </div>

        {selectedSpeech ? (
          <div className="detail-studio-detail">
            <div className="detail-studio-detail-head">
              <div>
                <p className="eyebrow">{t("Selected speech")}</p>
                <h2>{selectedSpeech.title}</h2>
                <p className="detail-studio-sub">
                  {selectedSpeech.speakerName} · {speakerTable ? `${selectedSpeech.relation} · ${speakerTable.name}` : selectedSpeech.relation}
                </p>
              </div>
              <SecretLayerBadge isSecret={selectedSpeech.isSecret} />
            </div>

            <dl className="studio-inspector-list">
              <div className="studio-inspector-row">
                <dt>{t("Timing")}</dt>
                <dd>
                  {speechTiming(selectedSpeech)} · {selectedSpeech.durationMinutes} {t("minutes")}
                </dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Intro")}</dt>
                <dd>{selectedSpeech.introPerson}</dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Technical")}</dt>
                <dd>{selectedSpeech.technicalNeeds.join(", ") || t("None")}</dd>
              </div>
              <div className="studio-inspector-row">
                <dt>{t("Visibility")}</dt>
                <dd>{selectedSpeech.visibility === "secret" ? t("Director Mode only") : t(formatOption(selectedSpeech.visibility))}</dd>
              </div>
            </dl>

            {selectedSpeechRisks.length > 0 ? (
              <div className="studio-inspector-note" data-tone="medium">
                <strong>{t(selectedSpeechRisks[0].title)}</strong>
                <p>{t(selectedSpeechRisks[0].suggestedFix)}</p>
                <Button onClick={applySmartProgramFix} size="small">{t("Apply this fix")}</Button>
              </div>
            ) : (
              <div className="studio-inspector-note" data-tone="confirmed">
                <strong>{t("This speech is ready.")}</strong>
                <p>{t("Timing, visibility, technical needs, and notes are connected to the day.")}</p>
              </div>
            )}

            <details className="reception-guest-details">
              <summary>
                <span>{t("Edit selected speech")}</span>
                <small>{t("Open to adjust the speaker, visibility, technical needs, and notes.")}</small>
              </summary>
              <div className="form-grid speech-editor-form">
                <label className="field">
                  <span>{t("Title")}</span>
                  <input onChange={(event) => updateSelectedSpeech({ title: event.target.value })} value={selectedSpeech.title} />
                </label>
                <label className="field">
                  <span>{t("Speaker name")}</span>
                  <input onChange={(event) => updateSelectedSpeech({ speakerName: event.target.value })} value={selectedSpeech.speakerName} />
                </label>
                <label className="field">
                  <span>{t("Relation")}</span>
                  <input onChange={(event) => updateSelectedSpeech({ relation: event.target.value })} value={selectedSpeech.relation} />
                </label>
                <label className="field">
                  <span>{t("Timing")}</span>
                  <input readOnly value={speechTiming(selectedSpeech)} />
                  <small className="field-hint">{t("Set in the Day Flow timeline")}</small>
                </label>
                <label className="field">
                  <span>{t("Duration minutes")}</span>
                  <input
                    min={1}
                    onChange={(event) => updateSelectedSpeech({ durationMinutes: Number(event.target.value) })}
                    type="number"
                    value={selectedSpeech.durationMinutes}
                  />
                </label>
                <label className="field">
                  <span>{t("Visibility")}</span>
                  <select
                    onChange={(event) => {
                      const visibility = event.target.value as Visibility;
                      updateSelectedSpeech({ visibility, isSecret: visibility === "secret" });
                    }}
                    value={selectedSpeech.visibility}
                  >
                    {visibilityOptions.map((visibility) => (
                      <option key={visibility} value={visibility}>
                        {t(formatOption(visibility))}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("Intro person")}</span>
                  <input onChange={(event) => updateSelectedSpeech({ introPerson: event.target.value })} value={selectedSpeech.introPerson} />
                </label>
                <label className="field">
                  <span>{t("Technical needs")}</span>
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
                  <span>{t("Program notes")}</span>
                  <textarea onChange={(event) => updateSelectedSpeech({ notes: event.target.value })} rows={5} value={selectedSpeech.notes} />
                </label>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </StudioRouteFrame>
  );
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
