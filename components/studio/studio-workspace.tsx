"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { buildProductionBrainInsight, type ProductionBrainInsight } from "@/lib/production-brain";
import {
  applyRecoveryPlanToTimeline,
  buildRecoveryPlan,
  getRecoveryGuestUpdates,
  getRecoveryMusicCueUpdates,
  getRecoverySpeechUpdates
} from "@/lib/recovery-orchestrator";
import { getRehearsalScenarios, simulateWeddingRehearsal, type RehearsalScenarioId, type RehearsalSimulation } from "@/lib/rehearsal-simulator";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { buildStudioGuide, type StudioGuide } from "@/lib/studio-guide";
import { useTranslation } from "@/lib/i18n";
import { useLocalProject } from "@/lib/use-local-project";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import { buildVendorIntelligence } from "@/lib/vendor-intelligence";
import { buildVendorSearchSuggestions, vendorSourcingCategories } from "@/lib/vendor-sourcing";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { buildWeddingGraph, getMomentGraphContext } from "@/lib/wedding-graph";
import { exportTypes, previewPhases } from "@/lib/wedding-data";

type AppliedActionStatus = {
  actionId: string;
  label: string;
};

export function StudioWorkspace() {
  const { t } = useTranslation();
  const [hasRunSimulation, setHasRunSimulation] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<RehearsalScenarioId | null>(null);
  const [actionStatus, setActionStatus] = useState<AppliedActionStatus | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);
  const {
    assignGuestToTable,
    dinnerTables,
    guests,
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
  const readinessAverage = Math.round(
    momentEntries.reduce((total, entry) => total + entry.intelligence.readinessScore, 0) / momentEntries.length
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
  const weddingGraph = useMemo(
    () =>
      buildWeddingGraph({
        dinnerTables,
        exports: exportTypes,
        guests,
        musicCues,
        risks,
        speeches,
        timeline: timelineItems,
        wedding
      }),
    [dinnerTables, guests, musicCues, risks, speeches, timelineItems, wedding]
  );

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
  const studioGuide = buildStudioGuide({
    actionApplied: currentActionApplied,
    entries: momentEntries,
    hasRunSimulation,
    openRiskCount: risks.length,
    productionBrain,
    readinessAverage,
    recoveryApplied: Boolean(recoveryStatus),
    recoveryPlan,
    rehearsalSimulation,
    selectedEntry
  });
  const blockedCount = momentEntries.filter((entry) => entry.intelligence.readiness === "blocked").length;
  const reviewCount = momentEntries.filter((entry) => entry.intelligence.readiness === "review").length;

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
      label: didApply ? action.successLabel : t("Open the connected studio to finish this action.")
    });
    setRecoveryStatus(null);
    setHasRunSimulation(false);
  }

  function applyRecoveryPlan() {
    recoveryPlan.timelinePatches
      .filter((patch) => patch.type === "music")
      .forEach((patch) => {
        const cue = musicCues.find((item) => item.id === patch.targetId);

        if (cue) {
          updateMusicCue(cue.id, getRecoveryMusicCueUpdates(cue, recoveryPlan));
        }
      });

    recoveryPlan.timelinePatches
      .filter((patch) => patch.type === "speech")
      .forEach((patch) => {
        const speech = speeches.find((item) => item.id === patch.targetId);

        if (speech) {
          updateSpeech(speech.id, getRecoverySpeechUpdates(speech, recoveryPlan));
        }
      });

    recoveryPlan.timelinePatches
      .filter((patch) => patch.type === "guest")
      .forEach((patch) => {
        const guest = guests.find((item) => item.id === patch.targetId);

        if (guest) {
          updateGuest(guest.id, getRecoveryGuestUpdates(guest, recoveryPlan));
        }
      });

    if (recoveryPlan.timelinePatches.some((patch) => patch.type === "timeline")) {
      updateTimelineItems((currentItems) => applyRecoveryPlanToTimeline(currentItems, recoveryPlan));
    }

    setActionStatus(null);
    setRecoveryStatus(t("Recovery plan applied to the local wedding digital twin."));
    setHasRunSimulation(true);
  }

  function selectPhase(phaseIndex: number) {
    setSelectedPhaseId(previewPhases[phaseIndex]?.id ?? null);
    setSelectedScenarioId(null);
    setActionStatus(null);
    setRecoveryStatus(null);
    setHasRunSimulation(false);
  }

  return (
    <section className="studio-workspace" aria-label={t("Unified Studio Workspace")}>
      <div className="studio-workspace-grid">
        <div className="studio-workspace-canvas studio-focus-canvas" data-scene={selectedEntry.cockpit.sceneKind}>
          <div className="studio-focus-hero">
            <div className="studio-focus-copy">
              <span>
                {selectedPhase.timeRange} · {selectedPhase.location}
              </span>
              <h2>{selectedPhase.title}</h2>
              <p>{selectedEntry.cockpit.feelingLine}</p>
            </div>

            <div className="studio-focus-status" aria-label={t("Selected moment status")}>
              <Badge tone={selectedEntry.intelligence.readinessTone}>{selectedEntry.intelligence.readinessLabel}</Badge>
              <Badge tone={selectedEntry.cockpit.healthTone}>{selectedEntry.cockpit.healthLabel}</Badge>
            </div>
          </div>

          <div className="studio-focus-stage" aria-label={t("Focused wedding day scene")}>
            <div className="studio-focus-visual" aria-hidden="true">
              <div className="studio-focus-atmosphere" />
              <span className="studio-focus-line" />
              <span className="studio-focus-zone studio-focus-zone-primary">{selectedEntry.cockpit.sceneLabel}</span>
              <span className="studio-focus-zone studio-focus-zone-guests">{t("Guests")}</span>
              <span className="studio-focus-zone studio-focus-zone-team">{t("Team")}</span>
              {selectedPhase.involvedPeople.slice(0, 5).map((person, index) => (
                <span className="studio-focus-person" data-index={index} key={person}>
                  {getInitials(person)}
                </span>
              ))}
            </div>

            <div className="studio-focus-brief" aria-label={t("Moment brief")}>
              <div>
                <span>{t("Owner")}</span>
                <strong>{selectedPhase.responsiblePerson}</strong>
                <small>{selectedPhase.responsibleRole}</small>
              </div>
              <div>
                <span>{t("Next handoff")}</span>
                <strong>{selectedEntry.cockpit.directorTitle}</strong>
                <small>{selectedEntry.cockpit.watchLine}</small>
              </div>
              <div>
                <span>{t("Music")}</span>
                <strong>{selectedEntry.cockpit.musicLabel}</strong>
                <small>{selectedEntry.cockpit.handoffLine}</small>
              </div>
            </div>
          </div>

          <nav className="studio-moment-strip studio-focus-filmstrip" aria-label={t("Wedding day moments")}>
            {momentEntries.map((entry) => (
              <button
                aria-label={t("Work on {title}", { title: entry.phase.title })}
                aria-pressed={entry.phaseIndex === selectedEntry.phaseIndex}
                data-active={entry.phaseIndex === selectedEntry.phaseIndex}
                data-readiness={entry.intelligence.readiness}
                key={entry.phase.id}
                onClick={() => selectPhase(entry.phaseIndex)}
                type="button"
              >
                <span>{entry.phaseIndex + 1}</span>
                <strong>{entry.phase.title}</strong>
                <small>{entry.phase.timeRange}</small>
              </button>
            ))}
          </nav>
        </div>

        <aside className="studio-workspace-guide">
          <OneDecisionPanel
            guide={studioGuide}
            productionBrain={productionBrain}
            rehearsalSimulation={rehearsalSimulation}
            onApplyAction={() => applyUnifiedAction(selectedEntry.intelligence.primaryAction)}
            onApplyRecovery={applyRecoveryPlan}
            onRunSimulation={() => setHasRunSimulation(true)}
          />

          <details className="studio-guide-drawer">
            <summary>
              <span>{t("Studio details")}</span>
              <small>{t("Vendor gaps, saved candidates, and local updates.")}</small>
            </summary>
            <div className="studio-guide-drawer-content">
              <Link className="cockpit-vendor-card" href="/vendors">
                <div>
                  <span>{t("Vendor Intelligence")}</span>
                  <strong>{vendorIntelligence.bestNextDecision?.nextAction ?? t("All required vendor decisions are moving.")}</strong>
                  <p>
                    {t("{candidates} saved candidates · {booked} booked · {gaps} required gaps", {
                      booked: vendorIntelligence.bookedCount,
                      candidates: vendorIntelligence.candidateCount,
                      gaps: vendorIntelligence.openRequiredCount
                    })}
                  </p>
                </div>
                <small>{t("Open Production Sourcing")}</small>
              </Link>

              {(actionStatus || recoveryStatus) && (
                <div className="studio-workspace-status" role="status">
                  <span>{t("Studio update")}</span>
                  <strong>{recoveryStatus ?? actionStatus?.label}</strong>
                </div>
              )}
            </div>
          </details>
        </aside>
      </div>

      <details className="studio-impact-details">
        <summary>
          <span>{t("Impact layers")}</span>
          <small>{t("Role, brief, guest, cue, and graph context for this moment.")}</small>
        </summary>

        <div className="studio-impact-grid">
          <ImpactColumn title={t("Affected roles")} items={selectedEntry.intelligence.affectedRoles.map((item) => item.label)} />
          <ImpactColumn title={t("Affected briefs")} items={selectedEntry.intelligence.affectedExports.map((item) => item.label)} />
          <ImpactColumn title={t("Missing signals")} items={selectedEntry.intelligence.missingSignals} />
          <ImpactColumn
            title={t("Current health")}
            items={[
              t("{count} moments need review", { count: reviewCount }),
              t("{count} moments are blocked", { count: blockedCount }),
              t("{count} open production risks", { count: risks.length })
            ]}
          />
          <ImpactColumn title={t("Guest journey")} items={[selectedEntry.intelligence.guestImpact.label, ...selectedEntry.intelligence.guestImpact.details]} />
          <ImpactColumn
            title={t("Production graph")}
            items={[
              productionBrain.graphSummary,
              t("{count} connected nodes", { count: momentGraphContext.graphNodeCount }),
              t("{count} connected edges", { count: momentGraphContext.graphEdgeCount })
            ]}
          />
        </div>
      </details>
    </section>
  );
}

function OneDecisionPanel({
  guide,
  onApplyAction,
  onApplyRecovery,
  onRunSimulation,
  productionBrain,
  rehearsalSimulation
}: {
  guide: StudioGuide;
  onApplyAction: () => void;
  onApplyRecovery: () => void;
  onRunSimulation: () => void;
  productionBrain: ProductionBrainInsight;
  rehearsalSimulation: RehearsalSimulation;
}) {
  const { t } = useTranslation();

  return (
    <section className="one-decision-panel" aria-label={t("One Decision Panel")}>
      <div className="one-decision-header">
        <div>
          <p className="eyebrow">{t("Next Best Move")}</p>
          <h2>{guide.title}</h2>
          <p>{guide.plainEnglish}</p>
        </div>
        <Badge tone={guide.urgencyTone}>{guide.urgencyLabel}</Badge>
      </div>

      <div className="one-decision-action one-decision-primary">
        <span>{t("Recommended action")}</span>
        <strong>{guide.primaryAction.label}</strong>
        <p>{guide.primaryAction.detail}</p>
        {renderDecisionAction(guide, onApplyAction, onApplyRecovery, onRunSimulation)}
      </div>

      <details className="one-decision-details">
        <summary>
          <span>{t("Decision reasoning")}</span>
          <small>{t("Confidence, impact, and rehearsal context.")}</small>
        </summary>

        <div className="one-decision-detail-grid">
          <div className="one-decision-confidence">
            <div>
              <span>{t("Confidence")}</span>
              <strong>{guide.confidenceScore}%</strong>
              <small>{guide.confidenceLabel}</small>
            </div>
            <Progress label={t("Decision confidence")} value={guide.confidenceScore} />
          </div>

          <div>
            <span>{t("What matters now")}</span>
            <ul>
              {guide.focusItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <span>{t("What will change")}</span>
            <ul>
              {productionBrain.impactPreview.slice(0, 3).map((impact) => (
                <li key={impact.label}>
                  <strong>{impact.label}:</strong> {impact.after}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span>{t("Rehearsal signal")}</span>
            <p>
              {t("{title}: {score}% day-feel score.", {
                score: rehearsalSimulation.dayFeelScore,
                title: rehearsalSimulation.scenario.title
              })}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}

function renderDecisionAction(
  guide: StudioGuide,
  onApplyAction: () => void,
  onApplyRecovery: () => void,
  onRunSimulation: () => void
) {
  if (guide.primaryAction.kind === "apply-action") {
    return <Button onClick={onApplyAction}>{guide.primaryAction.label}</Button>;
  }

  if (guide.primaryAction.kind === "run-simulation") {
    return <Button onClick={onRunSimulation}>{guide.primaryAction.label}</Button>;
  }

  if (guide.primaryAction.kind === "apply-recovery") {
    return <Button onClick={onApplyRecovery}>{guide.primaryAction.label}</Button>;
  }

  return <Button href={guide.primaryAction.href ?? "/preview"}>{guide.primaryAction.label}</Button>;
}

function ImpactColumn({ items, title }: { items: string[]; title: string }) {
  const { t } = useTranslation();
  const visibleItems = items.filter(Boolean).slice(0, 4);

  return (
    <div>
      <span>{title}</span>
      {visibleItems.length > 0 ? (
        <ul>
          {visibleItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{t("No connected items for this moment.")}</p>
      )}
    </div>
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

function getInitials(value: string) {
  return value
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
