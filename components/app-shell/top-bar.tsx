"use client";

import { useState } from "react";
import Link from "next/link";
import { CloudCheck, Eye, Share2 } from "lucide-react";
import { MobileNavigation } from "@/components/app-shell/navigation";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

type TopBarProps = {
  wedding: Wedding;
};

export function TopBar({ wedding }: TopBarProps) {
  const { hasLocalProject, wedding: localWedding } = useLocalProject();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const activeWedding = hasLocalProject ? localWedding : wedding;

  async function copyStudioLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Link copied");
    } catch {
      setShareStatus("Copy the address bar link");
    }

    window.setTimeout(() => setShareStatus(null), 2400);
  }

  return (
    <header className="studio-header">
      <div className="studio-header-inner">
        <div className="studio-header-identity">
          <h1>{hasLocalProject ? activeWedding.coupleNames : "Your Wedding Studio"}</h1>
          <p>
            {hasLocalProject
              ? `${activeWedding.date} · ${activeWedding.receptionLocation}`
              : "Preview your wedding day before it unfolds"}
          </p>
        </div>
        <div className="studio-header-actions">
          <span className="studio-saved-chip">
            <CloudCheck aria-hidden="true" size={16} strokeWidth={1.7} />
            {hasLocalProject ? "All changes saved" : "Sample wedding"}
          </span>
          <button className="button button-secondary button-small studio-share-button" onClick={copyStudioLink} type="button">
            <Share2 aria-hidden="true" size={15} strokeWidth={1.8} />
            {shareStatus ?? "Share Studio"}
          </button>
          <Link className="button button-primary button-small studio-preview-button" href="/preview">
            <Eye aria-hidden="true" size={15} strokeWidth={1.8} />
            Preview Day
          </Link>
        </div>
      </div>
      <MobileNavigation />
    </header>
  );
}
