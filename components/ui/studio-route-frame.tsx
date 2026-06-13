"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type StudioRouteAction = {
  href?: string;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
};

type StudioRouteMeta = {
  label: string;
  value: string;
};

type StudioRouteFrameProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  meta?: StudioRouteMeta[];
  primaryAction?: StudioRouteAction;
  secondaryAction?: StudioRouteAction;
  title: string;
};

export function StudioRouteFrame({
  children,
  eyebrow,
  primaryAction,
  title
}: StudioRouteFrameProps) {
  return (
    <section className="studio-route-frame" aria-label={title}>
      <header className="studio-route-ribbon">
        <div className="studio-route-copy">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
        </div>

        {primaryAction ? (
          <div className="studio-route-actions" aria-label="Route actions">
            {renderAction(primaryAction, "primary")}
          </div>
        ) : null}
      </header>

      {children}
    </section>
  );
}

function renderAction(action: StudioRouteAction, fallbackVariant: "primary" | "secondary") {
  return (
    <Button href={action.href} onClick={action.onClick} size="small" variant={action.variant ?? fallbackVariant}>
      {action.label}
    </Button>
  );
}
