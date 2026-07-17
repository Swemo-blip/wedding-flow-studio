"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Share2 } from "lucide-react";
import { MobileNavigation } from "@/components/app-shell/navigation";
import { SavedChip } from "@/components/app-shell/saved-chip";
import { useTranslation } from "@/lib/i18n";
import { formatWeddingDate } from "@/lib/utils";
import { buildShareSnapshot, buildShareUrl, encodeSnapshot } from "@/lib/share-snapshot";
import { useLocalProject } from "@/lib/use-local-project";
import type { Wedding } from "@/lib/wedding-types";

type TopBarProps = {
  wedding: Wedding;
};

export function TopBar({ wedding }: TopBarProps) {
  const { language, setLanguage, t } = useTranslation();
  const { guests, hasLocalProject, timelineItems, updatedAt, wedding: localWedding } = useLocalProject();
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
          <SavedChip />
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
