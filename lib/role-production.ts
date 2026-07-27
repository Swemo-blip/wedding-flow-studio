import { buildRoleBriefs } from "@/lib/role-briefs";
import { getRisksByIds } from "@/lib/risk-analysis";
import { sortTimelineByTime } from "@/lib/utils";
import type {
  MusicCue,
  RiskItem,
  RoleBrief,
  RoleHandoff,
  RoleMomentCue,
  RoleProductionBoard,
  RoleProductionItem,
  RoleReadiness,
  Speech,
  TimelineItem
} from "@/lib/wedding-types";

// Every field is required on purpose. These used to default to the sample
// project, so a board could silently brief a stranger's wedding.
type RoleProductionSource = {
  timeline: TimelineItem[];
  risks: RiskItem[];
  cues: MusicCue[];
  speechItems: Speech[];
};

export function buildRoleProductionBoards({ cues, risks, speechItems, timeline }: RoleProductionSource): RoleProductionBoard[] {
  return buildRoleBriefs({ timeline, risks }).map((brief) => buildRoleProductionBoard(brief, timeline, risks, cues, speechItems));
}

function buildRoleProductionBoard(
  brief: RoleBrief,
  timeline: TimelineItem[],
  risks: RiskItem[],
  cues: MusicCue[],
  speechItems: Speech[]
): RoleProductionBoard {
  // The queue must read chronologically whatever order the ids arrive in.
  const roleTimeline = sortTimelineByTime(
    brief.momentIds.map((id) => timeline.find((item) => item.id === id)).filter((item): item is TimelineItem => Boolean(item))
  );
  const roleWarnings = getRoleWarnings(brief, roleTimeline, risks);
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
    // Where this role's day starts and what follows it, read off the couple's own
    // moments. Frozen strings used to win here ("Ceremony begins at 3:00 PM"), so
    // moving the ceremony changed the timeline and nothing else.
    startsWith: toMomentCue(productionItems[0]),
    nextUp: toMomentCue(productionItems[1]),
    readyToBrief,
    timeline: productionItems,
    handoffs,
    warnings: roleWarnings,
    checklistItems: brief.checklistItems,
    coordinateWith: brief.coordinateWith,
    copyText: ""
  };

  return {
    ...board,
    copyText: buildRoleProductionCopy(board)
  };
}

// The curated kinds for the role, plus every risk that lands on a moment this
// role actually owns. Without the second half, a warning kind no curated list
// names — a timeline overlap, a long gap — reached no board at all, and a role the
// couple named themselves would always claim to be clear.
function getRoleWarnings(brief: RoleBrief, roleTimeline: TimelineItem[], risks: RiskItem[]) {
  const roleWarnings = new Map<string, RiskItem>();

  for (const risk of getRisksByIds(brief.warningKinds, risks)) {
    roleWarnings.set(risk.id, risk);
  }

  for (const candidate of risks.filter((risk) => roleTimeline.some((item) => isRiskLinkedToTimelineItem(risk, item)))) {
    roleWarnings.set(candidate.id, candidate);
  }

  return Array.from(roleWarnings.values());
}

function toMomentCue(item: RoleProductionItem | undefined): RoleMomentCue | null {
  return item ? { title: item.title, time: item.time } : null;
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
        // An owner is often unassigned in a fresh plan, so name the gap instead of
        // trailing "Owner: ." after the location.
        detail: nextItem.owner ? `${nextItem.title} at ${nextItem.location}. Owner: ${nextItem.owner}.` : `${nextItem.title} at ${nextItem.location}. No owner named yet.`,
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
    .map((item) => `- ${item.time}: ${item.title} | ${item.location} | ${item.owner || "No owner named yet"}\n  Cue: ${item.cue}\n  Note: ${item.note}`)
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
    `Starts with: ${formatMomentCue(board.startsWith) ?? "No moment in this plan yet."}`,
    `Then: ${formatMomentCue(board.nextUp) ?? "No later moment in this plan."}`,
    "",
    "Production Queue",
    timelineText || "No moment in this plan is assigned to this role.",
    "",
    "Handoffs",
    handoffText || "No handoffs assigned.",
    "",
    "Warnings",
    warningText || "No active warnings for this role.",
    "",
    "Checklist",
    board.checklistItems.map((item) => `- ${item}`).join("\n") || "No standard day-of checks for this role.",
    "",
    "Coordinate with",
    board.coordinateWith.join(", ") || "No other role in this plan owns a moment yet."
  ].join("\n");
}

// A moment whose time the couple has not filled in keeps its title alone rather
// than borrowing a time from somewhere else.
function formatMomentCue(cue: RoleMomentCue | null) {
  if (!cue) {
    return null;
  }

  return cue.time ? `${cue.title} at ${cue.time}` : cue.title;
}
