import type { Metadata } from "next";
import { GuestsView } from "@/components/guests/guests-view";

export const metadata: Metadata = {
  title: "Guests",
  description: "Track who is coming, where they sit, and any dietary or accessibility needs — one source of truth for every guest."
};

export default function GuestsPage() {
  return <GuestsView />;
}
