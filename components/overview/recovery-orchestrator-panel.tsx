import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecoveryDecisionLogEntry } from "@/lib/recovery-log";
import type { RecoveryPlan } from "@/lib/recovery-orchestrator";

type RecoveryOrchestratorPanelProps = {
  appliedStatus: string | null;
  latestEntry: RecoveryDecisionLogEntry | null;
  onApply: () => void;
  plan: RecoveryPlan;
};

export function RecoveryOrchestratorPanel({
  appliedStatus,
  latestEntry,
  onApply,
  plan
}: RecoveryOrchestratorPanelProps) {
  const automaticPatchCount = plan.timelinePatches.filter((patch) => patch.applyMode === "automatic").length;

  return (
    <section className="recovery-orchestrator-panel" aria-label="Recovery Orchestrator">
      <div className="recovery-orchestrator-hero">
        <div>
          <p className="eyebrow">Recovery Orchestrator</p>
          <h3>{plan.title}</h3>
          <p>{plan.summary}</p>
        </div>
        <Badge tone={plan.safeToApply ? "confirmed" : "medium"}>
          {plan.safeToApply ? "safe to apply" : "needs review"}
        </Badge>
      </div>

      <div className="recovery-primary-action">
        <div>
          <span>One production update</span>
          <strong>{automaticPatchCount} connected local changes</strong>
          <p>Timeline, cue notes, guest handoff, role briefs, and export deltas stay aligned from one decision.</p>
        </div>
        <Button disabled={!plan.safeToApply} onClick={onApply} size="small">
          Apply Recovery Plan
        </Button>
      </div>

      <div className="recovery-patch-list">
        <span>Patch preview</span>
        {plan.timelinePatches.slice(0, 4).map((patch) => (
          <article key={patch.id}>
            <div>
              <strong>{patch.label}</strong>
              <small>{patch.targetLabel}</small>
            </div>
            <Badge tone={patch.applyMode === "automatic" ? "confirmed" : "medium"}>{patch.type}</Badge>
          </article>
        ))}
      </div>

      <div className="recovery-role-grid">
        <div>
          <span>Role dispatch</span>
          {plan.roleBriefs.slice(0, 3).map((brief) => (
            <article key={`${brief.role}-${brief.timing}`}>
              <strong>{brief.role}</strong>
              <p>{brief.instruction}</p>
              <small>
                {brief.timing} with {brief.contactHint}
              </small>
            </article>
          ))}
        </div>
        <div>
          <span>Brief delta</span>
          {plan.exportDeltas.slice(0, 3).map((delta) => (
            <article key={delta.exportId}>
              <strong>{delta.title}</strong>
              <p>{delta.add[0]}</p>
              <small>{delta.reason}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="recovery-manual-steps">
        <span>Human confirmation</span>
        <ul>
          {plan.remainingManualSteps.slice(0, 3).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>

      <div className="recovery-decision-log" data-applied={Boolean(appliedStatus)}>
        <span aria-live="polite">{appliedStatus ?? "Decision log ready"}</span>
        <strong>{latestEntry?.title ?? "No recovery plan has been applied in this browser yet."}</strong>
        <p>{latestEntry?.summary ?? plan.decisionLogLine}</p>
      </div>
    </section>
  );
}
