import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "low" | "medium" | "high" | "secret" | "confirmed";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return <span className={cn("badge", tone !== "neutral" && `badge-${tone}`, className)} {...props} />;
}
