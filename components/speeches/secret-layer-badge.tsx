import { Badge } from "@/components/ui/badge";

type SecretLayerBadgeProps = {
  isSecret: boolean;
};

export function SecretLayerBadge({ isSecret }: SecretLayerBadgeProps) {
  if (!isSecret) {
    return <Badge>visible</Badge>;
  }

  return <Badge tone="secret">locked secret layer</Badge>;
}
