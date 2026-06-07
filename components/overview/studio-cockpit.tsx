"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActionDock } from "@/components/action/action-dock";
import { ProductionBrainPanel } from "@/components/overview/production-brain-panel";
import { RecoveryOrchestratorPanel } from "@/components/overview/recovery-orchestrator-panel";
import { RehearsalSimulatorPanel } from "@/components/overview/rehearsal-simulator-panel";
import { StudioGuidePanel } from "@/components/overview/studio-guide-panel";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  applyProductionActionToTimeline,
  getGuestActionUpdates,
  getMusicCueActionUpdates,
  getSpeechActionUpdates,
  type ProductionAction
} from "@/lib/action-engine";
import { buildMomentIntelligence, type MomentIntelligence } from "@/lib/moment-intelligence";
import { buildPreviewCockpitContext } from "@/lib/preview-cockpit";
import { buildProductionBrainInsight } from "@/lib/production-brain";
import { createRecoveryDecisionLogEntry, readRecoveryDecisionLog, writeRecoveryDecisionLog, type RecoveryDecisionLogEntry } from "@/lib/recovery-log";
import {
  applyRecoveryPlanToTimeline,
  buildRecoveryPlan,
  getRecoveryGuestUpdates,
  getRecoveryMusicCueUpdates,
  getRecoverySpeechUpdates
} from "@/lib/recovery-orchestrator";
import { getRehearsalScenarios, simulateWeddingRehearsal, type RehearsalScenarioId } from "@/lib/rehearsal-simulator";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { buildStudioGuide } from "@/lib/studio-guide";
import { useLocalProject } from "@/lib/use-local-project";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import { buildVendorIntelligence } from "@/lib/vendor-intelligence";
import { buildVendorSearchSuggestions, vendorSourcingCategories } from "@/lib/vendor-sourcing";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { buildWeddingGraph, getMomentGraphContext } from "@/lib/wedding-graph";
import { exportTypes, previewPhases, sampleWedding } from "@/lib/wedding-data";

type AppliedActionStatus = {
  actionId: string;
  label: string;
};

export function StudioCockpit() {
  const [hasRunSimulation, setHasRunSimulation] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<RehearsalScenarioId | null>(null);
  const [actionStatus, setActionStatus] = useState<AppliedActionStatus | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);
  const [recoveryLog, setRecoveryLog] = useState<RecoveryDecisionLogEntry[]>([]);
  const {
    assignGuestToTable,
    dinnerTables,
    guests,
    hasLocalProject,
    musicCues,
    speeches,
    timelineItems,
    updateGuest,
    updateMusicCue,
    updateSpeech,
    updateTimelineItems,
    vendorCandidates,
    wedding
  } = useLocalProject();
  const { resolvedRiskIds, resolveRisk } = useRiskResolutions();

  useEffect(() => {
    queueMicrotask(() => {
      setRecoveryLog(readRecoveryDecisionLog());
    });
  }, []);

  const risks = useMemo(
    () =>
      filterResolvedRisks(
        analyzeWeddingFlow({
          cues: musicCues,
          guestItems: guests,
          speechItems: speeches,
          tables: dinnerTables,
          timeline: timelineItems
        }),
        resolvedRiskIds
      ),
    [dinnerTables, guests, musicCues, resolvedRiskIds, speeches, timelineItems]
  );
  const momentEntries = useMemo(
    () =>
      previewPhases.map((phase, phaseIndex) => {
        const relatedTimeline = getTimelineItemsByIds(timelineItems, phase.relatedTimelineItemIds);
        const nextPhase = previewPhases[phaseIndex + 1];
        const intelligence = buildMomentIntelligence({
          cues: musicCues,
          dinnerTables,
          guests,
          nextPhase,
          phase,
          phaseIndex,
          relatedTimeline,
          risks,
          speeches,
          totalPhases: previewPhases.length
        });
        const cockpit = buildPreviewCockpitContext({
          cues: musicCues,
          nextPhase,
          phase,
          phaseIndex,
          relatedTimeline,
          risks,
          speechItems: speeches,
          totalPhases: previewPhases.length
        });

        return {
          cockpit,
          intelligence,
          phase,
          phaseIndex,
          relatedTimeline
        };
      }),
    [dinnerTables, guests, musicCues, risks, speeches, timelineItems]
  );
  const weddingGraph = useMemo(
    () =>
      buildWeddingGraph({
        dinnerTables,
        exports: exportTypes,
        guests,
        musicCues,
        risks,
        speeches,
        timeline: timelineItems
      }),
    [dinnerTables, guests, musicCues, risks, speeches, timelineItems]
  );
  const priorityEntry = useMemo(() => {
    return (
      momentEntries
        .filter((entry) => entry.intelligence.readiness !== "ready")
        .sort(compareMomentPriority)[0] ?? momentEntries[0]
    );
  }, [momentEntries]);
  const vendorSuggestions = useMemo(() => buildVendorSearchSuggestions(wedding), [wedding]);
  const vendorIntelligence = useMemo(
    () => buildVendorIntelligence(vendorSourcingCategories, vendorSuggestions, vendorCandidates),
    [vendorCandidates, vendorSuggestions]
  );
  const selectedEntry =
    (selectedPhaseId ? momentEntries.find((entry) => entry.phase.id === selectedPhaseId) : null) ??
    priorityEntry ??
    momentEntries[0];

  if (!selectedEntry) {
    return null;
  }

  const selectedPhase = selectedEntry.phase;
  const momentGraphContext = getMomentGraphContext(weddingGraph, selectedPhase);
  const productionBrain = buildProductionBrainInsight({
    action: selectedEntry.intelligence.primaryAction,
    context: momentGraphContext,
    intelligence: selectedEntry.intelligence,
    openRiskCount: risks.length
  });
  const rehearsalScenarios = getRehearsalScenarios(momentGraphContext, selectedEntry.intelligence);
  const activeScenarioId =
    selectedScenarioId && rehearsalScenarios.some((scenario) => scenario.id === selectedScenarioId)
      ? selectedScenarioId
      : rehearsalScenarios[0]?.id;
  const rehearsalSimulation = simulateWeddingRehearsal({
    action: selectedEntry.intelligence.primaryAction,
    context: momentGraphContext,
    intelligence: selectedEntry.intelligence,
    openRiskCount: risks.length,
    scenarioId: activeScenarioId,
    timeline: timelineItems
  });
  const recoveryPlan = buildRecoveryPlan({
    action: selectedEntry.intelligence.primaryAction,
    context: momentGraphContext,
    simulation: rehearsalSimulation
  });
  const currentActionApplied = actionStatus?.actionId === selectedEntry.intelligence.primaryAction.id;
  const currentRecoveryApplied = Boolean(recoveryStatus);
  const studioGuide = buildStudioGuide({
    actionApplied: currentActionApplied,
    entries: momentEntries,
    hasRunSimulation,
    openRiskCount: risks.length,
    productionBrain,
    readinessAverage: Math.round(
      momentEntries.reduce((total, entry) => total + entry.intelligence.readinessScore, 0) / momentEntries.length
    ),
    recoveryApplied: currentRecoveryApplied,
    recoveryPlan,
    rehearsalSimulation,
    selectedEntry
  });
  const readinessAverage = Math.round(
    momentEntries.reduce((total, entry) => total + entry.intelligence.readinessScore, 0) / momentEntries.length
  );
  const blockedCount = momentEntries.filter((entry) => entry.intelligence.readiness === "blocked").length;
  const reviewCount = momentEntries.filter((entry) => entry.intelligence.readiness === "review").length;
  const progress = Math.round(((selectedEntry.phaseIndex + 1) / previewPhases.length) * 100);

  function applyUnifiedAction(action: ProductionAction) {
    let didApply = false;

    if (action.timelineItemId || action.timelineNoteToAppend || action.timelineUpdates) {
      updateTimelineItems((currentItems) => applyProductionActionToTimeline(currentItems, action));
      didApply = true;
    }

    if (action.musicCueId) {
      const cue = musicCues.find((item) => item.id === action.musicCueId);

      if (cue) {
        updateMusicCue(action.musicCueId, getMusicCueActionUpdates(cue, action));
        didApply = true;
      }
    }

    if (action.guestId) {
      const guest = guests.find((item) => item.id === action.guestId);

      if (action.guestTableId) {
        assignGuestToTable(action.guestId, action.guestTableId);
        didApply = true;
      }

      if (guest && action.guestTagToAdd) {
        updateGuest(action.guestId, getGuestActionUpdates(guest, action));
        didApply = true;
      }
    }

    if (action.speechId) {
      const speech = speeches.find((item) => item.id === action.speechId);

      if (speech) {
        updateSpeech(action.speechId, getSpeechActionUpdates(speech, action));
        didApply = true;
      }
    }

    if (action.riskId) {
      resolveRisk(action.riskId);
    }

    setActionStatus({
      actionId: action.id,
      label: didApply ? action.successLabel : "Open the connected studio to finish this action."
    });
    setRecoveryStatus(null);
    setHasRunSimulation(false);
  }

  function applyRecoveryPlan() {
    const timelinePatches = recoveryPlan.timelinePatches.filter((patch) => patch.type === "timeline");
    const musicPatches = recoveryPlan.timelinePatches.filter((patch) => patch.type === "music");
    const speechPatches = recoveryPlan.timelinePatches.filter((patch) => patch.type === "speech");
    const guestPatches = recoveryPlan.timelinePatches.filter((patch) => patch.type === "guest");

    if (timelinePatches.length > 0) {
      updateTimelineItems((currentItems) => applyRecoveryPlanToTimeline(currentItems, recoveryPlan));
    }

    musicPatches.forEach((patch) => {
      const cue = musicCues.find((item) => item.id === patch.targetId);

      if (cue) {
        updateMusicCue(cue.id, getRecoveryMusicCueUpdates(cue, recoveryPlan));
      }
    });

    speechPatches.forEach((patch) => {
      const speech = speeches.find((item) => item.id === patch.targetId);

      if (speech) {
        updateSpeech(speech.id, getRecoverySpeechUpdates(speech, recoveryPlan));
      }
    });

    guestPatches.forEach((patch) => {
      const guest = guests.find((item) => item.id === patch.targetId);

      if (guest) {
        updateGuest(guest.id, getRecoveryGuestUpdates(guest, recoveryPlan));
      }
    });

    const entry = createRecoveryDecisionLogEntry(recoveryPlan);

    setRecoveryLog((currentLog) => {
      const nextLog = [entry, ...currentLog].slice(0, 20);
      writeRecoveryDecisionLog(nextLog);

      return nextLog;
    });
    setActionStatus(null);
    setRecoveryStatus("Recovery plan applied to the local wedding digital twin.");
    setHasRunSimulation(true);
  }

  function selectPhase(phaseIndex: number) {
    setSelectedPhaseId(previewPhases[phaseIndex]?.id ?? null);
    setSelectedScenarioId(null);
    setActionStatus(null);
    setRecoveryStatus(null);
    setHasRunSimulation(false);
  }

  function selectScenario(scenarioId: string) {
    const scenario = rehearsalScenarios.find((item) => item.id === scenarioId);

    setSelectedScenarioId(scenario?.id ?? null);
    setRecoveryStatus(null);
    setHasRunSimulation(false);
  }

  return (
    <section className="overview-cockpit" aria-label="Wedding Flow Studio cockpit">
      <div className="overview-cockpit-header">
        <div>
          <p className="eyebrow">Single Studio Cockpit</p>
          <h2>Preview, decide, and repair the day from one calm surface.</h2>
          <p>
            The wedding digital twin connects the visual moment, readiness, risk, role handoff, and best next move before the day unfolds.
          </p>
        </div>
        <div className="overview-cockpit-score">
          <span>Studio readiness</span>
          <strong>{readinessAverage}%</strong>
          <Progress label="Studio readiness" value={readinessAverage} />
          <small>{hasLocalProject ? "Live local project state" : "Sample project baseline"}</small>
        </div>
      </div>

      <div className="overview-cockpit-layout">
        <div className="overview-cockpit-stage" data-scene={selectedEntry.cockpit.sceneKind}>
          <div className="overview-stage-topline">
            <Badge>{selectedPhase.timeRange}</Badge>
            <Badge tone={selectedEntry.intelligence.readinessTone}>{selectedEntry.intelligence.readinessLabel}</Badge>
            <Badge tone={selectedEntry.cockpit.primaryRisk ? selectedEntry.cockpit.primaryRisk.severity : "confirmed"}>
              {selectedEntry.cockpit.primaryRisk ? selectedEntry.cockpit.primaryRisk.severity : "clear"}
            </Badge>
          </div>

          <div className="overview-stage-copy">
            <p className="eyebrow">Preview Wedding Day</p>
            <h3>{selectedPhase.title}</h3>
            <p>{selectedPhase.summary}</p>
          </div>

          <div className="overview-stage-map" aria-hidden="true">
            <span className="overview-map-zone overview-map-zone-primary">{selectedEntry.cockpit.sceneLabel}</span>
            <span className="overview-map-zone overview-map-zone-guest">Guest Journey</span>
            <span className="overview-map-zone overview-map-zone-vendor">Vendor Handoff</span>
            <span className="overview-map-flow" />
            {selectedPhase.involvedPeople.slice(0, 5).map((person, index) => (
              <span className="overview-person-token" data-index={index} key={person}>
                {getInitials(person)}
              </span>
            ))}
          </div>

          <div className="overview-moment-rail" aria-label="Preview moment selector">
            {momentEntries.map((entry) => (
              <button
                aria-label={`Preview ${entry.phase.title}`}
                aria-pressed={entry.phaseIndex === selectedEntry.phaseIndex}
                data-active={entry.phaseIndex === selectedEntry.phaseIndex}
                data-readiness={entry.intelligence.readiness}
                key={entry.phase.id}
                onClick={() => selectPhase(entry.phaseIndex)}
                type="button"
              >
                <span>{String(entry.phaseIndex + 1).padStart(2, "0")}</span>
                <strong>{entry.phase.title}</strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="overview-cockpit-stack">
          <StudioGuidePanel
            guide={studioGuide}
            onApplyAction={() => applyUnifiedAction(selectedEntry.intelligence.primaryAction)}
            onApplyRecovery={applyRecoveryPlan}
            onRunSimulation={() => setHasRunSimulation(true)}
          />

          <Link className="cockpit-vendor-card" href="/vendors">
            <div>
              <span>Vendor Intelligence</span>
              <strong>{vendorIntelligence.bestNextDecision?.nextAction ?? "All required vendor decisions are moving."}</strong>
              <p>
                {vendorIntelligence.candidateCount} saved candidates · {vendorIntelligence.bookedCount} booked ·{" "}
                {vendorIntelligence.openRequiredCount} required gaps
              </p>
            </div>
            <small>Open Production Sourcing</small>
          </Link>

          <section className="expert-layers" aria-label="Expert production layers">
            <div className="expert-layers-header">
              <div>
                <span>Expert layers</span>
                <strong>Open only when you need the deeper production view.</strong>
              </div>
              <Badge tone="neutral">Optional</Badge>
            </div>

            <details className="expert-layer">
              <summary>
                <span>Production Brain</span>
                <small>Why this moment matters</small>
              </summary>
              <ProductionBrainPanel insight={productionBrain} />
            </details>

            <details className="expert-layer">
              <summary>
                <span>Rehearsal Simulator</span>
                <small>Stress-test timing and handoffs</small>
              </summary>
              <RehearsalSimulatorPanel
                hasRun={hasRunSimulation}
                onRun={() => setHasRunSimulation(true)}
                onScenarioChange={selectScenario}
                scenarios={rehearsalScenarios}
                selectedScenarioId={rehearsalSimulation.scenario.id}
                simulation={rehearsalSimulation}
              />
            </details>

            <details className="expert-layer">
              <summary>
                <span>Recovery Orchestrator</span>
                <small>Apply coordinated recovery updates</small>
              </summary>
              <RecoveryOrchestratorPanel
                appliedStatus={recoveryStatus}
                latestEntry={recoveryLog[0] ?? null}
                onApply={applyRecoveryPlan}
                plan={recoveryPlan}
              />
            </details>

            <details className="expert-layer">
              <summary>
                <span>Unified Action Engine</span>
                <small>Direct technical action control</small>
              </summary>
              <ActionDock
                action={selectedEntry.intelligence.primaryAction}
                onApply={applyUnifiedAction}
                status={formatActionStatus(actionStatus, selectedEntry.intelligence.primaryAction.id)}
              />
            </details>
          </section>

        </aside>
      </div>

      <details className="cockpit-context-details">
        <summary>
          <span>Connected context</span>
          <small>Open owner, music, handoff, health, and decision details for the selected moment.</small>
        </summary>

        <div className="cockpit-context-content">
          <div className="overview-handoff-card">
            <span>Next handoff</span>
            <strong>{selectedEntry.cockpit.handoffLine}</strong>
            <p>{selectedEntry.cockpit.feelingLine}</p>
          </div>

          <div className="overview-health-card">
            <div>
              <span>Moments needing review</span>
              <strong>{reviewCount}</strong>
            </div>
            <div>
              <span>Blocked moments</span>
              <strong>{blockedCount}</strong>
            </div>
            <div>
              <span>Open risks</span>
              <strong>{risks.length}</strong>
            </div>
          </div>

          <div className="overview-cockpit-dock">
            <div>
              <span>Owner</span>
              <strong>{selectedPhase.responsiblePerson}</strong>
              <small>{selectedPhase.responsibleRole}</small>
            </div>
            <div>
              <span>Music</span>
              <strong>{selectedEntry.cockpit.musicCue?.songTitle ?? "No cue linked"}</strong>
              <small>{selectedEntry.cockpit.musicCue ? formatStatus(selectedEntry.cockpit.musicCue.status) : "No music handoff"}</small>
            </div>
            <div>
              <span>Director focus</span>
              <strong>{selectedEntry.cockpit.directorTitle}</strong>
              <small>Role board is connected</small>
            </div>
            <div>
              <span>Decision queue</span>
              <strong>{selectedEntry.intelligence.decisionQueue.length}</strong>
              <small>{selectedEntry.intelligence.primaryAction.label}</small>
            </div>
            <div>
              <span>Preview progress</span>
              <strong>{progress}%</strong>
              <small>
                {selectedEntry.phaseIndex + 1} of {previewPhases.length}
              </small>
            </div>
          </div>
        </div>
      </details>

      <div className="overview-cockpit-footer">
        <p>
          {sampleWedding.coupleNames} are building a real day-of production map, not a checklist. Each cockpit action keeps the plan, roles, cues, and exports connected.
        </p>
      </div>
    </section>
  );
}

function compareMomentPriority(
  left: { intelligence: MomentIntelligence },
  right: { intelligence: MomentIntelligence }
) {
  const readinessRank: Record<MomentIntelligence["readiness"], number> = {
    blocked: 0,
    review: 1,
    ready: 2
  };
  const rankDifference = readinessRank[left.intelligence.readiness] - readinessRank[right.intelligence.readiness];

  if (rankDifference !== 0) {
    return rankDifference;
  }

  return left.intelligence.readinessScore - right.intelligence.readinessScore;
}

function formatActionStatus(status: AppliedActionStatus | null, currentActionId: string) {
  if (!status) {
    return null;
  }

  return status.actionId === currentActionId ? status.label : `Last applied: ${status.label}`;
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
