"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskList } from "@/components/wedding/risk-list";
import { buildGuestProfile } from "@/lib/guest-identity";
import { defaultWeddingStudioPlan } from "@/lib/wedding-studio-plan";
import { readStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import { formatWeddingDate } from "@/lib/utils";
import { analyzeWeddingFlow, getRisksByIds } from "@/lib/risk-analysis";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import type { ExportType, MomentRunState } from "@/lib/wedding-types";
import { joinDetails } from "@/lib/utils";

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
  // Select by PHASE first and fall back to the sample ids. Id-only selection meant
  // a self-built timeline matched nothing and the brief printed an empty sheet.
  const items = useMemo(() => {
    if (exportType.includesAllMoments) {
      return timelineItems;
    }
    const byId = new Set(exportType.timelineItemIds);
    const byPhase = new Set(exportType.phases ?? []);
    const matched = timelineItems.filter((item) => byId.has(item.id) || byPhase.has(item.phase));
    // Order is the timeline's own, which the store keeps chronological.
    return matched;
  }, [exportType.includesAllMoments, exportType.phases, exportType.timelineItemIds, timelineItems]);
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
          analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues, speechItems: speeches, guestItems: guests, tables: dinnerTables, wedding }),
          resolvedRiskIds
        )
      ),
    [dinnerTables, exportType.warningIds, guests, musicCues, resolvedRiskIds, speeches, timelineItems, wedding]
  );
  // Derive from the moments this brief ACTUALLY includes, not from the declared id
  // list — an all-moments brief has no list, and would otherwise print a run of
  // show with every speech and cue silently missing.
  const includedItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const relatedSpeeches = speeches.filter((speech) => includedItemIds.has(speech.timelineItemId));
  const relatedCues = musicCues.filter((cue) => includedItemIds.has(cue.timelineItemId));
  const shouldShowGuestNotes = ["catering-sheet", "reception-seating-plan", "venue-setup-brief"].includes(exportType.id);
  const guestNotes = guests.filter(
    (guest) =>
      guest.allergies.length > 0 ||
      guest.mealChoice.toLowerCase().includes("vegan") ||
      guest.mealChoice.toLowerCase().includes("child") ||
      guest.accessibilityNotes ||
      // Was `tags.some(tag => tag.includes("conflict"))`, which the day-flow action
      // engine turns into a false positive: one of the tags it writes is "seating
      // conflict resolved", so RESOLVING a conflict added the guest to the brief's
      // conflict list. `conflictGuestIds` is the typed field the risk rules read.
      guest.conflictGuestIds.length > 0
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
  const ceremonySetup = useMemo(() => readStoredWeddingStudioLayout()?.plan ?? defaultWeddingStudioPlan, []);
  const briefText = useMemo(
    () => buildExportBriefText(exportType, items, risks, relatedSpeeches, relatedCues, guestBriefRows, wedding, ceremonySetup),
    [ceremonySetup, exportType, guestBriefRows, items, relatedCues, relatedSpeeches, risks, wedding]
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
                {wedding.coupleNames} - {formatWeddingDate(wedding.date)}
              </p>
            </div>
            <div className="export-contact">
              <span>{t("Prepared by")}</span>
              <strong>{wedding.coupleNames}</strong>
              {hasLocalProject ? <em>{t("Using local project edits")}</em> : null}
            </div>
          </div>
          <p className="card-copy">{exportType.description}</p>

          {exportType.id === "venue-setup-brief" ? (
            <div className="export-section">
              <h4>{t("Ceremony Setup")}</h4>
              <p className="card-copy">
                {t(ceremonySetup.seatingLayout)} · {ceremonySetup.aisleWidthFeet} {t("ft")} {t("aisle")}
              </p>
            </div>
          ) : null}

          <div className="export-section">
            <h4>{t("Relevant Timeline")}</h4>
            {items.length === 0 ? (
              <p className="export-empty">
                {timelineItems.length === 0
                  ? t("Your timeline is empty — build the day first and this brief fills itself in.")
                  : t("No moments in your timeline belong to this brief yet.")}
              </p>
            ) : null}
            <ol className="export-timeline">
              {/* A struck moment stays on the sheet, marked. Someone holding this
                  running order needs to see that the receiving line was dropped —
                  a silent gap tells them nothing and they will ask. */}
              {items.map((item) => (
                <li data-run={item.runState ?? "planned"} key={item.id}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {joinDetails([item.location, item.responsiblePerson], " - ")}
                      {item.runState === "struck" ? ` - ${t("cut from the day")}` : ""}
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
  items: Array<{
    time: string;
    title: string;
    location: string;
    responsiblePerson: string;
    notes: string;
    runState?: MomentRunState;
  }>,
  risks: Array<{ title: string; description: string; suggestedFix: string }>,
  relatedSpeeches: Array<{ title: string; speakerName: string; durationMinutes: number; technicalNeeds: string[] }>,
  relatedCues: Array<{ moment: string; songTitle: string; artist: string; startCue: string; backupPlan: string }>,
  guestRows: GuestBriefRow[],
  wedding: { coupleNames: string; date: string },
  ceremonySetup: { seatingLayout: string; aisleWidthFeet: number }
) {
  const timelineText = items
    .map(
      (item) =>
        `- ${item.time}: ${item.title}${item.runState === "struck" ? " [CUT FROM THE DAY]" : ""} | ${joinDetails([item.location, item.responsiblePerson], " | ")}\n  Notes: ${item.notes}`
    )
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
    `${wedding.coupleNames} - ${formatWeddingDate(wedding.date)}`,
    `Prepared by: ${wedding.coupleNames}`,
    "",
    exportType.description,
    ...(exportType.id === "venue-setup-brief"
      ? [
          "",
          "Ceremony Setup",
          `- Seating layout: ${ceremonySetup.seatingLayout}`,
          `- Aisle width: ${ceremonySetup.aisleWidthFeet} ft`
        ]
      : []),
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
