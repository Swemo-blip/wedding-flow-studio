import type { Metadata } from "next";
import { DirectorBoard } from "@/components/director/director-board";

export const metadata: Metadata = {
  title: "Director Mode",
  description:
    "Give each wedding-day role a focused production board with relevant timeline items, warnings, cues, contacts, checklists, and copy-ready briefs."
};

export default function DirectorPage() {
  return <DirectorBoard />;
}
