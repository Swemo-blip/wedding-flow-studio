import { Badge } from "@/components/ui/badge";
import type { ProductionBrainInsight } from "@/lib/production-brain";

type ProductionBrainPanelProps = {
  insight: ProductionBrainInsight;
};

export function ProductionBrainPanel({ insight }: ProductionBrainPanelProps) {
  return (
    <section className="production-brain-panel" aria-label="Production Brain impact preview">
      <div className="production-brain-header">
        <div>
          <p className="eyebrow">Production Brain</p>
          <h3>{insight.headline}</h3>
        </div>
        <Badge tone={insight.readinessTone}>{insight.readinessLabel}</Badge>
      </div>

      <p className="production-brain-diagnosis">{insight.diagnosis}</p>

      <div className="production-brain-grid">
        <div>
          <span>Graph Context</span>
          <strong>{insight.graphSummary}</strong>
        </div>
        <div>
          <span>Rehearsal Gate</span>
          <strong>{insight.rehearsalGate.label}</strong>
        </div>
      </div>

      <div className="production-brain-section">
        <span>Why it matters</span>
        <ul>
          {insight.whyItMatters.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="production-brain-section">
        <span>Impact Preview</span>
        <div className="production-impact-list">
          {insight.impactPreview.map((impact) => (
            <article className="production-impact-card" key={impact.label}>
              <div className="summary-between">
                <strong>{impact.label}</strong>
                <Badge tone={impact.tone}>{impact.tone === "confirmed" ? "updates" : "watch"}</Badge>
              </div>
              <p>
                <small>Before</small>
                {impact.before}
              </p>
              <p>
                <small>After</small>
                {impact.after}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="production-brain-footer">
        <div>
          <span>Affected roles</span>
          <div className="production-chip-row">
            {insight.affectedRoles.map((role) => (
              <Badge key={role}>{role}</Badge>
            ))}
          </div>
        </div>
        <div>
          <span>Affected briefs</span>
          <div className="production-brief-list">
            {insight.affectedBriefs.map((brief) => (
              <p key={brief.id}>
                <strong>{brief.title}</strong>
                <small>{brief.reason}</small>
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="production-path-strip">
        <span>Dependency path</span>
        {insight.dependencyPath.length > 0 ? (
          <ol>
            {insight.dependencyPath.slice(0, 4).map((edge) => (
              <li key={edge.id}>
                <strong>{edge.label}</strong>
                <small>
                  {edge.from}
                  {" -> "}
                  {edge.to}
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p>{insight.rehearsalGate.detail}</p>
        )}
      </div>
    </section>
  );
}
