import type { ProductionAction } from "@/lib/action-engine";
import type { MomentIntelligence } from "@/lib/moment-intelligence";
import type { MomentGraphContext } from "@/lib/wedding-graph";
import type { RiskSeverity, TimelineItem } from "@/lib/wedding-types";

export type RehearsalScenarioId =
  | "group-photos-run-late"
  | "speech-block-overruns"
  | "music-cue-uncertain"
  | "guest-journey-friction"
  | "rain-moves-cocktail-hour"
  | "role-handoff-overload";

export type RehearsalScenario = {
  id: RehearsalScenarioId;
  title: string;
  trigger: string;
  stressor: string;
  delayMinutes: number;
  severity: RiskSeverity;
};

export type RehearsalImpactItem = {
  label: string;
  before: string;
  after: string;
  tone: "confirmed" | "medium" | "high";
};

export type RehearsalSimulation = {
  scenario: RehearsalScenario;
  headline: string;
  summary: string;
  dayFeelScore: number;
  dayFeelLabel: string;
  outcomeTone: "confirmed" | "medium" | "high";
  delayPropagationMinutes: number;
  recoveryWindow: string;
  timelineImpact: RehearsalImpactItem[];
  roleLoad: RehearsalImpactItem[];
  cueConfidence: RehearsalImpactItem;
  guestJourneyImpact: RehearsalImpactItem;
  briefImpact: RehearsalImpactItem[];
  riskDelta: {
    before: number;
    after: number;
    label: string;
  };
  recoveryPlan: string[];
  downstreamEffects: string[];
};

type RehearsalSimulatorInput = {
  action: ProductionAction;
  context: MomentGraphContext;
  intelligence: MomentIntelligence;
  openRiskCount: number;
  scenarioId?: RehearsalScenarioId | null;
  timeline: TimelineItem[];
};

const baseScenarios: RehearsalScenario[] = [
  {
    id: "group-photos-run-late",
    title: "Group Photos Run Late",
    trigger: "Family photos need 15 more minutes than planned.",
    stressor: "Photo timing delay",
    delayMinutes: 15,
    severity: "medium"
  },
  {
    id: "speech-block-overruns",
    title: "Speech Block Overruns",
    trigger: "Speeches run longer than the dinner service buffer.",
    stressor: "Program timing drift",
    delayMinutes: 18,
    severity: "medium"
  },
  {
    id: "music-cue-uncertain",
    title: "Music Cue Is Uncertain",
    trigger: "The responsible music owner does not have a confident start cue.",
    stressor: "Cue confidence",
    delayMinutes: 6,
    severity: "medium"
  },
  {
    id: "guest-journey-friction",
    title: "Guest Journey Friction",
    trigger: "A meal, seating, accessibility, or conflict note is missed during the handoff.",
    stressor: "Guest experience",
    delayMinutes: 8,
    severity: "high"
  },
  {
    id: "rain-moves-cocktail-hour",
    title: "Rain Moves Cocktail Hour Inside",
    trigger: "The terrace plan moves indoors and affects guest flow.",
    stressor: "Venue flow change",
    delayMinutes: 12,
    severity: "medium"
  },
  {
    id: "role-handoff-overload",
    title: "Role Handoff Overload",
    trigger: "The same role owns too many adjacent production decisions.",
    stressor: "Role load",
    delayMinutes: 10,
    severity: "medium"
  }
];

export function getRehearsalScenarios(context: MomentGraphContext, intelligence: MomentIntelligence) {
  const scored = baseScenarios.map((scenario) => ({
    relevance: getScenarioRelevance(scenario, context, intelligence),
    scenario
  }));

  return scored
    .sort((left, right) => right.relevance - left.relevance)
    .map((item) => item.scenario);
}

export function simulateWeddingRehearsal({
  action,
  context,
  intelligence,
  openRiskCount,
  scenarioId,
  timeline
}: RehearsalSimulatorInput): RehearsalSimulation {
  const scenarios = getRehearsalScenarios(context, intelligence);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0] ?? baseScenarios[0];
  const startIndex = Math.max(
    0,
    timeline.findIndex((item) => context.timelineItems.some((timelineItem) => timelineItem.id === item.id))
  );
  const downstream = timeline.slice(startIndex, startIndex + 5);
  const delayPropagationMinutes = getDelayPropagationMinutes(scenario, context, intelligence);
  const cueConfidence = buildCueConfidence(scenario, context);
  const guestJourneyImpact = buildGuestJourneyImpact(scenario, context);
  const roleLoad = buildRoleLoad(scenario, context, intelligence);
  const briefImpact = buildBriefImpact(scenario, context);
  const timelineImpact = buildTimelineImpact(downstream, delayPropagationMinutes, scenario);
  const riskAfter = Math.max(0, openRiskCount - (action.execution === "inline" ? 1 : 0) + getScenarioRiskPenalty(scenario, context));
  const dayFeelScore = getDayFeelScore({
    context,
    cueConfidence,
    delayPropagationMinutes,
    guestJourneyImpact,
    intelligence,
    roleLoad,
    scenario
  });
  const outcomeTone = dayFeelScore >= 78 ? "confirmed" : dayFeelScore >= 58 ? "medium" : "high";

  return {
    briefImpact,
    cueConfidence,
    dayFeelLabel: getDayFeelLabel(dayFeelScore),
    dayFeelScore,
    delayPropagationMinutes,
    downstreamEffects: buildDownstreamEffects(scenario, context, delayPropagationMinutes),
    guestJourneyImpact,
    headline: `${scenario.title} stress-test for ${context.phase.title}`,
    outcomeTone,
    recoveryPlan: buildRecoveryPlan(scenario, action, context),
    recoveryWindow: getRecoveryWindow(delayPropagationMinutes, scenario),
    riskDelta: {
      after: riskAfter,
      before: openRiskCount,
      label: riskAfter < openRiskCount ? "Action reduces the active risk set" : "Scenario adds a production watch"
    },
    roleLoad,
    scenario,
    summary: buildSimulationSummary(scenario, context, delayPropagationMinutes, dayFeelScore),
    timelineImpact
  };
}

function getScenarioRelevance(
  scenario: RehearsalScenario,
  context: MomentGraphContext,
  intelligence: MomentIntelligence
) {
  const text = `${context.phase.title} ${context.phase.location} ${context.phase.summary}`.toLowerCase();
  let score = 1;

  if (scenario.id === "group-photos-run-late" && (text.includes("photo") || text.includes("garden"))) {
    score += 8;
  }

  if (scenario.id === "speech-block-overruns" && (text.includes("speech") || context.speeches.length > 0)) {
    score += 8;
  }

  if (scenario.id === "music-cue-uncertain" && context.musicCues.some((cue) => cue.status !== "confirmed")) {
    score += 9;
  }

  if (scenario.id === "guest-journey-friction" && (context.guests.length > 0 || text.includes("reception") || text.includes("dinner"))) {
    score += 8;
  }

  if (scenario.id === "rain-moves-cocktail-hour" && (text.includes("terrace") || text.includes("cocktail"))) {
    score += 8;
  }

  if (scenario.id === "role-handoff-overload" && intelligence.affectedRoles.length >= 3) {
    score += 7;
  }

  if (context.risks.some((risk) => risk.severity === scenario.severity)) {
    score += 2;
  }

  return score;
}

function getDelayPropagationMinutes(
  scenario: RehearsalScenario,
  context: MomentGraphContext,
  intelligence: MomentIntelligence
) {
  const riskLoad = context.risks.filter((risk) => risk.severity !== "low").length * 3;
  const roleLoad = Math.max(0, intelligence.affectedRoles.length - 2) * 2;
  const cueLoad = context.musicCues.some((cue) => cue.status !== "confirmed") ? 4 : 0;
  const guestLoad = context.guests.length > 0 ? 3 : 0;

  return Math.max(0, scenario.delayMinutes + riskLoad + roleLoad + cueLoad + guestLoad);
}

function buildTimelineImpact(
  items: TimelineItem[],
  delayMinutes: number,
  scenario: RehearsalScenario
): RehearsalImpactItem[] {
  if (items.length === 0) {
    return [
      {
        after: `${delayMinutes} minutes of uncertainty`,
        before: "No downstream timeline item is linked",
        label: "Timeline",
        tone: "medium" as const
      }
    ];
  }

  return items.slice(0, 4).map((item, index) => {
    const propagated = Math.max(0, delayMinutes - index * 4);

    return {
      after: propagated > 0 ? `Potentially starts ${propagated} minutes late` : "Absorbed by buffer",
      before: `${item.time} - ${item.title}`,
      label: index === 0 ? scenario.stressor : item.phase,
      tone: propagated > 12 ? "high" : propagated > 0 ? "medium" : "confirmed"
    };
  });
}

function buildRoleLoad(
  scenario: RehearsalScenario,
  context: MomentGraphContext,
  intelligence: MomentIntelligence
): RehearsalImpactItem[] {
  const roles = context.roles.length > 0 ? context.roles : intelligence.affectedRoles.map((role) => role.label);

  return roles.slice(0, 4).map((role, index) => {
    const load = getRoleLoadLabel(role, scenario, index);

    return {
      after: load.after,
      before: load.before,
      label: role,
      tone: load.tone
    };
  });
}

function buildCueConfidence(scenario: RehearsalScenario, context: MomentGraphContext): RehearsalImpactItem {
  const uncertainCue = context.musicCues.find((cue) => cue.status !== "confirmed");

  if (uncertainCue) {
    return {
      after: scenario.id === "music-cue-uncertain" ? "Cue must be rehearsed before export" : "Cue needs owner confirmation",
      before: `${uncertainCue.songTitle}: ${uncertainCue.status}`,
      label: "Cue Confidence",
      tone: "high"
    };
  }

  const cue = context.musicCues[0];

  return {
    after: cue ? "Cue remains stable under this scenario" : "No cue dependency detected",
    before: cue ? `${cue.songTitle}: confirmed` : "No cue linked",
    label: "Cue Confidence",
    tone: "confirmed"
  };
}

function buildGuestJourneyImpact(scenario: RehearsalScenario, context: MomentGraphContext): RehearsalImpactItem {
  const sensitiveGuest = context.guests.find(
    (guest) => guest.allergies.length > 0 || guest.accessibilityNotes.length > 0 || guest.mealChoice.toLowerCase().includes("vegan")
  );

  if (sensitiveGuest) {
    return {
      after:
        scenario.id === "guest-journey-friction"
          ? "Guest journey can break unless the role handoff is explicit"
          : "Guest note needs to stay visible in the connected brief",
      before: `${sensitiveGuest.name}: ${sensitiveGuest.mealChoice}`,
      label: "Guest Journey",
      tone: scenario.id === "guest-journey-friction" ? "high" : "medium"
    };
  }

  return {
    after: "No sensitive guest note is attached to this moment",
    before: "Guest journey stable",
    label: "Guest Journey",
    tone: "confirmed"
  };
}

function buildBriefImpact(scenario: RehearsalScenario, context: MomentGraphContext) {
  if (context.exports.length === 0) {
    return [
      {
        after: "No export brief is directly connected",
        before: "Moment has no brief dependency",
        label: "Brief Impact",
        tone: "medium" as const
      }
    ];
  }

  return context.exports.slice(0, 4).map((exportType) => ({
    after: getBriefAfterText(scenario, exportType.title),
    before: exportType.contactPerson,
    label: exportType.title,
    tone: scenario.severity === "high" ? ("high" as const) : ("medium" as const)
  }));
}

function buildRecoveryPlan(scenario: RehearsalScenario, action: ProductionAction, context: MomentGraphContext) {
  const plan = new Set<string>();

  plan.add(action.execution === "inline" ? `Apply ${action.label} before rehearsal.` : `Open ${action.label} and confirm the decision owner.`);

  if (scenario.delayMinutes > 0) {
    plan.add(`Create a ${scenario.delayMinutes}-minute recovery buffer around ${context.phase.title}.`);
  }

  if (context.roles[0]) {
    plan.add(`Give ${context.roles[0]} the verbal recovery cue.`);
  }

  if (context.exports[0]) {
    plan.add(`Update ${context.exports[0].title} after the recovery decision.`);
  }

  if (scenario.id === "rain-moves-cocktail-hour") {
    plan.add("Confirm the indoor guest route and bar position with the venue team.");
  }

  if (scenario.id === "music-cue-uncertain") {
    plan.add("Have the music owner rehearse the exact start signal twice.");
  }

  return Array.from(plan).slice(0, 5);
}

function buildDownstreamEffects(scenario: RehearsalScenario, context: MomentGraphContext, delayMinutes: number) {
  const effects = new Set<string>();

  if (delayMinutes > 0) {
    effects.add(`${delayMinutes} minutes can propagate into the next handoff if no recovery cue is assigned.`);
  }

  if (context.exports.length > 0) {
    effects.add(`${context.exports.length} export brief${context.exports.length === 1 ? "" : "s"} may need the updated recovery note.`);
  }

  if (context.roles.length > 0) {
    effects.add(`${context.roles.slice(0, 2).join(" and ")} need the same recovery instruction.`);
  }

  if (scenario.id === "guest-journey-friction") {
    effects.add("Guest-facing details become visible quickly if catering, seating, or accessibility notes are missed.");
  }

  return Array.from(effects).slice(0, 4);
}

function buildSimulationSummary(
  scenario: RehearsalScenario,
  context: MomentGraphContext,
  delayMinutes: number,
  dayFeelScore: number
) {
  return `${scenario.trigger} In this rehearsal, ${context.phase.title} creates ${delayMinutes} minutes of possible downstream pressure and leaves the day-feel score at ${dayFeelScore}%.`;
}

function getScenarioRiskPenalty(scenario: RehearsalScenario, context: MomentGraphContext) {
  if (scenario.severity === "high") {
    return context.risks.length > 0 ? 1 : 2;
  }

  return context.risks.length > 1 ? 0 : 1;
}

function getDayFeelScore({
  context,
  cueConfidence,
  delayPropagationMinutes,
  guestJourneyImpact,
  intelligence,
  roleLoad,
  scenario
}: {
  context: MomentGraphContext;
  cueConfidence: RehearsalImpactItem;
  delayPropagationMinutes: number;
  guestJourneyImpact: RehearsalImpactItem;
  intelligence: MomentIntelligence;
  roleLoad: RehearsalImpactItem[];
  scenario: RehearsalScenario;
}) {
  const riskPenalty = context.risks.reduce((total, risk) => total + (risk.severity === "high" ? 12 : risk.severity === "medium" ? 8 : 4), 0);
  const delayPenalty = Math.min(28, Math.round(delayPropagationMinutes * 0.75));
  const rolePenalty = roleLoad.filter((item) => item.tone !== "confirmed").length * 4;
  const cuePenalty = cueConfidence.tone === "high" ? 12 : cueConfidence.tone === "medium" ? 7 : 0;
  const guestPenalty = guestJourneyImpact.tone === "high" ? 12 : guestJourneyImpact.tone === "medium" ? 7 : 0;
  const scenarioPenalty = scenario.severity === "high" ? 8 : scenario.severity === "medium" ? 4 : 0;

  return Math.max(20, Math.min(96, intelligence.readinessScore + 18 - riskPenalty - delayPenalty - rolePenalty - cuePenalty - guestPenalty - scenarioPenalty));
}

function getDayFeelLabel(score: number) {
  if (score >= 78) {
    return "Calm and rehearsable";
  }

  if (score >= 58) {
    return "Manageable with a recovery cue";
  }

  return "Fragile until the recovery plan is assigned";
}

function getRecoveryWindow(delayMinutes: number, scenario: RehearsalScenario) {
  if (delayMinutes <= 6) {
    return "Recover inside the current handoff.";
  }

  if (delayMinutes <= 15) {
    return `Recover with a ${scenario.delayMinutes}-minute buffer and one owner cue.`;
  }

  return "Needs a protected recovery window before the next major guest-facing moment.";
}

function getRoleLoadLabel(
  role: string,
  scenario: RehearsalScenario,
  index: number
): Pick<RehearsalImpactItem, "after" | "before" | "tone"> {
  if (scenario.id === "role-handoff-overload" && index < 2) {
    return {
      after: "Needs a delegated backup owner",
      before: "Owns multiple adjacent decisions",
      tone: "high" as const
    };
  }

  if (scenario.id === "speech-block-overruns" && role.toLowerCase().includes("toastmaster")) {
    return {
      after: "Must protect speech timing and catering pauses",
      before: "Introduces the program",
      tone: "medium" as const
    };
  }

  if (scenario.id === "guest-journey-friction" && (role.toLowerCase().includes("catering") || role.toLowerCase().includes("venue"))) {
    return {
      after: "Needs the guest note before doors open",
      before: "Owns guest-facing service",
      tone: "high" as const
    };
  }

  return {
    after: "Receives the shared recovery instruction",
    before: "Role is connected to this moment",
    tone: "medium" as const
  };
}

function getBriefAfterText(scenario: RehearsalScenario, title: string) {
  if (scenario.id === "music-cue-uncertain" && title.toLowerCase().includes("cue")) {
    return "Needs exact cue and backup confirmation";
  }

  if (scenario.id === "guest-journey-friction" && (title.toLowerCase().includes("catering") || title.toLowerCase().includes("seating"))) {
    return "Needs guest note elevated before export";
  }

  if (scenario.id === "speech-block-overruns" && title.toLowerCase().includes("toastmaster")) {
    return "Needs recovery cue for dinner service pauses";
  }

  return "Needs the recovery note if this scenario occurs";
}
