"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { fileToDownscaledDataUrl } from "@/lib/image-upload";

function readStoredVision(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

// The photoreal "Vision" of a room — the sellable hero. Resolves an uploaded
// render (localStorage) › a committed /public/vision/{room}.jpg › an empty state
// that doubles as a drag-and-drop + click-to-upload zone. Browser-only, no
// backend — the same upload model as the per-guest photos and style references.
export function VisionView({ heading, room }: { heading: string; room: "ceremony" | "reception" }) {
  const { t } = useTranslation();
  const storageKey = `wedding-flow-studio.vision.${room}`;
  const publicSrc = `/vision/${room}.jpg`;
  const [uploaded, setUploaded] = useState<string | null>(() => readStoredVision(storageKey));
  const [publicOk, setPublicOk] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function handleUpload(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
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

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div
      className="vision-view"
      data-dragover={dragOver ? "true" : undefined}
      onDragLeave={() => setDragOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        void handleUpload(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        accept="image/*"
        hidden
        onChange={(event) => void handleUpload(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={t(heading)} className="vision-image" src={src} suppressHydrationWarning />
      ) : (
        <button className="vision-empty" onClick={openPicker} type="button">
          <span className="eyebrow">{t("Photoreal vision")}</span>
          <span className="vision-empty-title">{t(heading)}</span>
          <span className="vision-empty-text">
            {t("Drop a photoreal render here, or click to upload — generate one from your style references.")}
          </span>
        </button>
      )}
      <button className="vision-upload" onClick={openPicker} type="button">
        <span>{uploaded ? t("Replace vision") : t("Upload vision")}</span>
      </button>
      {uploaded ? (
        <button aria-label={t("Remove photo")} className="vision-remove" onClick={clearUpload} type="button">
          ×
        </button>
      ) : null}
    </div>
  );
}
