import { planningSteps, type StudioPlanningStepId } from "@/lib/wedding-studio-plan";

type PlanningStepperProps = {
  activeStep: StudioPlanningStepId;
  onChange: (step: StudioPlanningStepId) => void;
};

export function PlanningStepper({ activeStep, onChange }: PlanningStepperProps) {
  return (
    <ol className="planning-stepper" aria-label="Wedding studio planning steps">
      {planningSteps.map((step, index) => (
        <li data-active={activeStep === step.id} key={step.id}>
          <button
            aria-label={step.label}
            aria-current={activeStep === step.id ? "step" : undefined}
            onClick={() => onChange(step.id)}
            type="button"
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.label}</strong>
          </button>
        </li>
      ))}
    </ol>
  );
}
