import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

export const metadata: Metadata = {
  title: {
    absolute: "Overview | Wedding Flow Studio"
  },
  description:
    "One overview of the wedding-day digital twin: live 3D venue preview, timeline at a glance, guests, seating, style, readiness, and cue sheet."
};

export default function OverviewPage() {
  return <OverviewDashboard />;
}
