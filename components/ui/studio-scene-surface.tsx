import type { ReactNode } from "react";

type StudioSceneSurfaceProps = {
  aside?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
};

export function StudioSceneSurface({ aside, children, description, eyebrow, title }: StudioSceneSurfaceProps) {
  return (
    <section className="studio-scene-surface" aria-label={title}>
      <div className="studio-scene-main">
        <div className="studio-scene-heading">
          <span>{eyebrow}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <div className="studio-scene-visual">{children}</div>
      </div>
      {aside ? <aside className="studio-scene-aside">{aside}</aside> : null}
    </section>
  );
}
