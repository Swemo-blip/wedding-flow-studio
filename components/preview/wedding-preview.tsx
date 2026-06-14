"use client";

import { DigitalTwinMap } from "@/components/preview/digital-twin-map";
import { WeddingDayPlayer } from "@/components/preview/wedding-day-player";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import { useTranslation } from "@/lib/i18n";

export function WeddingPreview() {
  const { t } = useTranslation();

  return (
    <StudioRouteFrame
      description="Play the wedding day as a connected sequence before anyone has to live it for real."
      eyebrow="Preview Wedding Day"
      meta={[
        { label: "Mode", value: "Cinematic" },
        { label: "Focus", value: "Next moment" },
        { label: "Output", value: "Run of Show" }
      ]}
      primaryAction={{ href: "/day-flow", label: "Repair Flow" }}
      secondaryAction={{ href: "/exports", label: "Export Brief" }}
      title="See the day before it unfolds."
    >
      <WeddingDayPlayer />
      <details className="preview-support-details">
        <summary>
          <span>{t("Planning Layers")}</span>
          <small>{t("Open the workflow map and digital twin graph when you want deeper context.")}</small>
        </summary>
        <div className="preview-support-content">
          <StudioWorkflow activeStep="preview" />
          <DigitalTwinMap />
        </div>
      </details>
    </StudioRouteFrame>
  );
}
