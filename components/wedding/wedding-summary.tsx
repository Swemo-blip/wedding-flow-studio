import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { coreTeam, sampleWedding } from "@/lib/wedding-data";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";

export function WeddingSummary() {
  const risks = analyzeWeddingFlow();
  const highRisks = risks.filter((risk) => risk.severity === "high").length;

  return (
    <Card>
      <CardContent>
        <p className="eyebrow">Wedding Project</p>
        <h3 className="card-title">{sampleWedding.coupleNames}</h3>
        <p className="card-copy">{sampleWedding.style}</p>

        <div className="summary-grid">
          <div>
            <span className="summary-label">Date</span>
            <strong>{sampleWedding.date}</strong>
          </div>
          <div>
            <span className="summary-label">Ceremony</span>
            <strong>{sampleWedding.ceremonyLocation}</strong>
          </div>
          <div>
            <span className="summary-label">Reception</span>
            <strong>{sampleWedding.receptionLocation}</strong>
          </div>
          <div>
            <span className="summary-label">Guests</span>
            <strong>{sampleWedding.guestCount}</strong>
          </div>
        </div>

        <div className="summary-progress">
          <div className="summary-between">
            <span>Planning completeness</span>
            <strong>82%</strong>
          </div>
          <Progress label="Planning completeness" value={82} />
        </div>

        <div className="summary-team">
          {coreTeam.slice(1, 6).map((member) => (
            <div key={member.role}>
              <span>{member.role}</span>
              <strong>{member.name}</strong>
            </div>
          ))}
        </div>

        <div className="summary-alert">
          <strong>{highRisks} high-priority items</strong>
          <span>Director Mode can turn these into role-specific briefs.</span>
        </div>
      </CardContent>
    </Card>
  );
}
