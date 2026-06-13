"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type CommandAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
};

type CommandMetric = {
  label: string;
  tone?: "neutral" | "low" | "medium" | "high" | "secret" | "confirmed";
  value: string;
};

type StudioCommandProps = {
  actions?: CommandAction[];
  children?: ReactNode;
  description?: string;
  eyebrow: string;
  metrics?: CommandMetric[];
  status?: {
    label: string;
    tone?: "neutral" | "low" | "medium" | "high" | "secret" | "confirmed";
  };
  title: string;
};

export function StudioCommand({ actions = [], children, eyebrow, title }: StudioCommandProps) {
  const { t } = useTranslation();
  const primaryAction = actions[0];

  return (
    <section className="studio-command" aria-label={`${eyebrow} command surface`}>
      <div className="studio-command-main">
        <div>
          <p className="eyebrow">{t(eyebrow)}</p>
          <h2>{t(title)}</h2>
        </div>
        {primaryAction ? (
          <div className="studio-command-actions">
            <Button href={primaryAction.href} onClick={primaryAction.onClick} size="small" variant={primaryAction.variant}>
              {t(primaryAction.label)}
            </Button>
          </div>
        ) : null}
      </div>

      {children ? <div className="studio-command-control">{children}</div> : null}
    </section>
  );
}
