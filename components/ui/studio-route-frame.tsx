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
  description,
  eyebrow,
  meta = [],
  primaryAction,
  secondaryAction,
  title
}: StudioRouteFrameProps) {
  return (
    <section className="studio-route-frame" aria-label={title}>
      <header className="studio-route-ribbon">
        <div className="studio-route-copy">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {meta.length > 0 ? (
          <dl className="studio-route-meta" aria-label="Route context">
            {meta.map((item) => (
              <div key={`${item.label}-${item.value}`}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {primaryAction || secondaryAction ? (
          <div className="studio-route-actions" aria-label="Route actions">
            {primaryAction ? renderAction(primaryAction, "primary") : null}
            {secondaryAction ? renderAction(secondaryAction, "secondary") : null}
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
