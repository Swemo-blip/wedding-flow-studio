"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskList } from "@/components/wedding/risk-list";
import { buildGuestProfile } from "@/lib/guest-identity";
import { analyzeWeddingFlow, getRisksByIds } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import type { ExportType } from "@/lib/wedding-types";

type ExportPreviewProps = {
  exportType: ExportType;
};

type GuestBriefRow = {
  accessibility: string;
  allergies: string[];
  id: string;
  meal: string;
  name: string;
  relation: string;
  seat: string;
  speech: string;
};

export function ExportPreview({ exportType }: ExportPreviewProps) {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState(t("Ready to copy"));
  const { dinnerTables, guests, hasLocalProject, musicCues, speeches, timelineItems, wedding } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const items = useMemo(
    () => getTimelineItemsByIds(timelineItems, exportType.timelineItemIds),
    [exportType.timelineItemIds, timelineItems]
  );
  // The linked timeline item owns each speech's time, so the brief matches the
  // Speeches studio and Day Flow rather than a speech's stale `timing` string.
  const timelineTimeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of timelineItems) {
      map.set(item.id, item.time);
    }
    return map;
  }, [timelineItems]);
  const risks = useMemo(
    () =>
      getRisksByIds(
        exportType.warningIds,
        filterResolvedRisks(
          analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues, speechItems: speeches, guestItems: guests, tables: dinnerTables }),
          resolvedRiskIds
        )
      ),
    [dinnerTables, exportType.warningIds, guests, musicCues, resolvedRiskIds, speeches, timelineItems]
  );
  const relatedSpeeches = speeches.filter((speech) => exportType.timelineItemIds.includes(speech.timelineItemId));
  const relatedCues = musicCues.filter((cue) => exportType.timelineItemIds.includes(cue.timelineItemId));
  const shouldShowGuestNotes = ["catering-sheet", "reception-seating-plan", "venue-setup-brief"].includes(exportType.id);
  const guestNotes = guests.filter(
    (guest) =>
      guest.allergies.length > 0 ||
      guest.mealChoice.toLowerCase().includes("vegan") ||
      guest.mealChoice.toLowerCase().includes("child") ||
      guest.accessibilityNotes ||
      guest.tags.some((tag) => tag.toLowerCase().includes("conflict"))
  );
  // Resolve each flagged guest to one identity (seat, relation, speaking role)
  // so the brief reads the same as the seating and speech studios.
  const guestBriefRows = useMemo<GuestBriefRow[]>(
    () =>
      shouldShowGuestNotes
        ? guestNotes.map((guest) => {
            const profile = buildGuestProfile(guest, { guests, speeches, tables: dinnerTables });
            const linkedSpeech = profile.speech;
            const speechTiming = linkedSpeech ? timelineTimeById.get(linkedSpeech.timelineItemId) ?? linkedSpeech.timing : "";
            return {
              accessibility: guest.accessibilityNotes,
              allergies: guest.allergies,
              id: guest.id,
              meal: guest.mealChoice,
              name: guest.name,
              relation: profile.relationToCouple,
              seat: profile.table ? profile.seatLabel : "Unassigned",
              speech: linkedSpeech ? `${linkedSpeech.title} (${speechTiming})` : ""
            };
          })
        : [],
    [dinnerTables, guestNotes, guests, shouldShowGuestNotes, speeches, timelineTimeById]
  );
  const briefText = useMemo(
    () => buildExportBriefText(exportType, items, risks, relatedSpeeches, relatedCues, guestBriefRows, wedding),
    [exportType, guestBriefRows, items, relatedCues, relatedSpeeches, risks, wedding]
  );

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopyStatus(t("Brief copied"));
    } catch {
      setCopyStatus(t("Copy unavailable"));
    }
  }

  return (
    <Card>
      <CardContent>
        <article className="export-sheet">
          <div className="summary-between">
            <div>
              <p className="eyebrow">{t("Export Preview")}</p>
              <h3 className="card-title">{exportType.title}</h3>
              <p className="card-copy">
                {wedding.coupleNames} - {wedding.date}
              </p>
            </div>
            <div className="export-contact">
              <span>{t("Contact person")}</span>
              <strong>{exportType.contactPerson}</strong>
              {hasLocalProject ? <em>{t("Using local project edits")}</em> : null}
            </div>
          </div>
          <p className="card-copy">{exportType.description}</p>

          <div className="export-section">
            <h4>{t("Relevant Timeline")}</h4>
            <ol className="export-timeline">
              {items.map((item) => (
                <li key={item.id}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.location} - {item.responsiblePerson}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {relatedSpeeches.length > 0 ? (
            <div className="export-section">
              <h4>{t("Program Notes")}</h4>
              <ul className="clean-list">
                {relatedSpeeches.map((speech) => (
                  <li className="analysis-item" key={speech.id}>
                    <strong>{speech.title}</strong>
                    <p className="analysis-copy">
                      {speech.speakerName}, {speech.durationMinutes} minutes, {speech.technicalNeeds.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {relatedCues.length > 0 ? (
            <div className="export-section">
              <h4>{t("Music Cues")}</h4>
              <ul className="clean-list">
                {relatedCues.map((cue) => (
                  <li className="analysis-item" key={cue.id}>
                    <strong>{cue.moment}: {cue.songTitle}</strong>
                    <p className="analysis-copy">
                      Start cue: {cue.startCue}. Backup: {cue.backupPlan}.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {shouldShowGuestNotes ? (
            <div className="export-section">
              <h4>{t("Guest Journey Notes")}</h4>
              <ul className="clean-list">
                {guestBriefRows.map((row) => (
                  <li className="analysis-item" key={row.id}>
                    <strong>{row.name} · {row.relation}</strong>
                    <p className="analysis-copy">
                      {row.seat === "Unassigned" ? t("Unassigned") : row.seat} · {row.meal}
                      {row.allergies.length > 0 ? ` · ${t("Allergies")}: ${row.allergies.join(", ")}` : ""}
                      {row.speech ? ` · ${t("Speech")}: ${row.speech}` : ""}
                      {row.accessibility ? ` · ${row.accessibility}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {risks.length > 0 ? (
            <div className="export-section">
              <h4>{t("Warnings")}</h4>
              <RiskList risks={risks} />
            </div>
          ) : null}
        </article>
        <div className="button-row no-print">
          <Button onClick={copyBrief} size="small" variant="secondary">{t("Copy Brief")}</Button>
          <span aria-live="polite" className="copy-status">{copyStatus}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function buildExportBriefText(
  exportType: ExportType,
  items: Array<{ time: string; title: string; location: string; responsiblePerson: string; notes: string }>,
  risks: Array<{ title: string; description: string; suggestedFix: string }>,
  relatedSpeeches: Array<{ title: string; speakerName: string; durationMinutes: number; technicalNeeds: string[] }>,
  relatedCues: Array<{ moment: string; songTitle: string; artist: string; startCue: string; backupPlan: string }>,
  guestRows: GuestBriefRow[],
  wedding: { coupleNames: string; date: string }
) {
  const timelineText = items
    .map((item) => `- ${item.time}: ${item.title} | ${item.location} | ${item.responsiblePerson}\n  Notes: ${item.notes}`)
    .join("\n");
  const speechText = relatedSpeeches
    .map((speech) => `- ${speech.title}: ${speech.speakerName}, ${speech.durationMinutes} minutes, ${speech.technicalNeeds.join(", ")}`)
    .join("\n");
  const cueText = relatedCues
    .map((cue) => `- ${cue.moment}: ${cue.songTitle} by ${cue.artist}. Start: ${cue.startCue}. Backup: ${cue.backupPlan}.`)
    .join("\n");
  const riskText = risks
    .map((risk) => `- ${risk.title} ${risk.description} Suggested fix: ${risk.suggestedFix}`)
    .join("\n");
  const guestText = guestRows
    .map(
      (row) =>
        `- ${row.name} (${row.relation}): ${row.seat}, ${row.meal}. Allergies: ${row.allergies.join(", ") || "none"}.${
          row.speech ? ` Speaking: ${row.speech}.` : ""
        }${row.accessibility ? ` ${row.accessibility}` : ""}`
    )
    .join("\n");

  return [
    exportType.title,
    `${wedding.coupleNames} - ${wedding.date}`,
    `Contact: ${exportType.contactPerson}`,
    "",
    exportType.description,
    "",
    "Relevant Timeline",
    timelineText || "No timeline items assigned.",
    "",
    "Program Notes",
    speechText || "No speeches assigned.",
    "",
    "Music Cues",
    cueText || "No music cues assigned.",
    "",
    "Guest Journey Notes",
    guestText || "No guest notes assigned.",
    "",
    "Warnings",
    riskText || "No warnings assigned."
  ].join("\n");
}
