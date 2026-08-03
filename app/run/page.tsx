import type { Metadata } from "next";
import { RunTheDay } from "@/components/run/run-the-day";

export const metadata: Metadata = {
  title: "Run the day",
  description:
    "The running order for whoever holds the room: what is happening now, what is next, and one tap to tick a moment off or strike it."
};

export default function RunPage() {
  return <RunTheDay />;
}
