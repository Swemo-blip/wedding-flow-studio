"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { HardDrive, Sparkles, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getPersistenceState, subscribePersistence } from "@/lib/persistence-status";
import { useLocalProject } from "@/lib/use-local-project";

// Server snapshot must be a stable reference — returning a fresh object every
// call makes React re-render in a loop ("getServerSnapshot should be cached"),
// which remounted the 3D canvas ~8x per route and blanked it for 20s+.
const SERVER_PERSISTENCE_STATE = { ok: true, reason: null } as const;
const getServerPersistenceState = () => SERVER_PERSISTENCE_STATE;

// The honest save-state chip: "create yours" while exploring the sample,
// "saved in this browser" when the local project persists, and a loud but calm
// error when a write failed. Shared by the top bar and the home studio header.
export function SavedChip() {
  const { t } = useTranslation();
  const { hasLocalProject } = useLocalProject();
  const persistence = useSyncExternalStore(subscribePersistence, getPersistenceState, getServerPersistenceState);

  if (!hasLocalProject) {
    return (
      <Link className="studio-saved-chip studio-saved-chip-link" data-state="sample" href="/intake">
        <Sparkles aria-hidden="true" size={16} strokeWidth={1.7} />
        {t("Create your wedding")}
      </Link>
    );
  }

  if (persistence.ok) {
    return (
      <span className="studio-saved-chip" data-state="saved" title={t("Saved in this browser. Sign in to back up to the cloud.")}>
        <HardDrive aria-hidden="true" size={16} strokeWidth={1.7} />
        {t("Saved in this browser")}
      </span>
    );
  }

  return (
    <span className="studio-saved-chip" data-state="error" role="status">
      <TriangleAlert aria-hidden="true" size={16} strokeWidth={1.9} />
      {persistence.reason === "quota" ? t("Couldn't save — storage full") : t("Couldn't save changes")}
    </span>
  );
}
