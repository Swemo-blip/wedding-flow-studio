import { Badge } from "@/components/ui/badge";
import type { MusicCueStatus } from "@/lib/wedding-types";

type CueStatusBadgeProps = {
  status: MusicCueStatus;
};

export function CueStatusBadge({ status }: CueStatusBadgeProps) {
  const tone = status === "confirmed" ? "confirmed" : status === "needs-backup" || status === "needs-cue" ? "medium" : "low";
  const label = status.replaceAll("-", " ");

  return <Badge tone={tone}>{label}</Badge>;
}
