"use client";

import Link from "next/link";
import { MobileNavigation } from "@/components/app-shell/navigation";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

type TopBarProps = {
  wedding: Wedding;
};

export function TopBar({ wedding }: TopBarProps) {
  const { hasLocalProject, wedding: localWedding } = useLocalProject();
  const activeWedding = hasLocalProject ? localWedding : wedding;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div>
          <p className="eyebrow">Wedding Day Digital Twin</p>
          <h1 className="topbar-title">{activeWedding.coupleNames}</h1>
          <p className="topbar-meta">{activeWedding.date} · {activeWedding.receptionLocation}</p>
        </div>
        <div className="topbar-actions">
          <div className="topbar-status">{hasLocalProject ? "Local twin active" : "Sample wedding"}</div>
          <Link className="topbar-primary-action" href="/preview">
            Preview
          </Link>
        </div>
      </div>
      <MobileNavigation />
    </header>
  );
}
