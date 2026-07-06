"use client";

import { useState } from "react";
import { assetPath } from "@/lib/asset-path";
import { useTranslation } from "@/lib/i18n";
import { fileToDownscaledDataUrl } from "@/lib/image-upload";
import { safeSetItem } from "@/lib/persistence-status";

function readStoredImage(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey);
}

export type StyleReference = {
  id: string;
  label: string;
  // CSS gradient shown until a real photo is dropped in (graceful placeholder).
  mood: string;
  // Optional photo path under /public. If the file is missing it 404s and the
  // tile falls back to the gradient placeholder — so you can drop photoreal /
  // AI-generated images into public/style-references/ and they appear with no
  // code change.
  image?: string;
};

export const CEREMONY_REFERENCES: StyleReference[] = [
  { id: "arch", label: "Floral arch", mood: "linear-gradient(140deg, #f4ece0, #dfe8d2 55%, #b9c79f)", image: assetPath("/style-references/ceremony-floral-arch.jpg") },
  { id: "aisle", label: "Candlelit aisle", mood: "linear-gradient(140deg, #fbe6c9, #e7c98b 60%, #caa05f)", image: assetPath("/style-references/ceremony-candlelit-aisle.jpg") },
  { id: "glass", label: "Stained glass", mood: "linear-gradient(140deg, #cdd8ea, #b48fae 52%, #8a6a52)", image: assetPath("/style-references/ceremony-stained-glass.jpg") },
  { id: "palette", label: "Palette & details", mood: "linear-gradient(140deg, #efe6d6, #d8c7a4 55%, #9f793b)", image: assetPath("/style-references/ceremony-palette.jpg") }
];

function StyleReferenceTile({ reference }: { reference: StyleReference }) {
  const { t } = useTranslation();
  const storageKey = `wedding-flow-studio.style-ref.${reference.id}`;
  // Uploaded images live in localStorage (browser-only, no backend) — the same
  // approach as the per-guest photos. Read in a lazy initializer (not an effect)
  // so it's hydration-safe: server + client both render an <img>, only src differs.
  const [uploaded, setUploaded] = useState<string | null>(() => readStoredImage(storageKey));
  const [staticFailed, setStaticFailed] = useState(!reference.image);

  async function handleUpload(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDownscaledDataUrl(file, 640);
    safeSetItem(storageKey, dataUrl);
    setUploaded(dataUrl);
  }

  function clearUpload() {
    window.localStorage.removeItem(storageKey);
    setUploaded(null);
  }

  // Priority: your uploaded image › a committed /public file › gradient placeholder.
  const src = uploaded ?? (staticFailed ? null : reference.image);

  return (
    <figure className="style-reference-tile">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={t(reference.label)} loading="lazy" onError={() => setStaticFailed(true)} src={src} suppressHydrationWarning />
      ) : (
        <span aria-hidden="true" className="style-reference-placeholder" style={{ backgroundImage: reference.mood }} />
      )}
      <label className="style-reference-upload">
        <input
          accept="image/*"
          hidden
          onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
          type="file"
        />
        <span>{uploaded ? t("Replace") : t("Upload")}</span>
      </label>
      {uploaded ? (
        <button aria-label={t("Remove photo")} className="style-reference-remove" onClick={clearUpload} type="button">
          ×
        </button>
      ) : null}
      <figcaption>{t(reference.label)}</figcaption>
    </figure>
  );
}

// A read-only thumbnail (no upload controls) for the Style References summary
// card — resolves uploaded image › committed /public file › gradient placeholder.
export function StyleReferenceThumb({ reference }: { reference: StyleReference }) {
  const { t } = useTranslation();
  const [uploaded] = useState<string | null>(() => readStoredImage(`wedding-flow-studio.style-ref.${reference.id}`));
  const [staticFailed, setStaticFailed] = useState(!reference.image);
  const src = uploaded ?? (staticFailed ? null : reference.image);

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={t(reference.label)}
      className="style-ref-thumb"
      loading="lazy"
      onError={() => setStaticFailed(true)}
      src={src}
      suppressHydrationWarning
    />
  ) : (
    <span
      aria-hidden="true"
      className="style-ref-thumb style-reference-placeholder"
      style={{ backgroundImage: reference.mood }}
      title={t(reference.label)}
    />
  );
}

export function StyleReferences({ references = CEREMONY_REFERENCES }: { references?: StyleReference[] }) {
  const { t } = useTranslation();

  return (
    <section aria-label={t("Style references")} className="style-references">
      <div className="style-references-head">
        <p className="eyebrow">{t("Style references")}</p>
        <h2>{t("The look and feel")}</h2>
      </div>
      <div className="style-references-grid">
        {references.map((reference) => (
          <StyleReferenceTile key={reference.id} reference={reference} />
        ))}
      </div>
    </section>
  );
}
