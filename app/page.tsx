import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

export const metadata: Metadata = {
  title: {
    absolute: "Studio | Wedding Flow Studio"
  },
  description:
    "Your 3D wedding studio — shape the ceremony and reception scenes, then preview the whole day before it unfolds."
};

export default function OverviewPage() {
  return <OverviewDashboard />;
}
