import { planningSteps, type StudioPlanningStepId } from "@/lib/wedding-studio-plan";

type PlanningStepperProps = {
  activeStep: StudioPlanningStepId;
  onChange: (step: StudioPlanningStepId) => void;
};

export function PlanningStepper({ activeStep, onChange }: PlanningStepperProps) {
  return (
    <ol className="planning-stepper" aria-label="Wedding studio planning steps">
      {planningSteps.map((step, index) => (
        <li data-active={activeStep === step.id} data-state={step.state} key={step.id}>
          <button
            aria-label={`${step.label}: ${step.description}`}
            aria-current={activeStep === step.id ? "step" : undefined}
            onClick={() => onChange(step.id)}
            type="button"
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.label}</strong>
            <small>{getStateLabel(step.state)}</small>
          </button>
        </li>
      ))}
    </ol>
  );
}

function getStateLabel(state: (typeof planningSteps)[number]["state"]) {
  const labels: Record<(typeof planningSteps)[number]["state"], string> = {
    complete: "Ready",
    current: "Now",
    needs_attention: "Review",
    optional: "Optional"
  };

  return labels[state];
}
