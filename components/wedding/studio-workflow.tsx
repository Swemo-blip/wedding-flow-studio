import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type StudioWorkflowProps = {
  activeStep?: "flow" | "preview" | "director" | "exports";
};

const workflowSteps = [
  {
    id: "flow",
    href: "/day-flow",
    label: "Build the Day Flow",
    detail: "Edit timing, places, owners, notes, and risks."
  },
  {
    id: "preview",
    href: "/preview",
    label: "Preview Wedding Day",
    detail: "Play the day as a connected visual sequence."
  },
  {
    id: "director",
    href: "/director",
    label: "Coordinate Roles",
    detail: "Give each role exactly what they need."
  },
  {
    id: "exports",
    href: "/exports",
    label: "Send Briefs",
    detail: "Copy or print role-ready production sheets."
  }
] as const;

export function StudioWorkflow({ activeStep = "preview" }: StudioWorkflowProps) {
  const activeIndex = Math.max(0, workflowSteps.findIndex((step) => step.id === activeStep));
  const nextStep = workflowSteps[Math.min(activeIndex + 1, workflowSteps.length - 1)];
  const active = workflowSteps[activeIndex];
  const actionLabel = active.id === nextStep.id ? `Review ${active.label}` : `Continue to ${nextStep.label}`;

  return (
    <Card className="studio-workflow">
      <CardContent>
        <div className="summary-between studio-workflow-header">
          <div>
            <p className="eyebrow">Studio Workflow</p>
            <h3 className="card-title">One calm path from plan to production.</h3>
            <p className="card-copy">
              Start with the flow, preview the day, coordinate the roles, then send the briefs.
            </p>
          </div>
          <div className="studio-workflow-action">
            <Badge tone="confirmed">Current: {active.label}</Badge>
            <Button href={nextStep.href} size="small">
              {actionLabel}
            </Button>
          </div>
        </div>

        <nav aria-label="Studio workflow steps" className="studio-workflow-steps">
          {workflowSteps.map((step, index) => (
            <Link className="studio-workflow-step" data-active={step.id === activeStep} href={step.href} key={step.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </Link>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
