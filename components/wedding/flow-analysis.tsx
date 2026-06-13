"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import type { RiskItem } from "@/lib/wedding-types";

type FlowAnalysisProps = {
  risks: RiskItem[];
  limit?: number;
  title?: string;
};

export function FlowAnalysis({ limit = 6, risks, title = "Flow Analysis" }: FlowAnalysisProps) {
  const { t } = useTranslation();
  const visibleRisks = risks.slice(0, limit);

  return (
    <Card>
      <CardContent>
        <p className="eyebrow">{t("Find risks before they become problems")}</p>
        <h3 className="card-title">{t(title)}</h3>
        <ul className="analysis-list" style={{ marginTop: 14 }}>
          {visibleRisks.map((risk) => (
            <li className="analysis-item" key={risk.id}>
              <div className="summary-between">
                <p className="analysis-title">{t(risk.title)}</p>
                <Badge tone={risk.severity}>{t(risk.severity)}</Badge>
              </div>
              <p className="analysis-copy">{t(risk.description)}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
