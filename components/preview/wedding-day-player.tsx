"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { MomentInspector } from "@/components/moment/moment-inspector";
import { PreviewWalkthrough } from "@/components/preview/preview-walkthrough";
import { Button } from "@/components/ui/button";
import { assetPath } from "@/lib/asset-path";
import { buildMomentIntelligence } from "@/lib/moment-intelligence";
import { buildPreviewCockpitContext } from "@/lib/preview-cockpit";
import { useTranslation } from "@/lib/i18n";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { useLocalProject } from "@/lib/use-local-project";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { derivePreviewPhases, waypointIndexForPhase } from "@/lib/preview-phases";
import { previewPhases } from "@/lib/wedding-data";

const scenePositions = [
  { left: "17%", top: "40%" },
  { left: "30%", top: "62%" },
  { left: "47%", top: "35%" },
  { left: "61%", top: "61%" },
  { left: "75%", top: "42%" },
  { left: "52%", top: "74%" }
];

export function WeddingDayPlayer() {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { t } = useTranslation();

  // The processional music plays through the whole day walkthrough while it's
  // playing (started by the explicit Play press — a user gesture).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.volume = 0.5;
    if (isPlaying) {
      void audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);
  const { dinnerTables, guests, hasLocalProject, musicCues, speeches, timelineItems } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const risks = useMemo(
    () =>
      filterResolvedRisks(
        analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues, speechItems: speeches, guestItems: guests, tables: dinnerTables }),
        resolvedRiskIds
      ),
    [dinnerTables, guests, musicCues, resolvedRiskIds, speeches, timelineItems]
  );
  // The Preview is now the couple's OWN day: phases are derived at runtime from
  // their real timeline (grouped by phase, in their order), so editing the
  // timeline changes what they watch. Falls back to the sample reel only if the
  // timeline is somehow empty.
  const phases = useMemo(() => {
    const derived = derivePreviewPhases(timelineItems);
    return derived.length ? derived : previewPhases;
  }, [timelineItems]);
  const safeIndex = Math.min(index, phases.length - 1);
  const phase = phases[safeIndex];
  const nextPhase = phases[safeIndex + 1];
  const relatedTimeline = useMemo(
    () => getTimelineItemsByIds(timelineItems, phase.relatedTimelineItemIds),
    [phase.relatedTimelineItemIds, timelineItems]
  );
  const cockpit = useMemo(
    () =>
      buildPreviewCockpitContext({
        cues: musicCues,
        nextPhase,
        phase,
        phaseIndex: safeIndex,
        relatedTimeline,
        risks,
        speechItems: speeches,
        totalPhases: phases.length
      }),
    [safeIndex, musicCues, nextPhase, phase, phases.length, relatedTimeline, risks, speeches]
  );
  const momentIntelligence = useMemo(
    () =>
      buildMomentIntelligence({
        cues: musicCues,
        dinnerTables,
        guests,
        nextPhase,
        phase,
        phaseIndex: safeIndex,
        relatedTimeline,
        risks,
        speeches,
        totalPhases: phases.length
      }),
    [dinnerTables, guests, safeIndex, musicCues, nextPhase, phase, phases.length, relatedTimeline, risks, speeches]
  );
  const resolvedCount = resolvedRiskIds.length;
  // Use the clamped index everywhere so the transport stays consistent if the
  // phase list shrinks (e.g. a cross-tab timeline edit) while index is stale.
  const canGoPrevious = safeIndex > 0;
  const canGoNext = safeIndex < phases.length - 1;

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setIndex((currentIndex) => {
        if (currentIndex >= phases.length - 1) {
          setIsPlaying(false);
          return currentIndex;
        }

        return currentIndex + 1;
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isPlaying, phases.length]);

  function goToPreviousMoment() {
    // Step from the clamped index so a stale over-range index can't waste clicks.
    setIndex(Math.max(0, Math.min(index, phases.length - 1) - 1));
    setIsPlaying(false);
  }

  function goToNextMoment() {
    setIndex(Math.min(phases.length - 1, Math.min(index, phases.length - 1) + 1));
    setIsPlaying(false);
  }

  return (
    <section className="preview-day-player preview-command-center" aria-label="Preview Wedding Day Command Center">
      <div className="preview-walkthrough-band" aria-label="Cinematic walkthrough of the wedding day">
        <PreviewWalkthrough phaseIndex={waypointIndexForPhase(phase.title)} />
        <div className="preview-walkthrough-overlay">
          <span>{phase.timeRange}</span>
          <strong>{t(phase.title)}</strong>
        </div>
        <div className="preview-walkthrough-transport" role="group" aria-label="Walkthrough transport">
          <button aria-label="Previous moment" disabled={!canGoPrevious} onClick={goToPreviousMoment} type="button">
            ‹
          </button>
          <button
            aria-label={isPlaying ? "Pause walkthrough" : "Play walkthrough"}
            className="preview-walkthrough-play"
            data-playing={isPlaying}
            onClick={() => setIsPlaying((value) => !value)}
            type="button"
          >
            {isPlaying ? t("Pause") : t("Play the day")}
          </button>
          <button aria-label="Next moment" disabled={!canGoNext} onClick={goToNextMoment} type="button">
            ›
          </button>
          <button
            aria-label={muted ? t("Unmute music") : t("Mute music")}
            className="preview-walkthrough-mute"
            data-active={!muted}
            onClick={() => {
              const audio = audioRef.current;
              if (audio) {
                audio.muted = !audio.muted;
                setMuted(audio.muted);
              }
            }}
            type="button"
          >
            {muted ? <VolumeX aria-hidden="true" size={15} /> : <Volume2 aria-hidden="true" size={15} />}
          </button>
        </div>
        <audio loop preload="auto" ref={audioRef} src={assetPath("/audio/processional.mp3")} />
      </div>

      <div className="preview-day-caption">
        <span className="eyebrow">{t("Wedding Day Simulator")}</span>
        <p>{cockpit.feelingLine}</p>
      </div>

      <ol className="preview-moment-rail preview-command-rail" aria-label="Wedding day preview sequence">
        {phases.map((previewPhase, phaseIndex) => (
          <li data-active={phaseIndex === safeIndex} data-complete={phaseIndex < safeIndex} key={previewPhase.id}>
            <button
              onClick={() => {
                setIndex(phaseIndex);
                setIsPlaying(false);
              }}
              type="button"
            >
              <span>{phaseIndex + 1}</span>
              <small>{t(previewPhase.title)}</small>
            </button>
          </li>
        ))}
      </ol>

      <details className="preview-scene-details">
        <summary>
          <span>{t("Scene Board")}</span>
          <small>{t("Open the map, owner, music, risks, and handoff details only when you need production depth.")}</small>
        </summary>

        <div className="preview-command-layout">
          <div className="preview-cinema-stage" data-scene={cockpit.sceneKind}>
            <div className="preview-stage-topline">
              <span className="preview-state-line">{phase.timeRange}</span>
              <span className="preview-state-line" data-tone={cockpit.primaryRisk ? cockpit.primaryRisk.severity : "confirmed"}>
                {cockpit.primaryRisk ? `${cockpit.primaryRisk.severity} risk` : "Scene clear"}
              </span>
            </div>

            <div className="preview-location-card preview-stage-location">
              <span>Now in</span>
              <strong>{phase.location}</strong>
            </div>

            <div className="preview-stage-map" aria-hidden="true">
              <span className="preview-stage-zone preview-stage-zone-left">Guest path</span>
              <span className="preview-stage-zone preview-stage-zone-right">Vendor path</span>
              <span className="preview-stage-zone preview-stage-zone-bottom">Next handoff</span>
            </div>

            <div className="preview-flow-line preview-command-flow" aria-hidden="true">
              <span />
            </div>

            <div className="preview-scene-landmark preview-command-landmark">
              <span>{cockpit.sceneLabel}</span>
            </div>

            {phase.involvedPeople.slice(0, scenePositions.length).map((person, personIndex) => (
              <div className="preview-person-token" key={person} style={scenePositions[personIndex]}>
                <span>{getInitials(person)}</span>
                <small>{person}</small>
              </div>
            ))}

            <div className="preview-scene-caption">
              <span>How this moment should feel</span>
              <strong>{cockpit.feelingLine}</strong>
            </div>

            <div className="preview-stage-pulse" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>

          <aside className="preview-command-stack">
            <div className="preview-current-moment preview-command-moment">
              <p className="eyebrow">{phase.timeRange}</p>
              <h2>{t(phase.title)}</h2>
              <p>{phase.summary}</p>
            </div>

            <div className="preview-next-move-card">
              <p className="eyebrow">Recommended Next Move</p>
              <h3>{momentIntelligence.primaryAction.label}</h3>
              <p>{momentIntelligence.primaryAction.detail}</p>
              <Button href={momentIntelligence.primaryAction.href}>{momentIntelligence.primaryAction.label}</Button>
            </div>

            <div className="preview-command-facts">
              <div>
                <span>Owner</span>
                <strong>{phase.responsiblePerson}</strong>
                <small>{phase.responsibleRole}</small>
              </div>
              <div>
                <span>Music</span>
                <strong>{cockpit.musicCue ? cockpit.musicCue.songTitle : "No cue"}</strong>
                <small>{cockpit.musicCue ? formatStatus(cockpit.musicCue.status) : "No cue linked"}</small>
              </div>
              <div>
                <span>People</span>
                <strong>{phase.involvedPeople.length} groups</strong>
                <small>{phase.involvedPeople.slice(0, 3).join(", ")}</small>
              </div>
              <div>
                <span>Next</span>
                <strong>{nextPhase?.title ?? "Briefs"}</strong>
                <small>{nextPhase?.responsiblePerson ?? "Send final handoffs"}</small>
              </div>
            </div>

            <div className="preview-watch-card" data-clear={cockpit.primaryRisk ? "false" : "true"}>
              <div className="summary-between">
                <strong>{cockpit.primaryRisk ? cockpit.primaryRisk.title : "Ready Signal"}</strong>
                <span className="preview-state-line" data-tone={cockpit.primaryRisk ? cockpit.primaryRisk.severity : "confirmed"}>
                  {cockpit.primaryRisk ? cockpit.primaryRisk.severity : "clear"}
                </span>
              </div>
              <p>{cockpit.primaryRisk ? cockpit.primaryRisk.description : cockpit.watchLine}</p>
              {cockpit.primaryRisk ? <span>{cockpit.watchLine}</span> : null}
            </div>

            <div className="preview-handoff-card">
              <span>Next handoff</span>
              <strong>{cockpit.handoffLine}</strong>
            </div>
          </aside>
        </div>
      </details>

      <details className="preview-deep-layers">
        <summary>
          <span>{t("Production intelligence")}</span>
          <small>{t("Open role, risk, cue, and timeline context only when you need the deeper layers.")}</small>
        </summary>

        <div className="preview-deep-layers-content">
          <MomentInspector intelligence={momentIntelligence} />

          <div className="preview-intelligence-strip">
            <div>
              <span>Active risks</span>
              <strong>{risks.length}</strong>
              <small>{resolvedCount} resolved in this browser</small>
            </div>
            <div>
              <span>Readiness score</span>
              <strong>{momentIntelligence.readinessScore}%</strong>
              <small>{momentIntelligence.readiness}</small>
            </div>
            <div>
              <span>Director focus</span>
              <strong>{cockpit.directorTitle}</strong>
              <small>Role-specific view is one click away</small>
            </div>
            <div>
              <span>Decision queue</span>
              <strong>{momentIntelligence.decisionQueue.length}</strong>
              <small>items for this moment</small>
            </div>
          </div>

          <div className="preview-detail-dock">
            <div className="preview-linked-moments preview-dock-card">
              <span>Timeline Layer</span>
              {relatedTimeline.map((item) => (
                <p key={item.id}>
                  <strong>{item.time}</strong> {item.title}
                </p>
              ))}
            </div>

            <div className="preview-linked-moments preview-dock-card">
              <span>Production Layer</span>
              <p>
                <strong>{phase.responsiblePerson}</strong> owns this moment as {phase.responsibleRole}.
              </p>
              <p>{cockpit.musicLabel}</p>
            </div>

            <div className="preview-linked-moments preview-dock-card">
              <span>Program Layer</span>
              {cockpit.speechLabels.length > 0 ? (
                cockpit.speechLabels.map((label) => <p key={label}>{label}</p>)
              ) : (
                <p>No speech or secret layer is attached to this phase.</p>
              )}
            </div>

            <div className="preview-linked-moments preview-dock-card">
              <span>Context Links</span>
              {cockpit.supportActions.map((action) => (
                <p key={action.label}>
                  <a href={action.href}>{action.label}</a>
                  <small>{action.detail}</small>
                </p>
              ))}
            </div>
          </div>
        </div>
      </details>

    </section>
  );
}

function getInitials(value: string) {
  return value
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatStatus(value: string) {
  return value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
