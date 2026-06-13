"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

type StudioSceneSurfaceProps = {
  aside?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

export function StudioSceneSurface({ aside, children, description, eyebrow, title }: StudioSceneSurfaceProps) {
  const { t } = useTranslation();

  return (
    <section className="studio-scene-surface" aria-label={t(title)}>
      <div className="studio-scene-main">
        <div className="studio-scene-heading">
          <span>{t(eyebrow)}</span>
          <strong>{t(title)}</strong>
          <p>{description}</p>
        </div>
        <div className="studio-scene-visual">{children}</div>
      </div>
      {aside ? <aside className="studio-scene-aside">{aside}</aside> : null}
    </section>
  );
}
