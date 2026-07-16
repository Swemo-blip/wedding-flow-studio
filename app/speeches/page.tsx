import type { Metadata } from "next";
import { SpeechStudio } from "@/components/speeches/speech-studio";

export const metadata: Metadata = {
  title: "Speeches",
  description:
    "Plan the speeches and toasts — who speaks when, any surprises, microphone needs, and who introduces each one."
};

export default function SpeechesPage() {
  return <SpeechStudio />;
}
