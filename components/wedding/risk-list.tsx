"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { localizeRiskDescription } from "@/lib/risk-analysis";
import type { RiskItem } from "@/lib/wedding-types";

type RiskListProps = {
  risks: RiskItem[];
};

export function RiskList({ risks }: RiskListProps) {
  const { t } = useTranslation();

  return (
    <ul className="analysis-list">
      {risks.map((risk) => (
        <li className="analysis-item" key={risk.id}>
          <div className="summary-between">
            <p className="analysis-title">{t(risk.title)}</p>
            <Badge tone={risk.severity}>{t(risk.severity)}</Badge>
          </div>
          <p className="analysis-copy">{localizeRiskDescription(t, risk)}</p>
          <p className="analysis-copy">
            <strong>{t("Suggested fix:")}</strong> {t(risk.suggestedFix)}
          </p>
        </li>
      ))}
    </ul>
  );
}
