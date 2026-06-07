import { Badge } from "@/components/ui/badge";
import type { RiskItem } from "@/lib/wedding-types";

type RiskListProps = {
  risks: RiskItem[];
};

export function RiskList({ risks }: RiskListProps) {
  return (
    <ul className="analysis-list">
      {risks.map((risk) => (
        <li className="analysis-item" key={risk.id}>
          <div className="summary-between">
            <p className="analysis-title">{risk.title}</p>
            <Badge tone={risk.severity}>{risk.severity}</Badge>
          </div>
          <p className="analysis-copy">{risk.description}</p>
          <p className="analysis-copy">
            <strong>Suggested fix:</strong> {risk.suggestedFix}
          </p>
        </li>
      ))}
    </ul>
  );
}
