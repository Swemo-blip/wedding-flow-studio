import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

export const metadata: Metadata = {
  title: "Preview Day",
  description:
    "Watch your wedding day unfold moment by moment — the places, the people, and the music, in the order they happen."
};

// This route used to mount its own copy of the 3D scene. It rendered the same
// walkthrough, but it was fed a thinner data path — no guest faces, no couple
// photos, no staging, and a pew count from the intake number instead of the live
// guest list — so the couple's cinematic reel showed a different wedding than
// their editor did. It now runs the studio itself, already in preview.
export default function PreviewPage() {
  return <OverviewDashboard startInPreview />;
}
