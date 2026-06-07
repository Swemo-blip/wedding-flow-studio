import type { Metadata } from "next";
import { WeddingPreview } from "@/components/preview/wedding-preview";

export const metadata: Metadata = {
  title: "Preview Wedding Day",
  description:
    "Walk through the wedding day moment by moment with connected locations, people, music cues, risks, role handoffs, and next-phase context."
};

export default function PreviewPage() {
  return <WeddingPreview />;
}
