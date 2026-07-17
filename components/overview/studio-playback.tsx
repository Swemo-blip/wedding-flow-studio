"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { PreviewPhase } from "@/lib/wedding-types";

type StudioPlaybackProps = {
  index: number;
  isPlaying: boolean;
  onExit: () => void;
  onJump: (index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onTogglePlay: () => void;
  phases: PreviewPhase[];
};

// The one playback system for the day: transport, current moment, and a
// clickable moment track. Replaces the old scattered "Play processional" /
// "Preview the day" / "Restart" buttons with a single, calm bar.
export function StudioPlayback({ index, isPlaying, onExit, onJump, onNext, onPrevious, onRestart, onTogglePlay, phases }: StudioPlaybackProps) {
  const { t } = useTranslation();
  const phase = phases[index];

  if (!phase) {
    return null;
  }

  return (
    <footer aria-label={t("Ceremony playback")} className="vstudio-playbar">
      <div className="vstudio-playbar-transport" role="group" aria-label={t("Playback controls")}>
        <button aria-label={t("Restart")} onClick={onRestart} title={t("Restart")} type="button">
          <RotateCcw aria-hidden="true" size={15} strokeWidth={1.9} />
        </button>
        <button aria-label={t("Previous moment")} disabled={index === 0} onClick={onPrevious} title={t("Previous moment")} type="button">
          <SkipBack aria-hidden="true" size={15} strokeWidth={1.9} />
        </button>
        <button
          aria-label={isPlaying ? t("Pause") : t("Play")}
          className="vstudio-playbar-play"
          onClick={onTogglePlay}
          title={isPlaying ? t("Pause") : t("Play")}
          type="button"
        >
          {isPlaying ? <Pause aria-hidden="true" size={17} strokeWidth={1.9} /> : <Play aria-hidden="true" size={17} strokeWidth={1.9} />}
        </button>
        <button
          aria-label={t("Next moment")}
          disabled={index >= phases.length - 1}
          onClick={onNext}
          title={t("Next moment")}
          type="button"
        >
          <SkipForward aria-hidden="true" size={15} strokeWidth={1.9} />
        </button>
      </div>

      <div className="vstudio-playbar-now">
        <strong>{t(phase.title)}</strong>
        <span>{phase.timeRange}</span>
      </div>

      <div className="vstudio-playbar-track" role="group" aria-label={t("Moments")}>
        {phases.map((trackPhase, trackIndex) => (
          <button
            aria-current={trackIndex === index ? "step" : undefined}
            aria-label={`${t(trackPhase.title)} · ${trackPhase.timeRange}`}
            data-state={trackIndex < index ? "done" : trackIndex === index ? "active" : "upcoming"}
            key={trackPhase.id}
            onClick={() => onJump(trackIndex)}
            title={t(trackPhase.title)}
            type="button"
          />
        ))}
      </div>

      <span className="vstudio-playbar-count" aria-live="polite">
        {t("Moment {current} of {total}", { current: index + 1, total: phases.length })}
      </span>

      <button className="vstudio-playbar-exit" onClick={onExit} type="button">
        {t("Exit preview")}
      </button>
    </footer>
  );
}
