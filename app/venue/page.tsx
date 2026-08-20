import type { Metadata } from "next";
import { VenueTraceView } from "@/components/venue/venue-trace-view";

export const metadata: Metadata = {
  title: "Venue",
  description: "Trace your venue's floor plan to scale, so the plan you share with your crew is a drawing of the room they will actually work."
};

export default function VenuePage() {
  return <VenueTraceView />;
}
