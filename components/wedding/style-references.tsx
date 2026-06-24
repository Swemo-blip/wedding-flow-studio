"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

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

const CEREMONY_REFERENCES: StyleReference[] = [
  { id: "arch", label: "Floral arch", mood: "linear-gradient(140deg, #f4ece0, #dfe8d2 55%, #b9c79f)", image: "/style-references/ceremony-floral-arch.jpg" },
  { id: "aisle", label: "Candlelit aisle", mood: "linear-gradient(140deg, #fbe6c9, #e7c98b 60%, #caa05f)", image: "/style-references/ceremony-candlelit-aisle.jpg" },
  { id: "glass", label: "Stained glass", mood: "linear-gradient(140deg, #cdd8ea, #b48fae 52%, #8a6a52)", image: "/style-references/ceremony-stained-glass.jpg" },
  { id: "palette", label: "Palette & details", mood: "linear-gradient(140deg, #efe6d6, #d8c7a4 55%, #9f793b)", image: "/style-references/ceremony-palette.jpg" }
];

function StyleReferenceTile({ reference }: { reference: StyleReference }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(!reference.image);

  return (
    <figure className="style-reference-tile">
      {failed ? (
        <span aria-hidden="true" className="style-reference-placeholder" style={{ backgroundImage: reference.mood }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={t(reference.label)} loading="lazy" onError={() => setFailed(true)} src={reference.image} />
      )}
      <figcaption>{t(reference.label)}</figcaption>
    </figure>
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
