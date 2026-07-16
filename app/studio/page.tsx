import type { Metadata } from "next";
import { StudioWorkspace } from "@/components/studio/studio-workspace";

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Focus on one wedding moment at a time — see how ready it is and the single best thing to decide next."
};

export default function StudioPage() {
  return (
    <div className="page-grid">
      <StudioWorkspace />
    </div>
  );
}
