const workflowSteps = [
  {
    title: "Model the day",
    description: "Connect ceremony, reception, guests, cues, speeches, vendors, and risks in one local digital twin."
  },
  {
    title: "Preview the flow",
    description: "Move through the wedding day moment by moment before the real room, people, and timing collide."
  },
  {
    title: "Brief every role",
    description: "Turn the plan into focused run-of-show, cue sheet, seating, vendor, and role-specific handoffs."
  }
];

const trustSignals = [
  "No marketplace pressure or fake bookings",
  "Local MVP state with clear future backend path",
  "Built around role handoffs, exports, and production risks"
];

const faqs = [
  {
    question: "Is this a checklist app?",
    answer: "No. The core workflow is a visual wedding-day digital twin: timing, locations, people, cues, risks, vendors, and briefs connected together."
  },
  {
    question: "Does it book vendors?",
    answer: "Not yet. Vendor Intelligence helps shortlist and track sourcing decisions, while external searches verify real availability."
  },
  {
    question: "Who is it for?",
    answer: "Engaged couples, planners, venues, toastmasters, photographers, DJs, caterers, officiants, and family collaborators who need the day to feel coordinated."
  }
];

export function StudioProofPanel() {
  return (
    <section className="studio-proof-panel" aria-label="Why Wedding Flow Studio works">
      <div className="studio-proof-intro">
        <p className="eyebrow">Why it feels different</p>
        <h2>A wedding plan becomes a production-ready day.</h2>
        <p>
          Wedding Flow Studio keeps the emotional preview and the operational handoff in the same place, so the plan stays easy to understand and useful on the actual day.
        </p>
      </div>

      <div className="studio-proof-grid">
        {workflowSteps.map((step, index) => (
          <article key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step.title}</strong>
            <p>{step.description}</p>
          </article>
        ))}
      </div>

      <div className="studio-trust-row">
        {trustSignals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>

      <div className="studio-faq-grid" aria-label="Product questions">
        {faqs.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
