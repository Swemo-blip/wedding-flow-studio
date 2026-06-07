import type { RecoveryPlan } from "@/lib/recovery-orchestrator";

export type RecoveryDecisionLogEntry = {
  id: string;
  createdAt: string;
  title: string;
  scenarioTitle: string;
  affectedRoles: string[];
  affectedBriefs: string[];
  summary: string;
};

const recoveryLogStorageKey = "wedding-flow-studio.recovery-decision-log.v1";

export function readRecoveryDecisionLog(): RecoveryDecisionLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(recoveryLogStorageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isRecoveryDecisionLogEntry) : [];
  } catch {
    return [];
  }
}

export function writeRecoveryDecisionLog(entries: RecoveryDecisionLogEntry[]) {
  if (typeof window === "undefined") {
    return entries;
  }

  window.localStorage.setItem(recoveryLogStorageKey, JSON.stringify(entries.slice(0, 20)));

  return entries;
}

export function createRecoveryDecisionLogEntry(plan: RecoveryPlan): RecoveryDecisionLogEntry {
  return {
    affectedBriefs: plan.exportDeltas.map((delta) => delta.title),
    affectedRoles: plan.roleBriefs.map((brief) => brief.role),
    createdAt: new Date().toISOString(),
    id: `${plan.id}-${Date.now()}`,
    scenarioTitle: plan.title,
    summary: plan.decisionLogLine,
    title: "Recovery plan applied"
  };
}

function isRecoveryDecisionLogEntry(value: unknown): value is RecoveryDecisionLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as RecoveryDecisionLogEntry;

  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.title === "string" &&
    typeof entry.scenarioTitle === "string" &&
    Array.isArray(entry.affectedRoles) &&
    Array.isArray(entry.affectedBriefs) &&
    typeof entry.summary === "string"
  );
}
