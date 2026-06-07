import { Badge } from "@/components/ui/badge";
import { musicCues, speeches } from "@/lib/wedding-data";
import type { TimelineItem } from "@/lib/wedding-types";

type TimelineCardProps = {
  item: TimelineItem;
};

export function TimelineCard({ item }: TimelineCardProps) {
  const musicCue = item.musicCueId ? musicCues.find((cue) => cue.id === item.musicCueId) : null;
  const speech = item.speechId ? speeches.find((speechItem) => speechItem.id === item.speechId) : null;

  return (
    <article className="timeline-card">
      <div className="timeline-time">{item.time}</div>
      <div className="timeline-body">
        <div className="summary-between">
          <h3 className="timeline-title">{item.title}</h3>
          {item.riskLevel ? <Badge tone={item.riskLevel}>risk: {item.riskLevel}</Badge> : null}
        </div>
        <div className="timeline-meta">
          <Badge>{item.phase}</Badge>
          <Badge>{item.location}</Badge>
          <Badge>{item.responsibleRole}</Badge>
          <Badge>{item.responsiblePerson}</Badge>
          {musicCue ? <Badge tone={musicCue.status === "confirmed" ? "confirmed" : "medium"}>{musicCue.songTitle}</Badge> : null}
          {speech ? <Badge tone={speech.isSecret ? "secret" : "neutral"}>{speech.title}</Badge> : null}
        </div>
        <p className="timeline-notes">{item.notes}</p>
      </div>
    </article>
  );
}
