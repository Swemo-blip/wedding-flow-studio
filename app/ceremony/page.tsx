import type { Metadata } from "next";
import { CeremonyLayoutView } from "@/components/ceremony/ceremony-layout";

export const metadata: Metadata = {
  title: "Ceremony Layout",
  description:
    "Plan the ceremony layout with chapel rows, aisle flow, family seating, music cues, wedding party positions, officiant notes, and photographer locations."
};

export default function CeremonyPage() {
  return <CeremonyLayoutView />;
}
