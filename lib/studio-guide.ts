import type { MomentIntelligence } from "@/lib/moment-intelligence";
import type { ProductionBrainInsight } from "@/lib/production-brain";
import type { RecoveryPlan } from "@/lib/recovery-orchestrator";
import type { RehearsalSimulation } from "@/lib/rehearsal-simulator";
import type { PreviewPhase } from "@/lib/wedding-types";

export type StudioGuidePrimaryActionKind =
  | "apply-action"
  | "run-simulation"
  | "apply-recovery"
  | "open-director"
  | "open-exports"
  | "open-studio";

export type StudioGuideStepId = "preview" | "decide" | "rehearse" | "recover" | "brief";

export type StudioGuidePrimaryAction = {
  kind: StudioGuidePrimaryActionKind;
  label: string;
  detail: string;
  href?: string;
};

export type StudioGuideStep = {
  id: StudioGuideStepId;
  label: string;
  detail: string;
  state: "done" | "current" | "next";
};

export type StudioGuide = {
  title: string;
  plainEnglish: string;
  reassurance: string;
  urgencyLabel: string;
  urgencyTone: "confirmed" | "medium" | "high";
  primaryAction: StudioGuidePrimaryAction;
  steps: StudioGuideStep[];
  focusItems: string[];
  confidenceLabel: string;
  confidenceScore: number;
};

type StudioGuideMomentEntry = {
  phase: PreviewPhase;
  phaseIndex: number;
  intelligence: MomentIntelligence;
};

type BuildStudioGuideInput = {
  actionApplied: boolean;
  entries: StudioGuideMomentEntry[];
  hasRunSimulation: boolean;
  openRiskCount: number;
  productionBrain: ProductionBrainInsight;
  readinessAverage: number;
  recoveryApplied: boolean;
  recoveryPlan: RecoveryPlan;
  rehearsalSimulation: RehearsalSimulation;
  selectedEntry: StudioGuideMomentEntry;
};

export function buildStudioGuide({
  actionApplied,
  entries,
  hasRunSimulation,
  openRiskCount,
  productionBrain,
  readinessAverage,
  recoveryApplied,
  recoveryPlan,
  rehearsalSimulation,
  selectedEntry
}: BuildStudioGuideInput): StudioGuide {
  const primaryAction = getPrimaryAction({
    actionApplied,
    hasRunSimulation,
    productionBrain,
    readinessAverage,
    recoveryApplied,
    recoveryPlan,
    rehearsalSimulation,
    selectedEntry
  });
  const currentStep = getCurrentStep(primaryAction.kind);
  const focusItems = buildFocusItems(selectedEntry, productionBrain, rehearsalSimulation, openRiskCount);
  const confidenceScore = getConfidenceScore(readinessAverage, hasRunSimulation, recoveryApplied, openRiskCount);

  return {
    confidenceLabel: getConfidenceLabel(confidenceScore),
    confidenceScore,
    focusItems,
    plainEnglish: buildPlainEnglish(selectedEntry, productionBrain, rehearsalSimulation, hasRunSimulation),
    primaryAction,
    reassurance: buildReassurance(selectedEntry, entries, openRiskCount, recoveryApplied),
    steps: buildGuideSteps(currentStep),
    title: buildGuideTitle(selectedEntry, primaryAction),
    urgencyLabel: getUrgencyLabel(selectedEntry, openRiskCount, rehearsalSimulation),
    urgencyTone: getUrgencyTone(selectedEntry, rehearsalSimulation)
  };
}

function getPrimaryAction({
  actionApplied,
  hasRunSimulation,
  productionBrain,
  readinessAverage,
  recoveryApplied,
  recoveryPlan,
  rehearsalSimulation,
  selectedEntry
}: Omit<BuildStudioGuideInput, "entries" | "openRiskCount">): StudioGuidePrimaryAction {
  const action = selectedEntry.intelligence.primaryAction;

  if (selectedEntry.intelligence.readiness === "blocked" && action.execution === "inline" && !actionApplied) {
    return {
      detail: "This removes the most important blocker before you rehearse the moment.",
      kind: "apply-action",
      label: action.label
    };
  }

  if (!hasRunSimulation) {
    return {
      detail: "Stress-test the selected moment before you trust it as day-of ready.",
      kind: "run-simulation",
      label: "Run Guided Rehearsal"
    };
  }

  if (!recoveryApplied && recoveryPlan.safeToApply && rehearsalSimulation.outcomeTone !== "confirmed") {
    return {
      detail: "Turn the rehearsal result into one connected update for roles, notes, and briefs.",
      kind: "apply-recovery",
      label: "Apply Recovery Plan"
    };
  }

  if (action.execution === "navigate" && !productionBrain.safeToApply) {
    return {
      detail: "Open the focused studio surface that can finish this decision.",
      href: action.href,
      kind: "open-studio",
      label: action.label
    };
  }

  if (readinessAverage >= 86 && rehearsalSimulation.dayFeelScore >= 78) {
    return {
      detail: "The plan is stable enough to prepare role-ready handoffs.",
      href: "/exports",
      kind: "open-exports",
      label: "Prepare Final Briefs"
    };
  }

  return {
    detail: "Give the live role board the current decision context.",
    href: "/director",
    kind: "open-director",
    label: "Open Director Mode"
  };
}

function buildGuideTitle(selectedEntry: StudioGuideMomentEntry, primaryAction: StudioGuidePrimaryAction) {
  if (primaryAction.kind === "apply-action") {
    return `Start by making ${selectedEntry.phase.title} safer.`;
  }

  if (primaryAction.kind === "run-simulation") {
    return `Rehearse ${selectedEntry.phase.title} before it becomes final.`;
  }

  if (primaryAction.kind === "apply-recovery") {
    return `Turn the rehearsal into a calm recovery plan.`;
  }

  if (primaryAction.kind === "open-exports") {
    return "The day is ready to become clear role briefs.";
  }

  return `Keep ${selectedEntry.phase.title} moving through the studio.`;
}

function buildPlainEnglish(
  selectedEntry: StudioGuideMomentEntry,
  productionBrain: ProductionBrainInsight,
  rehearsalSimulation: RehearsalSimulation,
  hasRunSimulation: boolean
) {
  if (!hasRunSimulation) {
    return `${selectedEntry.phase.title} has ${selectedEntry.intelligence.readinessScore}% readiness. The app has found the key owner, role handoff, risks, and briefs, but this moment should be rehearsed once before you rely on it.`;
  }

  return `${selectedEntry.phase.title} was stress-tested with ${rehearsalSimulation.scenario.title}. The day-feel score is ${rehearsalSimulation.dayFeelScore}%, and ${productionBrain.rehearsalGate.label.toLowerCase()}.`;
}

function buildReassurance(
  selectedEntry: StudioGuideMomentEntry,
  entries: StudioGuideMomentEntry[],
  openRiskCount: number,
  recoveryApplied: boolean
) {
  const readyCount = entries.filter((entry) => entry.intelligence.readiness === "ready").length;

  if (recoveryApplied) {
    return "Good. The recovery decision is now logged locally, so the production plan remembers what changed.";
  }

  if (openRiskCount === 0) {
    return `${readyCount} moments are ready and this plan is moving toward final briefs.`;
  }

  return `You do not need to solve the whole wedding right now. Focus on ${selectedEntry.phase.title}; the studio will keep the connected risks and roles aligned.`;
}

function buildFocusItems(
  selectedEntry: StudioGuideMomentEntry,
  productionBrain: ProductionBrainInsight,
  rehearsalSimulation: RehearsalSimulation,
  openRiskCount: number
) {
  const items = new Set<string>();

  items.add(productionBrain.whyItMatters[0] ?? selectedEntry.intelligence.summary);

  if (selectedEntry.intelligence.missingSignals[0]) {
    items.add(selectedEntry.intelligence.missingSignals[0]);
  }

  if (rehearsalSimulation.delayPropagationMinutes > 0) {
    items.add(`${rehearsalSimulation.delayPropagationMinutes} minutes could affect the next handoff without a recovery cue.`);
  }

  if (openRiskCount > 0) {
    items.add(`${openRiskCount} open production risks remain across the digital twin.`);
  }

  return Array.from(items).slice(0, 3);
}

function buildGuideSteps(currentStep: StudioGuideStepId): StudioGuideStep[] {
  const stepOrder: Array<Omit<StudioGuideStep, "state">> = [
    {
      detail: "See the moment in context.",
      id: "preview",
      label: "Preview"
    },
    {
      detail: "Choose one best move.",
      id: "decide",
      label: "Decide"
    },
    {
      detail: "Stress-test the handoff.",
      id: "rehearse",
      label: "Rehearse"
    },
    {
      detail: "Apply the recovery update.",
      id: "recover",
      label: "Recover"
    },
    {
      detail: "Send the right brief.",
      id: "brief",
      label: "Brief"
    }
  ];
  const currentIndex = stepOrder.findIndex((step) => step.id === currentStep);

  return stepOrder.map((step, index) => ({
    ...step,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "next"
  }));
}

function getCurrentStep(actionKind: StudioGuidePrimaryActionKind): StudioGuideStepId {
  if (actionKind === "apply-action" || actionKind === "open-studio") {
    return "decide";
  }

  if (actionKind === "run-simulation") {
    return "rehearse";
  }

  if (actionKind === "apply-recovery") {
    return "recover";
  }

  if (actionKind === "open-exports") {
    return "brief";
  }

  return "preview";
}

function getConfidenceScore(readinessAverage: number, hasRunSimulation: boolean, recoveryApplied: boolean, openRiskCount: number) {
  const simulationBoost = hasRunSimulation ? 6 : 0;
  const recoveryBoost = recoveryApplied ? 8 : 0;
  const riskPenalty = Math.min(18, openRiskCount * 2);

  return Math.max(5, Math.min(100, readinessAverage + simulationBoost + recoveryBoost - riskPenalty));
}

function getConfidenceLabel(score: number) {
  if (score >= 86) {
    return "Brief-ready";
  }

  if (score >= 70) {
    return "Rehearsal-ready";
  }

  if (score >= 48) {
    return "Needs one decision";
  }

  return "Needs attention";
}

function getUrgencyLabel(
  selectedEntry: StudioGuideMomentEntry,
  openRiskCount: number,
  rehearsalSimulation: RehearsalSimulation
) {
  if (selectedEntry.intelligence.readiness === "blocked") {
    return "Decision needed";
  }

  if (rehearsalSimulation.outcomeTone === "high") {
    return "Recovery needed";
  }

  if (openRiskCount > 3) {
    return "Production watch";
  }

  return "Calm path";
}

function getUrgencyTone(selectedEntry: StudioGuideMomentEntry, rehearsalSimulation: RehearsalSimulation) {
  if (selectedEntry.intelligence.readiness === "blocked" || rehearsalSimulation.outcomeTone === "high") {
    return "high";
  }

  if (selectedEntry.intelligence.readiness === "review" || rehearsalSimulation.outcomeTone === "medium") {
    return "medium";
  }

  return "confirmed";
}
