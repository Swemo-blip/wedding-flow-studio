import type { Metadata } from "next";
import { StudioWorkspace } from "@/components/studio/studio-workspace";

export const metadata: Metadata = {
  title: "Studio Workspace",
  description:
    "Use the unified studio workspace to preview the active wedding moment, understand risks, and apply one best next production decision."
};

export default function StudioPage() {
  return (
    <div className="page-grid">
      <StudioWorkspace />
    </div>
  );
}
