"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskList } from "@/components/wedding/risk-list";
import { analyzeWeddingFlow, getRisksByIds } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import { sampleWedding } from "@/lib/wedding-data";
import type { ExportType } from "@/lib/wedding-types";

type ExportPreviewProps = {
  exportType: ExportType;
};

export function ExportPreview({ exportType }: ExportPreviewProps) {
  const [copyStatus, setCopyStatus] = useState("Ready to copy");
  const { dinnerTables, guests, hasLocalProject, musicCues, speeches, timelineItems } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const items = useMemo(
    () => getTimelineItemsByIds(timelineItems, exportType.timelineItemIds),
    [exportType.timelineItemIds, timelineItems]
  );
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
  const briefText = useMemo(
    () => buildExportBriefText(exportType, items, risks, relatedSpeeches, relatedCues, shouldShowGuestNotes ? guestNotes : []),
    [exportType, guestNotes, items, relatedCues, relatedSpeeches, risks, shouldShowGuestNotes]
  );

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopyStatus("Brief copied");
    } catch {
      setCopyStatus("Copy unavailable");
    }
  }

  return (
    <Card>
      <CardContent>
        <article className="export-sheet">
          <div className="summary-between">
            <div>
              <p className="eyebrow">Export Preview</p>
              <h3 className="card-title">{exportType.title}</h3>
              <p className="card-copy">
                {sampleWedding.coupleNames} - {sampleWedding.date}
              </p>
            </div>
            <div className="export-contact">
              <span>Contact person</span>
              <strong>{exportType.contactPerson}</strong>
              {hasLocalProject ? <em>Using local project edits</em> : null}
            </div>
          </div>
          <p className="card-copy">{exportType.description}</p>

          <div className="export-section">
            <h4>Relevant Timeline</h4>
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
              <h4>Program Notes</h4>
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
              <h4>Music Cues</h4>
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
              <h4>Guest Journey Notes</h4>
              <ul className="clean-list">
                {guestNotes.map((guest) => (
                  <li className="analysis-item" key={guest.id}>
                    <strong>{guest.name}</strong>
                    <p className="analysis-copy">
                      {guest.mealChoice}. Table: {guest.tableId}. {guest.allergies.length > 0 ? `Allergies: ${guest.allergies.join(", ")}. ` : ""}
                      {guest.accessibilityNotes || guest.tags.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {risks.length > 0 ? (
            <div className="export-section">
              <h4>Warnings</h4>
              <RiskList risks={risks} />
            </div>
          ) : null}
        </article>
        <div className="button-row no-print">
          <Button onClick={copyBrief} size="small" variant="secondary">Copy Brief</Button>
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
  guestNotes: Array<{ name: string; mealChoice: string; tableId: string; allergies: string[]; accessibilityNotes: string; tags: string[] }>
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
  const guestText = guestNotes
    .map(
      (guest) =>
        `- ${guest.name}: ${guest.mealChoice}, table ${guest.tableId}. Allergies: ${guest.allergies.join(", ") || "none"}. Notes: ${
          guest.accessibilityNotes || guest.tags.join(", ") || "none"
        }`
    )
    .join("\n");

  return [
    exportType.title,
    `${sampleWedding.coupleNames} - ${sampleWedding.date}`,
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
