import { Button } from "@/components/ui/button";
import {
  studioStepCopy,
  venueOptions,
  type StudioPlanningStepId,
  type WeddingStudioCapacity,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type StudioSummaryProps = {
  activeStep: StudioPlanningStepId;
  capacity: WeddingStudioCapacity;
  plan: WeddingStudioPlan;
};

type DecisionPanel = {
  ctaHref: string;
  ctaLabel: string;
  note: string;
  recommendation: string;
  status: string;
};

export function StudioSummary({ activeStep, capacity, plan }: StudioSummaryProps) {
  const activeCopy = studioStepCopy[activeStep];
  const decision = getDecisionPanel(activeStep, capacity, plan);
  const readiness = getReadinessScore(activeStep, capacity, plan);
  const venueLabel = venueOptions.find((option) => option.value === plan.venueType)?.label ?? "Venue";

  return (
    <aside className="wedding-studio-panel studio-summary-panel studio-health-panel" aria-label="Wedding readiness and recommendations">
      <div className="studio-panel-header">
        <span>Next Move</span>
        <h2>{decision.recommendation}</h2>
      </div>

      <section className="studio-next-decision studio-primary-decision" aria-label="Recommended next decision">
        <span>{decision.status}</span>
        <p>{decision.note}</p>
        <Button href={decision.ctaHref} size="small">
          {decision.ctaLabel}
        </Button>
      </section>

      <dl className="studio-plan-summary studio-plan-summary-compact" aria-label="Current plan summary">
        <div>
          <dt>Venue</dt>
          <dd>{venueLabel}</dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{plan.guestCount}</dd>
        </div>
        <div>
          <dt>Style</dt>
          <dd>{plan.style}</dd>
        </div>
        <div>
          <dt>Access seats</dt>
          <dd>{plan.accessibilitySeats}</dd>
        </div>
      </dl>

      <details className="studio-side-drawer">
        <summary>
          <span>Plan intelligence</span>
          <small>{readiness}% readiness</small>
        </summary>
        <div className="studio-side-drawer-content">
          <section className="studio-readiness-card" aria-label={`Wedding readiness ${readiness}%`}>
            <div className="studio-readiness-topline">
              <span>Wedding Readiness</span>
              <strong>{readiness}%</strong>
            </div>
            <div className="studio-capacity-meter" aria-hidden="true">
              <span style={{ width: `${readiness}%` }} />
            </div>
            <p>{activeCopy.summaryTitle}</p>
          </section>

          <section className="studio-smart-recommendations" aria-label="Smart recommendations">
            <span>Smart recommendations</span>
            <ul>
              {getSmartRecommendations(capacity, plan).map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </section>

          <section className="studio-ai-panel" aria-label="AI planning assistant">
            <div>
              <span>AI Assistant</span>
              <strong>Ask for one improvement.</strong>
            </div>
            <label>
              <span className="sr-only">AI planning request</span>
              <input placeholder="Example: improve guest flow" type="text" />
            </label>
            <div className="studio-ai-actions" role="group" aria-label="AI assistant suggested actions">
              {["Optimize seating", "Improve timeline", "Check budget", "Create brief"].map((action) => (
                <button key={action} type="button">
                  {action}
                </button>
              ))}
            </div>
          </section>
        </div>
      </details>
    </aside>
  );
}

function getReadinessScore(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, plan: WeddingStudioPlan) {
  const baseByStep: Record<StudioPlanningStepId, number> = {
    budget: 68,
    ceremony: 74,
    guests: 70,
    preview: 78,
    reception: 66,
    share: 82,
    timeline: 64,
    venue: 62,
    vision: 58
  };
  const capacityPenalty = capacity.capacityStatus === "over_capacity" ? 22 : capacity.capacityStatus === "full" ? 8 : 0;
  const accessibilityBonus = plan.accessibilitySeats > 0 ? 4 : 0;

  return Math.max(32, Math.min(92, baseByStep[activeStep] + accessibilityBonus - capacityPenalty));
}

function getDecisionPanel(activeStep: StudioPlanningStepId, capacity: WeddingStudioCapacity, plan: WeddingStudioPlan): DecisionPanel {
  if (capacity.capacityStatus === "over_capacity" && (activeStep === "guests" || activeStep === "ceremony" || activeStep === "reception")) {
    return {
      ctaHref: "/reception",
      ctaLabel: "Review capacity",
      note: "The current plan is above comfortable capacity.",
      recommendation: "Reduce the list or switch to a larger layout.",
      status: "Needs attention"
    };
  }

  const panels: Record<StudioPlanningStepId, DecisionPanel> = {
    budget: {
      ctaHref: "/exports",
      ctaLabel: "Prepare brief",
      note: "The plan has enough detail to become a vendor-ready summary.",
      recommendation: "Turn priorities into a short planning brief.",
      status: "On track"
    },
    ceremony: {
      ctaHref: "/day-flow",
      ctaLabel: "Review timeline",
      note: "The ceremony layout is connected to guest density and focal placement.",
      recommendation: capacity.capacityStatus === "full" ? "Lock reserved rows before decor." : "Confirm aisle width and focal framing.",
      status: capacity.capacityLabel
    },
    guests: {
      ctaHref: "/reception",
      ctaLabel: "Open seating",
      note: "Guest density is now reflected in the visual plan.",
      recommendation: "Add guest groups and accessibility seats next.",
      status: capacity.capacityLabel
    },
    preview: {
      ctaHref: "/preview",
      ctaLabel: "Preview day",
      note: "Use the walkthrough when you want to understand how the day feels.",
      recommendation: "Preview the plan from the guest perspective.",
      status: "Ready to preview"
    },
    reception: {
      ctaHref: "/reception",
      ctaLabel: "Refine seating",
      note: "Tables, dance floor, bar, and service path are visible together.",
      recommendation: "Check table flow before assigning everyone.",
      status: "Layout visible"
    },
    share: {
      ctaHref: "/exports",
      ctaLabel: "Open exports",
      note: "Share the plan only after the timeline and guest flow are clear.",
      recommendation: "Create a planner or vendor summary.",
      status: "Ready to share"
    },
    timeline: {
      ctaHref: "/day-flow",
      ctaLabel: "Edit timeline",
      note: "Moments should stay modular so every wedding can fit the couple.",
      recommendation: "Add buffer between ceremony and dinner.",
      status: "Needs timeline review"
    },
    venue: {
      ctaHref: "/ceremony",
      ctaLabel: "Refine ceremony",
      note: "The venue model defines the planning envelope.",
      recommendation: "Choose the venue type before adjusting zones.",
      status: "Model selected"
    },
    vision: {
      ctaHref: "/preview",
      ctaLabel: "Preview plan",
      note: "The first visual model is ready. Tune style, venue feel, and guest density before deeper planning.",
      recommendation: "Preview the day from this first studio model.",
      status: "Studio ready"
    }
  };

  return panels[activeStep];
}

function getSmartRecommendations(capacity: WeddingStudioCapacity, plan: WeddingStudioPlan) {
  const recommendations = [
    `This layout comfortably seats ${capacity.totalCapacity} guests.`,
    plan.accessibilitySeats > 0
      ? "Keep accessibility seats near the entrance and aisle."
      : "Add accessibility seats if guests need shorter routes.",
    "Reserve front-row seats before finalizing ceremony decor."
  ];

  if (capacity.capacityStatus === "full") {
    recommendations[0] = "The layout is close to full. Keep arrival and aisle flow precise.";
  }

  if (capacity.capacityStatus === "over_capacity") {
    recommendations[0] = "The plan is over capacity. Switch venue model or reduce guest count.";
  }

  return recommendations;
}
