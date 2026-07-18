import { buildRoleBriefs } from "@/lib/role-briefs";
import { analyzeWeddingFlow, getRisksByIds } from "@/lib/risk-analysis";
import { musicCues, speeches, timelineItems } from "@/lib/wedding-data";
import type {
  MusicCue,
  RiskItem,
  RoleBrief,
  RoleHandoff,
  RoleProductionBoard,
  RoleProductionItem,
  RoleReadiness,
  Speech,
  TimelineItem
} from "@/lib/wedding-types";

type RoleProductionSource = {
  cues?: MusicCue[];
  speechItems?: Speech[];
  timeline?: TimelineItem[];
  risks?: RiskItem[];
};

export function buildRoleProductionBoards(source: RoleProductionSource = {}) {
  const cues = source.cues ?? musicCues;
  const speechItems = source.speechItems ?? speeches;
  const timeline = source.timeline ?? timelineItems;
  const risks = source.risks ?? analyzeWeddingFlow({ timeline, cues, speechItems });

  return buildRoleBriefs().map((brief) => buildRoleProductionBoard(brief, timeline, risks, cues, speechItems));
}

export function buildRoleProductionBoard(
  brief: RoleBrief,
  timeline: TimelineItem[],
  risks: RiskItem[],
  cues: MusicCue[] = musicCues,
  speechItems: Speech[] = speeches
): RoleProductionBoard {
  const roleWarnings = getRisksByIds(brief.relevantWarningIds, risks);
  const roleTimeline = brief.relevantTimelineItemIds
    .map((id) => timeline.find((item) => item.id === id))
    .filter((item): item is TimelineItem => Boolean(item));
  const productionItems = roleTimeline.map((item) => buildProductionItem(item, roleWarnings, cues, speechItems));
  const readiness = getReadiness(roleWarnings);
  const readyToBrief = roleWarnings.length === 0;
  const handoffs = buildHandoffs(brief, productionItems, roleWarnings);

  const board: RoleProductionBoard = {
    role: brief.role,
    title: brief.title,
    description: brief.description,
    readiness,
    readinessLabel: getReadinessLabel(readiness, roleWarnings.length),
    currentPhase: brief.currentPriority ?? productionItems[0]?.title ?? "Review role flow",
    nextUp: brief.nextUp ?? productionItems[0]?.title ?? "No role-specific item",
    readyToBrief,
    timeline: productionItems,
    handoffs,
    warnings: roleWarnings,
    checklistItems: brief.checklistItems,
    contacts: [brief.contactPerson, ...(brief.keyContacts ?? [])],
    copyText: ""
  };

  return {
    ...board,
    copyText: buildRoleProductionCopy(board)
  };
}

function buildProductionItem(item: TimelineItem, roleWarnings: RiskItem[], cues: MusicCue[], speechItems: Speech[]): RoleProductionItem {
  const cue = item.musicCueId ? cues.find((musicCue) => musicCue.id === item.musicCueId) : null;
  const speech = item.speechId ? speechItems.find((speechItem) => speechItem.id === item.speechId) : null;
  const matchingWarning = roleWarnings.find((risk) => isRiskLinkedToTimelineItem(risk, item));

  return {
    id: item.id,
    time: item.time,
    title: item.title,
    phase: item.phase,
    location: item.location,
    owner: item.responsiblePerson,
    cue: cue ? `${cue.songTitle} - ${cue.startCue}` : speech ? `${speech.title} - ${speech.durationMinutes} minutes` : item.responsibleRole,
    note: item.notes,
    isSecret: item.visibility === "secret" || Boolean(speech?.isSecret),
    hasWarning: Boolean(matchingWarning)
  };
}

function buildHandoffs(brief: RoleBrief, items: RoleProductionItem[], warnings: RiskItem[]): RoleHandoff[] {
  const warningHandoffs = warnings.slice(0, 3).map((risk) => ({
    id: risk.id,
    label: "Needs attention",
    from: "Flow Analysis",
    to: brief.title,
    timing: findTimingForRisk(risk, items),
    detail: risk.suggestedFix,
    severity: risk.severity
  }));

  const nextItem = items[0];
  const operationalHandoff: RoleHandoff | null = nextItem
    ? {
        id: `${brief.role}-${nextItem.id}-handoff`,
        label: "Next handoff",
        from: "Wedding Flow Studio",
        to: brief.title,
        timing: nextItem.time,
        detail: `${nextItem.title} at ${nextItem.location}. Owner: ${nextItem.owner}.`,
        severity: "clear"
      }
    : null;

  return operationalHandoff ? [operationalHandoff, ...warningHandoffs] : warningHandoffs;
}

function getReadiness(warnings: RiskItem[]): RoleReadiness {
  if (warnings.some((warning) => warning.severity === "high")) {
    return "critical";
  }

  if (warnings.length > 0) {
    return "attention";
  }

  return "ready";
}

function getReadinessLabel(readiness: RoleReadiness, warningCount: number) {
  if (readiness === "critical") {
    return `${warningCount} priority items`;
  }

  if (readiness === "attention") {
    return `${warningCount} items to review`;
  }

  return "Ready to brief";
}

function isRiskLinkedToTimelineItem(risk: RiskItem, item: TimelineItem) {
  if (risk.relatedEntityType === "timeline" && risk.relatedEntityId === item.id) {
    return true;
  }

  if (risk.relatedEntityType === "musicCue" && item.musicCueId === risk.relatedEntityId) {
    return true;
  }

  if (risk.relatedEntityType === "speech" && (item.speechId === risk.relatedEntityId || risk.relatedEntityId === "all-speeches")) {
    return item.phase.toLowerCase().includes("speech");
  }

  return false;
}

function findTimingForRisk(risk: RiskItem, items: RoleProductionItem[]) {
  const matchingItem = items.find((item) => {
    if (risk.relatedEntityType === "timeline") {
      return item.id === risk.relatedEntityId;
    }

    return item.hasWarning;
  });

  return matchingItem?.time ?? "Before handoff";
}

function buildRoleProductionCopy(board: RoleProductionBoard) {
  const timelineText = board.timeline
    .map((item) => `- ${item.time}: ${item.title} | ${item.location} | ${item.owner}\n  Cue: ${item.cue}\n  Note: ${item.note}`)
    .join("\n");
  const warningText = board.warnings
    .map((warning) => `- ${warning.title} ${warning.description} Suggested fix: ${warning.suggestedFix}`)
    .join("\n");
  const handoffText = board.handoffs
    .map((handoff) => `- ${handoff.timing}: ${handoff.label} from ${handoff.from} to ${handoff.to}. ${handoff.detail}`)
    .join("\n");

  return [
    `${board.title} Production Brief`,
    board.description,
    "",
    `Readiness: ${board.readinessLabel}`,
    `Current phase: ${board.currentPhase}`,
    `Next up: ${board.nextUp}`,
    "",
    "Production Queue",
    timelineText || "No role-specific timeline items.",
    "",
    "Handoffs",
    handoffText || "No handoffs assigned.",
    "",
    "Warnings",
    warningText || "No active warnings for this role.",
    "",
    "Checklist",
    board.checklistItems.map((item) => `- ${item}`).join("\n"),
    "",
    "Coordinate with",
    board.contacts.join(", ")
  ].join("\n");
}
