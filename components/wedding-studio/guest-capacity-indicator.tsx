import { Badge } from "@/components/ui/badge";
import type { WeddingStudioCapacity } from "@/lib/wedding-studio-plan";

type GuestCapacityIndicatorProps = {
  capacity: WeddingStudioCapacity;
};

export function GuestCapacityIndicator({ capacity }: GuestCapacityIndicatorProps) {
  const tone = capacity.capacityStatus === "over_capacity" ? "high" : capacity.capacityStatus === "full" ? "medium" : "confirmed";

  return (
    <div className="studio-capacity-indicator" data-status={capacity.capacityStatus}>
      <div className="summary-between">
        <div>
          <span>Capacity status</span>
          <strong>{capacity.capacityLabel}</strong>
        </div>
        <Badge tone={tone}>{capacity.usedCapacityPercent}% used</Badge>
      </div>
      <div className="studio-capacity-meter" aria-hidden="true">
        <span style={{ width: `${Math.min(100, capacity.usedCapacityPercent)}%` }} />
      </div>
      <p>{capacity.comfortLabel}</p>
    </div>
  );
}
