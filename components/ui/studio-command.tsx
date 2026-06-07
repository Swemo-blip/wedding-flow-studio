import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export function StudioCommand({ actions = [], children, description, eyebrow, metrics = [], status, title }: StudioCommandProps) {
  return (
    <section className="studio-command" aria-label={`${eyebrow} command surface`}>
      <div className="studio-command-main">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="studio-command-actions">
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          {actions.map((action) => (
            <Button href={action.href} key={action.label} onClick={action.onClick} size="small" variant={action.variant}>
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {metrics.length > 0 ? (
        <div className="studio-command-metrics">
          {metrics.map((metric) => (
            <div data-tone={metric.tone ?? "neutral"} key={`${metric.label}-${metric.value}`}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {children ? <div className="studio-command-control">{children}</div> : null}
    </section>
  );
}
