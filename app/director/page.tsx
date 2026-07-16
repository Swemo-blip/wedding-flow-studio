import type { Metadata } from "next";
import { DirectorBoard } from "@/components/director/director-board";

export const metadata: Metadata = {
  title: "Roles",
  description:
    "Give everyone helping on the day their own clear brief — just the moments, cues, contacts and to-dos they need."
};

export default function DirectorPage() {
  return <DirectorBoard />;
}
