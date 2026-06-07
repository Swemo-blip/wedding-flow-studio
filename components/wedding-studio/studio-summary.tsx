import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { studioStepCopy, venueOptions, type StudioPlanningStepId, type WeddingStudioCapacity, type WeddingStudioPlan } from "@/lib/wedding-studio-plan";

type StudioSummaryProps = {
  activeStep: StudioPlanningStepId;
  capacity: WeddingStudioCapacity;
  plan: WeddingStudioPlan;
};

type DecisionPanel = {
  ctaHref: string;
  ctaLabel: string;
  metricLabel: string;
  metricValue: string;
  note: string;
  recommendation: string;
  status: string;
};

export function StudioSummary({ activeStep, capacity, plan }: StudioSummaryProps) {
  const activeCopy = studioStepCopy[activeStep];
  const decision = getDecisionPanel(activeStep, capacity, plan);
  const tone = capacity.capacityStatus === "over_capacity" ? "high" : capacity.capacityStatus === "full" ? "medium" : "confirmed";

  return (
    <aside className="wedding-studio-panel studio-summary-panel studio-decision-panel" aria-label="Next wedding studio decision">
      <div className="studio-panel-header">
        <span>One Decision</span>
        <h2>{activeCopy.summaryTitle}</h2>
      </div>

      <div className="studio-decision-status">
        <Badge tone={tone}>{decision.status}</Badge>
        <div>
          <span>{decision.metricLabel}</span>
          <strong>{decision.metricValue}</strong>
        </div>
      </div>

      <div className="studio-next-decision">
        <span>Best next move</span>
        <strong>{decision.recommendation}</strong>
        <p>{decision.note}</p>
      </div>

      <div className="studio-summary-actions">
        <Button href={decision.ctaHref} size="small">
          {decision.ctaLabel}
        </Button>
      </div>
    </aside>
  );
}

function getDecisionPanel(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, plan: WeddingStudioPlan): DecisionPanel {
  if (capacity.capacityStatus === "over_capacity" && (activeStep === "guests" || activeStep === "ceremony" || activeStep === "reception")) {
    return {
      ctaHref: "/reception",
      ctaLabel: "Open Seating",
      metricLabel: "Overflow",
      metricValue: `${capacity.overflowGuests}`,
      note: "The current model is above comfortable capacity.",
      recommendation: "Reduce the list or plan a larger room model.",
      status: "Needs review"
    };
  }

  const tableCount = Math.min(10, Math.max(4, Math.ceil(capacity.visibleGuestMarkers / 14)));

  const panels: Record<StudioPlanningStepId, DecisionPanel> = {
    ceremony: {
      ctaHref: "/day-flow",
      ctaLabel: "Review Day Flow",
      metricLabel: "Rows",
      metricValue: `${capacity.recommendedRows}`,
      note: "The aisle and altar are ready for timing review.",
      recommendation: capacity.capacityStatus === "full" ? "Lock reserved rows before decor." : "Confirm aisle and altar framing.",
      status: capacity.capacityLabel
    },
    details: {
      ctaHref: "/exports",
      ctaLabel: "Prepare Briefs",
      metricLabel: "Style",
      metricValue: plan.style,
      note: "Turn atmosphere choices into clear vendor notes.",
      recommendation: "Confirm lighting and floral intensity.",
      status: "Ready to brief"
    },
    guests: {
      ctaHref: "/reception",
      ctaLabel: "Open Seating",
      metricLabel: "Guests",
      metricValue: `${plan.guestCount}`,
      note: "Guest density is now reflected in the 3D model.",
      recommendation: "Check density before seating assignments.",
      status: capacity.capacityLabel
    },
    reception: {
      ctaHref: "/reception",
      ctaLabel: "Open Seating",
      metricLabel: "Tables",
      metricValue: `${tableCount}`,
      note: "Dinner layout, dance floor, bar, and service path are connected.",
      recommendation: "Place tables around the service path next.",
      status: "Flow visible"
    },
    venue: {
      ctaHref: "/ceremony",
      ctaLabel: "Refine Ceremony",
      metricLabel: "Model",
      metricValue: venueOptions.find((option) => option.value === plan.venueType)?.label ?? "Venue",
      note: "The 3D scene envelope is set before adding density.",
      recommendation: "Choose the scene, then place the core objects.",
      status: "Model selected"
    }
  };

  return panels[activeStep];
}
