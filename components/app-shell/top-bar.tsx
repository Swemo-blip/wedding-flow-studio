"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Eye, HardDrive, Share2, Sparkles, TriangleAlert } from "lucide-react";
import { MobileNavigation } from "@/components/app-shell/navigation";
import { useTranslation } from "@/lib/i18n";
import { formatWeddingDate } from "@/lib/utils";
import { getPersistenceState, subscribePersistence } from "@/lib/persistence-status";
import { buildShareSnapshot, buildShareUrl, encodeSnapshot } from "@/lib/share-snapshot";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

type TopBarProps = {
  wedding: Wedding;
};

// Server snapshot must be a stable reference — returning a fresh object every
// call makes React re-render in a loop ("getServerSnapshot should be cached"),
// which remounted the 3D canvas ~8x per route and blanked it for 20s+.
const SERVER_PERSISTENCE_STATE = { ok: true, reason: null } as const;
const getServerPersistenceState = () => SERVER_PERSISTENCE_STATE;

export function TopBar({ wedding }: TopBarProps) {
  const { language, setLanguage, t } = useTranslation();
  const { guests, hasLocalProject, timelineItems, updatedAt, wedding: localWedding } = useLocalProject();
  const persistence = useSyncExternalStore(subscribePersistence, getPersistenceState, getServerPersistenceState);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const activeWedding = hasLocalProject ? localWedding : wedding;

  // A shareable read-only link carrying the plan in its hash, so a recipient
  // sees this couple's plan, not their own localStorage. Rebuilt when the plan
  // changes; `updatedAt` in the deps keeps it fresh after edits.
  const shareUrl = useMemo(
    () => buildShareUrl(encodeSnapshot(buildShareSnapshot({ guests, timelineItems, wedding: activeWedding }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeWedding, guests, timelineItems, updatedAt]
  );

  async function copyStudioLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
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
              ? `${formatWeddingDate(activeWedding.date)} · ${activeWedding.receptionLocation}`
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
            <Link className="studio-saved-chip studio-saved-chip-link" data-state="sample" href="/intake">
              <Sparkles aria-hidden="true" size={16} strokeWidth={1.7} />
              {t("Create your wedding")}
            </Link>
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
