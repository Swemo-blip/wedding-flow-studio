"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type StudioRouteAction = {
  href?: string;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
};

type StudioRouteFrameProps = {
  children: ReactNode;
  eyebrow: string;
  primaryAction?: StudioRouteAction;
  title: string;
};

export function StudioRouteFrame({
  children,
  eyebrow,
  primaryAction,
  title
}: StudioRouteFrameProps) {
  const { t } = useTranslation();

  return (
    <section className="studio-route-frame" aria-label={t(title)}>
      <header className="studio-route-ribbon">
        <div className="studio-route-copy">
          <span>{t(eyebrow)}</span>
          <h1>{t(title)}</h1>
        </div>

        {primaryAction ? (
          <div className="studio-route-actions" aria-label="Route actions">
            <Button
              href={primaryAction.href}
              onClick={primaryAction.onClick}
              size="small"
              variant={primaryAction.variant ?? "primary"}
            >
              {t(primaryAction.label)}
            </Button>
          </div>
        ) : null}
      </header>

      {children}
    </section>
  );
}
