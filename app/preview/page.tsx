import type { Metadata } from "next";
import { WeddingPreview } from "@/components/preview/wedding-preview";

export const metadata: Metadata = {
  title: "Preview Day",
  description:
    "Watch your wedding day unfold moment by moment — the places, the people, and the music, in the order they happen."
};

export default function PreviewPage() {
  return <WeddingPreview />;
}
