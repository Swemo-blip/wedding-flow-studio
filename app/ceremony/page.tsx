import type { Metadata } from "next";
import { CeremonyStudio } from "@/components/ceremony/ceremony-studio";

export const metadata: Metadata = {
  title: "Ceremony Studio",
  description:
    "Design the ceremony in a live 3D studio — set the guest count and watch the pews fill, choose the venue, style, decoration and lighting, and review capacity and accessibility."
};

export default function CeremonyPage() {
  return <CeremonyStudio />;
}
