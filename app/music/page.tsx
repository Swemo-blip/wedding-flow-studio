import type { Metadata } from "next";
import { MusicCueStudio } from "@/components/music/music-cue-studio";

export const metadata: Metadata = {
  title: "Music Cue Sheet",
  description:
    "Coordinate ceremony and reception music cues, responsible people, start cues, backup plans, statuses, and timeline-linked notes."
};

export default function MusicPage() {
  return <MusicCueStudio />;
}
