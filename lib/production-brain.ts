import type { ProductionAction } from "@/lib/action-engine";
import type { MomentIntelligence } from "@/lib/moment-intelligence";
import type { MomentGraphContext, WeddingGraphEdge } from "@/lib/wedding-graph";

export type ProductionBrainTone = "confirmed" | "medium" | "high";

export type ProductionBrainImpact = {
  label: string;
  before: string;
  after: string;
  tone: ProductionBrainTone;
};

export type ProductionBrainInsight = {
  headline: string;
  diagnosis: string;
  readinessLabel: string;
  readinessTone: ProductionBrainTone;
  safeToApply: boolean;
  graphSummary: string;
  whyItMatters: string[];
  affectedRoles: string[];
  affectedBriefs: Array<{
    id: string;
    title: string;
    reason: string;
  }>;
  impactPreview: ProductionBrainImpact[];
  dependencyPath: WeddingGraphEdge[];
  rehearsalGate: {
    label: string;
    detail: string;
  };
};

type ProductionBrainInput = {
  action: ProductionAction;
  context: MomentGraphContext;
  intelligence: MomentIntelligence;
  openRiskCount: number;
};

export function buildProductionBrainInsight({
  action,
  context,
  intelligence,
  openRiskCount
}: ProductionBrainInput): ProductionBrainInsight {
  const primaryRisk = context.risks[0] ?? null;
  const riskTone: ProductionBrainTone =
    primaryRisk?.severity === "high" || intelligence.readiness === "blocked"
      ? "high"
      : primaryRisk || intelligence.readiness === "review"
        ? "medium"
        : "confirmed";
  const safeToApply = action.execution === "inline";
  const impactPreview = buildImpactPreview(action, context, openRiskCount);

  return {
    affectedBriefs: buildAffectedBriefs(context),
    affectedRoles: context.roles.slice(0, 5),
    dependencyPath: context.dependencyPath,
    diagnosis: buildDiagnosis(action, context, intelligence),
    graphSummary: `${context.timelineItems.length} timeline links, ${context.roles.length} roles, ${context.exports.length} briefs, ${context.risks.length} risks`,
    headline: buildHeadline(context, intelligence),
    impactPreview,
    readinessLabel: riskTone === "high" ? "Decision needed" : riskTone === "medium" ? "Production watch" : "Ready to rehearse",
    readinessTone: riskTone,
    rehearsalGate: buildRehearsalGate(context, intelligence, impactPreview),
    safeToApply,
    whyItMatters: buildWhyItMatters(context, intelligence)
  };
}

function buildHeadline(context: MomentGraphContext, intelligence: MomentIntelligence) {
  if (intelligence.readiness === "blocked") {
    return `${context.phase.title} is blocked by connected production details.`;
  }

  if (context.risks.length > 0) {
    return `${context.phase.title} needs one focused production decision.`;
  }

  if (intelligence.missingSignals.length > 0) {
    return `${context.phase.title} is close, but the handoff still needs clarity.`;
  }

  return `${context.phase.title} is ready to rehearse.`;
}

function buildDiagnosis(action: ProductionAction, context: MomentGraphContext, intelligence: MomentIntelligence) {
  const riskText =
    context.risks.length > 0
      ? `${context.risks.length} open risk${context.risks.length === 1 ? "" : "s"}`
      : "no blocking risk";
  const briefText =
    context.exports.length > 0
      ? `${context.exports.length} connected brief${context.exports.length === 1 ? "" : "s"}`
      : "no brief dependency";

  return `${action.label} is the best next move because ${riskText}, ${briefText}, and ${intelligence.affectedRoles.length} role handoff${intelligence.affectedRoles.length === 1 ? "" : "s"} intersect here.`;
}

function buildWhyItMatters(context: MomentGraphContext, intelligence: MomentIntelligence) {
  const items = new Set<string>();

  if (context.risks[0]) {
    items.add(context.risks[0].description);
  }

  if (context.musicCues.some((cue) => cue.status !== "confirmed")) {
    items.add("A music cue is not production-ready, so the moment may feel uncertain during rehearsal.");
  }

  if (context.guests.length > 0) {
    items.add("Guest journey notes are connected to this moment, so catering, seating, or accessibility details can affect the experience.");
  }

  if (context.speeches.some((speech) => speech.isSecret)) {
    items.add("A Secret Layer is connected here, so vendor coordination must stay focused without revealing the surprise too early.");
  }

  if (intelligence.missingSignals[0]) {
    items.add(intelligence.missingSignals[0]);
  }

  if (items.size === 0) {
    items.add("The owner, location, cue, and next handoff are connected enough for rehearsal.");
  }

  return Array.from(items).slice(0, 4);
}

function buildAffectedBriefs(context: MomentGraphContext) {
  return context.exports.slice(0, 5).map((exportType) => ({
    id: exportType.id,
    title: exportType.title,
    reason:
      context.risks.some((risk) => exportType.warningIds.includes(risk.id))
        ? "Carries the connected warning"
        : "Uses the connected timeline moment"
  }));
}

function buildImpactPreview(action: ProductionAction, context: MomentGraphContext, openRiskCount: number): ProductionBrainImpact[] {
  const impacts: ProductionBrainImpact[] = [];

  if (action.riskId) {
    impacts.push({
      after: `${Math.max(0, openRiskCount - 1)} open risks after this action`,
      before: `${openRiskCount} open risks`,
      label: "Risk State",
      tone: "medium"
    });
  }

  if (action.timelineItemId || action.timelineNoteToAppend || action.timelineUpdates) {
    const item = action.timelineItemId
      ? context.timelineItems.find((timelineItem) => timelineItem.id === action.timelineItemId)
      : context.timelineItems[0];

    impacts.push({
      after: action.timelineUpdates?.durationMinutes
        ? `${action.timelineUpdates.durationMinutes} minutes with a production note`
        : "Timeline receives a production note",
      before: item ? `${item.time} - ${item.title}` : context.phase.title,
      label: "Run of Show",
      tone: "confirmed"
    });
  }

  if (action.musicCueId) {
    const cue = context.musicCues.find((musicCue) => musicCue.id === action.musicCueId);

    impacts.push({
      after: action.musicCueUpdates?.backupPlan
        ? action.musicCueUpdates.backupPlan
        : action.musicCueUpdates?.startCue ?? "Cue marked production-ready",
      before: cue ? `${cue.songTitle}: ${cue.status}` : "Connected cue needs review",
      label: "Music Cue Sheet",
      tone: "confirmed"
    });
  }

  if (action.guestId || action.guestTableId || action.guestTagToAdd) {
    const guest = action.guestId ? context.guests.find((guestItem) => guestItem.id === action.guestId) : context.guests[0];

    impacts.push({
      after: action.guestTableId
        ? `Guest moved to ${action.guestTableId}`
        : action.guestTagToAdd
          ? `Guest marked: ${action.guestTagToAdd}`
          : "Guest journey updated",
      before: guest ? `${guest.name} at ${guest.tableId}` : "Guest note needs review",
      label: "Guest Journey",
      tone: "confirmed"
    });
  }

  if (action.speechId || action.speechNoteToAppend) {
    const speech = action.speechId ? context.speeches.find((speechItem) => speechItem.id === action.speechId) : context.speeches[0];

    impacts.push({
      after: "Program note added for Director Mode",
      before: speech ? speech.title : "Secret program layer",
      label: "Program Layer",
      tone: "medium"
    });
  }

  if (action.execution === "navigate") {
    impacts.push({
      after: "Opens the right studio surface for the decision",
      before: "Decision requires human review",
      label: "Studio Path",
      tone: "medium"
    });
  }

  if (impacts.length === 0) {
    impacts.push({
      after: "The connected studio view opens with this moment in context",
      before: "Moment needs review",
      label: "Studio Path",
      tone: "medium"
    });
  }

  return impacts.slice(0, 4);
}

function buildRehearsalGate(
  context: MomentGraphContext,
  intelligence: MomentIntelligence,
  impactPreview: ProductionBrainImpact[]
) {
  if (intelligence.readiness === "blocked") {
    return {
      detail: "Resolve the connected action before this moment should be rehearsed as final.",
      label: "Not ready for final rehearsal"
    };
  }

  if (context.risks.length > 0 || impactPreview.some((impact) => impact.tone !== "confirmed")) {
    return {
      detail: "One production watch remains. Rehearse it, but keep the role owner aware.",
      label: "Rehearse with a watch note"
    };
  }

  return {
    detail: "This moment has enough connected context to move into role-ready briefs.",
    label: "Ready for rehearsal"
  };
}
