import type { Metadata } from "next";
import { WeddingProducerIntake } from "@/components/intake/wedding-producer-intake";

export const metadata: Metadata = {
  title: "Wedding Producer Intake",
  description:
    "Create the first wedding-day digital twin from a calm guided intake for date, venues, guest count, style, team, priorities, and production notes."
};

export default function IntakePage() {
  return <WeddingProducerIntake />;
}
