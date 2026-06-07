"use client";

import { useEffect, useMemo, useState } from "react";
import { MomentInspector } from "@/components/moment/moment-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildMomentIntelligence } from "@/lib/moment-intelligence";
import { buildPreviewCockpitContext } from "@/lib/preview-cockpit";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { useLocalProject } from "@/lib/use-local-project";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
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
  const phase = previewPhases[index];
  const nextPhase = previewPhases[index + 1];
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
        phaseIndex: index,
        relatedTimeline,
        risks,
        speechItems: speeches,
        totalPhases: previewPhases.length
      }),
    [index, musicCues, nextPhase, phase, relatedTimeline, risks, speeches]
  );
  const momentIntelligence = useMemo(
    () =>
      buildMomentIntelligence({
        cues: musicCues,
        dinnerTables,
        guests,
        nextPhase,
        phase,
        phaseIndex: index,
        relatedTimeline,
        risks,
        speeches,
        totalPhases: previewPhases.length
      }),
    [dinnerTables, guests, index, musicCues, nextPhase, phase, relatedTimeline, risks, speeches]
  );
  const progress = Math.round(((index + 1) / previewPhases.length) * 100);
  const resolvedCount = resolvedRiskIds.length;
  const canGoPrevious = index > 0;
  const canGoNext = index < previewPhases.length - 1;
  const phaseRisks = cockpit.phaseRisks.length;
  const affectedRoles = momentIntelligence.affectedRoles.slice(0, 3);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setIndex((currentIndex) => {
        if (currentIndex >= previewPhases.length - 1) {
          setIsPlaying(false);
          return currentIndex;
        }

        return currentIndex + 1;
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isPlaying]);

  function goToPreviousMoment() {
    setIndex((currentIndex) => Math.max(0, currentIndex - 1));
    setIsPlaying(false);
  }

  function goToNextMoment() {
    setIndex((currentIndex) => Math.min(previewPhases.length - 1, currentIndex + 1));
    setIsPlaying(false);
  }

  return (
    <section className="preview-day-player preview-command-center" aria-label="Preview Wedding Day Command Center">
      <div className="preview-simulator-hero">
        <div className="preview-simulator-copy">
          <span>Wedding Day Simulator</span>
          <h2>{phase.title}</h2>
          <p>{cockpit.feelingLine}</p>
          <div className="preview-simulator-roles" aria-label="Active role handoff">
            {affectedRoles.map((role) => (
              <span key={role.id}>{role.label}</span>
            ))}
          </div>
        </div>

        <div className="preview-simulator-board" aria-label="Current preview state">
          <div>
            <span>Now</span>
            <strong>{phase.location}</strong>
            <small>{phase.timeRange}</small>
          </div>
          <div>
            <span>Next</span>
            <strong>{nextPhase?.title ?? "Final briefs"}</strong>
            <small>{nextPhase?.responsiblePerson ?? "Production team"}</small>
          </div>
          <div>
            <span>Watch</span>
            <strong>{cockpit.primaryRisk?.title ?? "Clean handoff"}</strong>
            <small>{phaseRisks > 0 ? `${phaseRisks} connected risk signals` : "No active scene risk"}</small>
          </div>
        </div>

        <div className="preview-hero-action" aria-label="Recommended preview action">
          <div>
            <span>Next Best Move</span>
            <strong>{momentIntelligence.primaryAction.label}</strong>
            <p>{momentIntelligence.primaryAction.detail}</p>
          </div>
          <Button href={momentIntelligence.primaryAction.href ?? "/day-flow"} size="small">
            Open Fix
          </Button>
        </div>

        <div className="preview-os-controls" aria-label="Preview controls">
          <div className="preview-os-progress">
            <span>{progress}% previewed</span>
            <strong>
              {index + 1} of {previewPhases.length}: {phase.title}
            </strong>
            <span className="preview-os-progress-bar" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </span>
          </div>

          <div className="preview-os-actions">
            <Badge tone={hasLocalProject ? "confirmed" : "neutral"}>{hasLocalProject ? "Live project" : "Sample project"}</Badge>
            <Badge tone={momentIntelligence.readinessTone}>{momentIntelligence.readinessLabel}</Badge>
            <label className="preview-jump-control">
              <span>Moment</span>
              <select
                aria-label="Choose preview moment"
                onChange={(event) => {
                  setIndex(Number(event.target.value));
                  setIsPlaying(false);
                }}
                value={index}
              >
                {previewPhases.map((previewPhase, phaseIndex) => (
                  <option key={previewPhase.id} value={phaseIndex}>
                    {previewPhase.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="preview-transport-actions">
              <button className="button button-secondary button-small" disabled={!canGoPrevious} onClick={goToPreviousMoment} type="button">
                Previous
              </button>
              <button
                aria-label={isPlaying ? "Pause wedding day preview" : "Play wedding day preview"}
                className={`button ${isPlaying ? "button-secondary" : "button-primary"} button-small`}
                onClick={() => setIsPlaying((currentValue) => !currentValue)}
                type="button"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button className="button button-secondary button-small" disabled={!canGoNext} onClick={goToNextMoment} type="button">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <ol className="preview-moment-rail preview-command-rail" aria-label="Wedding day preview sequence">
        {previewPhases.map((previewPhase, phaseIndex) => (
          <li data-active={phaseIndex === index} data-complete={phaseIndex < index} key={previewPhase.id}>
            <span>{phaseIndex + 1}</span>
            <small>{previewPhase.title}</small>
          </li>
        ))}
      </ol>

      <details className="preview-scene-details">
        <summary>
          <span>Scene Board</span>
          <small>Open the map, owner, music, risks, and handoff details only when you need production depth.</small>
        </summary>

        <div className="preview-command-layout">
          <div className="preview-cinema-stage" data-scene={cockpit.sceneKind}>
            <div className="preview-stage-topline">
              <Badge>{phase.timeRange}</Badge>
              <Badge tone={cockpit.primaryRisk ? cockpit.primaryRisk.severity : "confirmed"}>
                {cockpit.primaryRisk ? `${cockpit.primaryRisk.severity} risk` : "Scene clear"}
              </Badge>
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
              <h2>{phase.title}</h2>
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
                <Badge tone={cockpit.primaryRisk ? cockpit.primaryRisk.severity : "confirmed"}>
                  {cockpit.primaryRisk ? cockpit.primaryRisk.severity : "clear"}
                </Badge>
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
          <span>Production intelligence</span>
          <small>Open role, risk, cue, and timeline context only when you need the deeper layers.</small>
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
