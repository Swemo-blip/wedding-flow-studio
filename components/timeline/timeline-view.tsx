import { TimelineCard } from "@/components/timeline/timeline-card";
import type { TimelineItem } from "@/lib/wedding-types";

type TimelineViewProps = {
  items: TimelineItem[];
};

export function TimelineView({ items }: TimelineViewProps) {
  return (
    <div className="timeline" aria-label="Wedding day timeline">
      {items.map((item) => (
        <TimelineCard item={item} key={item.id} />
      ))}
    </div>
  );
}
