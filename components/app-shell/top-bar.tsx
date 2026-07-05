"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Eye, HardDrive, Share2, Sparkles, TriangleAlert } from "lucide-react";
import { MobileNavigation } from "@/components/app-shell/navigation";
import { useTranslation } from "@/lib/i18n";
import { getPersistenceState, subscribePersistence } from "@/lib/persistence-status";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

type TopBarProps = {
  wedding: Wedding;
};

export function TopBar({ wedding }: TopBarProps) {
  const { language, setLanguage, t } = useTranslation();
  const { hasLocalProject, wedding: localWedding } = useLocalProject();
  const persistence = useSyncExternalStore(subscribePersistence, getPersistenceState, () => ({ ok: true, reason: null }));
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const activeWedding = hasLocalProject ? localWedding : wedding;

  async function copyStudioLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus(t("Link copied"));
    } catch {
      setShareStatus(t("Copy the address bar link"));
    }

    window.setTimeout(() => setShareStatus(null), 2400);
  }

  return (
    <header className="studio-header">
      <div className="studio-header-inner">
        <div className="studio-header-identity">
          <h1>{hasLocalProject ? activeWedding.coupleNames : t("Your Wedding Studio")}</h1>
          <p>
            {hasLocalProject
              ? `${activeWedding.date} · ${activeWedding.receptionLocation}`
              : t("Preview your wedding day before it unfolds")}
          </p>
        </div>
        <div className="studio-header-actions">
          <div className="studio-lang-toggle" role="group" aria-label={t("Language")}>
            <button aria-pressed={language === "en"} data-active={language === "en"} onClick={() => setLanguage("en")} type="button">
              EN
            </button>
            <button aria-pressed={language === "sv"} data-active={language === "sv"} onClick={() => setLanguage("sv")} type="button">
              SV
            </button>
          </div>
          {!hasLocalProject ? (
            <span className="studio-saved-chip" data-state="sample">
              <Sparkles aria-hidden="true" size={16} strokeWidth={1.7} />
              {t("Sample wedding")}
            </span>
          ) : persistence.ok ? (
            <span
              className="studio-saved-chip"
              data-state="saved"
              title={t("Saved in this browser. Sign in to back up to the cloud.")}
            >
              <HardDrive aria-hidden="true" size={16} strokeWidth={1.7} />
              {t("Saved in this browser")}
            </span>
          ) : (
            <span className="studio-saved-chip" data-state="error" role="status">
              <TriangleAlert aria-hidden="true" size={16} strokeWidth={1.9} />
              {persistence.reason === "quota" ? t("Couldn't save — storage full") : t("Couldn't save changes")}
            </span>
          )}
          <button className="button button-secondary button-small studio-share-button" onClick={copyStudioLink} type="button">
            <Share2 aria-hidden="true" size={15} strokeWidth={1.8} />
            {shareStatus ?? t("Copy link")}
          </button>
          <Link className="button button-primary button-small studio-preview-button" href="/preview">
            <Eye aria-hidden="true" size={15} strokeWidth={1.8} />
            {t("Preview Day")}
          </Link>
        </div>
      </div>
      <MobileNavigation />
    </header>
  );
}
