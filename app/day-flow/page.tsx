import type { Metadata } from "next";
import { DayFlowEditor } from "@/components/day-flow/day-flow-editor";

export const metadata: Metadata = {
  title: "Timeline",
  description:
    "Shape your wedding-day timeline, see how each moment connects, and smooth out any timing clashes before the day arrives."
};

export default function DayFlowPage() {
  return <DayFlowEditor />;
}
