import { DigitalTwinMap } from "@/components/preview/digital-twin-map";
import { WeddingDayPlayer } from "@/components/preview/wedding-day-player";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";

export function WeddingPreview() {
  return (
    <div className="page-grid">
      <WeddingDayPlayer />
      <details className="preview-support-details">
        <summary>
          <span>Planning Layers</span>
          <small>Open the workflow map and digital twin graph when you want deeper context.</small>
        </summary>
        <div className="preview-support-content">
          <StudioWorkflow activeStep="preview" />
          <DigitalTwinMap />
        </div>
      </details>
    </div>
  );
}
