import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MomentIntelligence } from "@/lib/moment-intelligence";

type MomentInspectorProps = {
  intelligence: MomentIntelligence;
};

export function MomentInspector({ intelligence }: MomentInspectorProps) {
  return (
    <section className="moment-inspector" aria-label={`${intelligence.title} intelligence`}>
      <div className="moment-inspector-hero">
        <div>
          <p className="eyebrow">Moment Intelligence</p>
          <h3>{intelligence.title}</h3>
          <p>{intelligence.summary}</p>
        </div>
        <div className="moment-readiness-card">
          <div className="summary-between">
            <span>Readiness</span>
            <Badge tone={intelligence.readinessTone}>{intelligence.readiness}</Badge>
          </div>
          <strong>{intelligence.readinessLabel}</strong>
          <Progress label={`${intelligence.title} readiness`} value={intelligence.readinessScore} />
        </div>
      </div>

      <div className="moment-inspector-grid">
        <div className="moment-primary-action">
          <p className="eyebrow">One Best Next Action</p>
          <h4>{intelligence.primaryAction.label}</h4>
          <p>{intelligence.primaryAction.detail}</p>
          <Button href={intelligence.primaryAction.href} size="small">
            {intelligence.primaryAction.label}
          </Button>
        </div>

        <div className="moment-intel-card">
          <div className="summary-between">
            <span>Missing Signals</span>
            <Badge tone={intelligence.missingSignals.length > 0 ? "medium" : "confirmed"}>
              {intelligence.missingSignals.length}
            </Badge>
          </div>
          <ul>
            {(intelligence.missingSignals.length > 0
              ? intelligence.missingSignals
              : ["No missing signals are blocking this moment."]
            ).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="moment-intel-card">
          <div className="summary-between">
            <span>Affected Roles</span>
            <Badge>{intelligence.affectedRoles.length}</Badge>
          </div>
          <ul>
            {intelligence.affectedRoles.map((role) => (
              <li key={role.id}>
                <strong>{role.label}</strong>
                {role.detail}
              </li>
            ))}
          </ul>
        </div>

        <div className="moment-intel-card">
          <div className="summary-between">
            <span>Affected Briefs</span>
            <Badge>{intelligence.affectedExports.length}</Badge>
          </div>
          <ul>
            {(intelligence.affectedExports.length > 0
              ? intelligence.affectedExports
              : [{ id: "no-brief", label: "No brief impact yet", detail: "This moment does not currently change a role brief." }]
            ).map((exportType) => (
              <li key={exportType.id}>
                <strong>{exportType.label}</strong>
                {exportType.detail}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="moment-impact-row">
        <div className="moment-guest-card" data-level={intelligence.guestImpact.level}>
          <div className="summary-between">
            <span>Guest Journey Impact</span>
            <Badge tone={intelligence.guestImpact.level === "sensitive" ? "high" : intelligence.guestImpact.level === "moderate" ? "medium" : "confirmed"}>
              {intelligence.guestImpact.level}
            </Badge>
          </div>
          <strong>{intelligence.guestImpact.label}</strong>
          <ul>
            {intelligence.guestImpact.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>

        <div className="moment-handoff-card">
          <span>Vendor Handoff</span>
          <strong>
            {intelligence.vendorHandoff.from} to {intelligence.vendorHandoff.to}
          </strong>
          <p>{intelligence.vendorHandoff.instruction}</p>
        </div>
      </div>

      <div className="moment-bottom-grid">
        <div className="moment-intel-card">
          <span>Rehearsal Notes</span>
          <ol>
            {intelligence.rehearsalNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        </div>

        <div className="moment-intel-card">
          <span>What Could Go Wrong</span>
          <ol>
            {intelligence.failureModes.map((mode) => (
              <li key={mode}>{mode}</li>
            ))}
          </ol>
        </div>

        <div className="moment-intel-card">
          <span>Decision Queue</span>
          <ol>
            {intelligence.decisionQueue.map((decision) => (
              <li key={decision}>{decision}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
