import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudioGuide } from "@/lib/studio-guide";

type StudioGuidePanelProps = {
  guide: StudioGuide;
  onApplyAction: () => void;
  onApplyRecovery: () => void;
  onRunSimulation: () => void;
};

export function StudioGuidePanel({
  guide,
  onApplyAction,
  onApplyRecovery,
  onRunSimulation
}: StudioGuidePanelProps) {
  return (
    <section className="studio-guide-panel" aria-label="Studio Guide">
      <div className="studio-guide-header">
        <div>
          <p className="eyebrow">Studio Guide</p>
          <h3>{guide.title}</h3>
          <p>{guide.plainEnglish}</p>
        </div>
        <Badge tone={guide.urgencyTone}>{guide.urgencyLabel}</Badge>
      </div>

      <div className="studio-guide-action-card">
        <div>
          <span>Best next move</span>
          <strong>{guide.primaryAction.label}</strong>
          <p>{guide.primaryAction.detail}</p>
        </div>
        {renderPrimaryAction(guide, onApplyAction, onApplyRecovery, onRunSimulation)}
      </div>

      <div className="studio-guide-steps" aria-label="Guided studio path">
        {guide.steps.map((step) => (
          <div data-state={step.state} key={step.id}>
            <span>{step.label}</span>
            <small>{step.detail}</small>
          </div>
        ))}
      </div>

      <div className="studio-guide-focus">
        <div>
          <span>Confidence</span>
          <strong>{guide.confidenceScore}%</strong>
          <small>{guide.confidenceLabel}</small>
        </div>
        <div>
          <span>What matters now</span>
          <ul>
            {guide.focusItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <p className="studio-guide-reassurance">{guide.reassurance}</p>
    </section>
  );
}

function renderPrimaryAction(
  guide: StudioGuide,
  onApplyAction: () => void,
  onApplyRecovery: () => void,
  onRunSimulation: () => void
) {
  if (guide.primaryAction.kind === "apply-action") {
    return (
      <Button onClick={onApplyAction} size="small">
        {guide.primaryAction.label}
      </Button>
    );
  }

  if (guide.primaryAction.kind === "run-simulation") {
    return (
      <Button onClick={onRunSimulation} size="small">
        {guide.primaryAction.label}
      </Button>
    );
  }

  if (guide.primaryAction.kind === "apply-recovery") {
    return (
      <Button onClick={onApplyRecovery} size="small">
        {guide.primaryAction.label}
      </Button>
    );
  }

  return (
    <Button href={guide.primaryAction.href ?? "/preview"} size="small">
      {guide.primaryAction.label}
    </Button>
  );
}
