import type { Metadata } from "next";
import { WeddingProducerIntake } from "@/components/intake/wedding-producer-intake";

export const metadata: Metadata = {
  title: "Create your wedding",
  description:
    "Start your wedding plan with a few calm questions — your date, venues, guest count, style, and what matters most to you."
};

export default function IntakePage() {
  return <WeddingProducerIntake />;
}
