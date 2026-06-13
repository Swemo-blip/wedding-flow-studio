"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canApplyProductionAction, type ProductionAction } from "@/lib/action-engine";
import { useTranslation } from "@/lib/i18n";

type ActionDockProps = {
  action: ProductionAction;
  emphasis?: "primary" | "secondary";
  onApply?: (action: ProductionAction) => void;
  status?: string | null;
};

export function ActionDock({ action, emphasis = "primary", onApply, status }: ActionDockProps) {
  const { t } = useTranslation();
  const canApply = canApplyProductionAction(action) && Boolean(onApply);

  return (
    <Card className="action-dock-card">
      <CardContent>
        <div className="summary-between">
          <div>
            <p className="eyebrow">{t("Quick action")}</p>
            <h3 className="card-title">{t(action.label)}</h3>
          </div>
          <Badge tone={action.execution === "inline" ? "confirmed" : "neutral"}>{formatScope(action.scope)}</Badge>
        </div>
        <p className="card-copy">{t(action.detail)}</p>
        <div className="action-dock-meta">
          <span>{action.execution === "inline" ? t("Applies right here") : t("Opens the right view")}</span>
          {action.riskId ? <strong>{action.riskId}</strong> : <strong>{t("moment action")}</strong>}
        </div>
        {canApply ? (
          <Button onClick={() => onApply?.(action)} size="small" variant={emphasis}>
            {t("Apply Action")}
          </Button>
        ) : (
          <Button href={action.href} size="small" variant={emphasis}>
            {t("Open Action")}
          </Button>
        )}
        <span aria-live="polite" className="copy-status">
          {status ?? (canApply ? t("Ready to apply inside the local wedding plan.") : t("Opens the connected studio view."))}
        </span>
      </CardContent>
    </Card>
  );
}

function formatScope(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
