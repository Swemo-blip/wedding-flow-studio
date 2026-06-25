"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { fileToDownscaledDataUrl } from "@/lib/image-upload";

function readStoredVision(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

// The photoreal "Vision" of a room — the sellable hero. Resolves an uploaded
// render (localStorage) › a committed /public/vision/{room}.jpg › an elegant
// empty state prompting the couple to add their render. Browser-only, no backend
// — the same upload model as the per-guest photos and style references.
export function VisionView({ heading, room }: { heading: string; room: "ceremony" | "reception" }) {
  const { t } = useTranslation();
  const storageKey = `wedding-flow-studio.vision.${room}`;
  const publicSrc = `/vision/${room}.jpg`;
  const [uploaded, setUploaded] = useState<string | null>(() => readStoredVision(storageKey));
  const [publicOk, setPublicOk] = useState(false);

  // Probe the committed /public render so a missing file falls cleanly to the
  // empty state instead of a broken image.
  useEffect(() => {
    if (uploaded) {
      return;
    }
    let active = true;
    const probe = new Image();
    probe.onload = () => {
      if (active && probe.naturalWidth > 0) setPublicOk(true);
    };
    probe.onerror = () => {
      if (active) setPublicOk(false);
    };
    probe.src = publicSrc;
    return () => {
      active = false;
    };
  }, [publicSrc, uploaded]);

  const src = uploaded ?? (publicOk ? publicSrc : null);

  async function handleUpload(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDownscaledDataUrl(file, 1280);
    try {
      window.localStorage.setItem(storageKey, dataUrl);
    } catch {
      // localStorage full — keep it for this session at least.
    }
    setUploaded(dataUrl);
  }

  function clearUpload() {
    window.localStorage.removeItem(storageKey);
    setUploaded(null);
  }

  return (
    <div className="vision-view">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={t(heading)} className="vision-image" src={src} suppressHydrationWarning />
      ) : (
        <div className="vision-empty">
          <p className="eyebrow">{t("Photoreal vision")}</p>
          <h3>{t(heading)}</h3>
          <p>{t("Add a photoreal render of your day — generate one from your style references, then upload it here.")}</p>
        </div>
      )}
      <label className="vision-upload">
        <input accept="image/*" hidden onChange={(event) => handleUpload(event.target.files?.[0] ?? null)} type="file" />
        <span>{uploaded ? t("Replace vision") : t("Upload vision")}</span>
      </label>
      {uploaded ? (
        <button aria-label={t("Remove photo")} className="vision-remove" onClick={clearUpload} type="button">
          ×
        </button>
      ) : null}
    </div>
  );
}
