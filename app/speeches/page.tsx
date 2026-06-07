import type { Metadata } from "next";
import { SpeechStudio } from "@/components/speeches/speech-studio";

export const metadata: Metadata = {
  title: "Speech Studio",
  description:
    "Plan wedding speeches, program timing, surprise items, technical needs, microphone cues, intro people, and Secret Layers for Director Mode."
};

export default function SpeechesPage() {
  return <SpeechStudio />;
}
