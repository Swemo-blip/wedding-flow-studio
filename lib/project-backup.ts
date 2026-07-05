"use client";

import { safeSetItem } from "@/lib/persistence-status";

// A backup is every localStorage key this app owns (project, budget, checklist,
// layout, risk resolutions, style photos) captured into one downloadable file.
// This is the offline safety net: a couple can save a copy, move it to another
// device, or restore it after clearing their browser — no backend needed.

const BACKUP_APP_ID = "wedding-flow-studio";
const OWNED_KEY_PREFIX = "wedding-flow-studio.";
const BACKUP_VERSION = 1;

export type BackupFile = {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, string>;
};

export type RestoreResult = { ok: true; keys: number } | { ok: false; error: "not-json" | "invalid" | "storage" };

export function buildBackup(exportedAt: string): BackupFile {
  const data: Record<string, string> = {};

  if (typeof window !== "undefined") {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(OWNED_KEY_PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value !== null) {
          data[key] = value;
        }
      }
    }
  }

  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt, data };
}

export function downloadBackup(): BackupFile {
  const exportedAt = new Date().toISOString();
  const backup = buildBackup(exportedAt);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `wedding-flow-studio-backup-${exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return backup;
}

// Guard for destructive resets: confirm with the couple, and — if they agree —
// download a backup file BEFORE anything is cleared, so the wipe is always
// recoverable. Returns false (caller should abort) unless the user confirms.
export function confirmAndBackupBeforeReset(message: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!window.confirm(message)) {
    return false;
  }

  try {
    downloadBackup();
  } catch {
    // Best-effort safety copy — never block the reset the user explicitly asked for.
  }

  return true;
}

export async function restoreBackup(file: File): Promise<RestoreResult> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: "not-json" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "invalid" };
  }

  const backup = parsed as Partial<BackupFile>;
  if (backup.app !== BACKUP_APP_ID || !backup.data || typeof backup.data !== "object") {
    return { ok: false, error: "invalid" };
  }

  let written = 0;
  let anyFailed = false;

  for (const [key, value] of Object.entries(backup.data)) {
    if (key.startsWith(OWNED_KEY_PREFIX) && typeof value === "string") {
      if (safeSetItem(key, value)) {
        written += 1;
      } else {
        anyFailed = true;
      }
    }
  }

  if (written === 0) {
    return { ok: false, error: anyFailed ? "storage" : "invalid" };
  }

  return { ok: true, keys: written };
}
