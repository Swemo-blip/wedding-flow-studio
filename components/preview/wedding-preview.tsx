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
      eyebrow="Preview Day"
      primaryAction={{ href: "/day-flow", label: "Fine-tune the timing" }}
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
