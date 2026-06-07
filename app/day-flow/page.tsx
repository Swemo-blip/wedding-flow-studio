import type { Metadata } from "next";
import { DayFlowEditor } from "@/components/day-flow/day-flow-editor";

export const metadata: Metadata = {
  title: "Visual Day Flow",
  description:
    "Edit the wedding-day timeline, inspect moment readiness, and repair timing, cue, role, and guest-flow risks from one visual production surface."
};

export default function DayFlowPage() {
  return <DayFlowEditor />;
}
