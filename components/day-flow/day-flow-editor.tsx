"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionDock } from "@/components/action/action-dock";
import { MomentInspector } from "@/components/moment/moment-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioCommand } from "@/components/ui/studio-command";
import { FlowAnalysis } from "@/components/wedding/flow-analysis";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import {
  applyProductionActionToTimeline,
  getGuestActionUpdates,
  getMusicCueActionUpdates,
  getSpeechActionUpdates,
  type ProductionAction
} from "@/lib/action-engine";
import {
  clearStoredTimeline,
  createTimelineDraft,
  readStoredTimeline,
  writeStoredTimeline
} from "@/lib/local-project-store";
import { buildMomentIntelligence, type MomentIntelligence } from "@/lib/moment-intelligence";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { applyRiskResolutionToTimeline, getRiskResolutionRecipeForRisk } from "@/lib/risk-resolution";
import { useLocalProject } from "@/lib/use-local-project";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { previewPhases, timelineItems } from "@/lib/wedding-data";
import type { PreviewPhase, RiskItem, RiskSeverity, TimelineItem, Visibility } from "@/lib/wedding-types";

const visibilityOptions: Visibility[] = ["everyone", "couple", "toastmaster", "planner", "vendor", "secret"];
const riskOptions: Array<RiskSeverity | "none"> = ["none", "low", "medium", "high"];
type AppliedActionStatus = {
  actionId: string;
  label: string;
};

export function DayFlowEditor() {
  const hasLoadedStoredProject = useRef(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [project, setProject] = useState(() => createSampleProjectState());
  const [activeResolveRiskId, setActiveResolveRiskId] = useState<string | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<AppliedActionStatus | null>(null);
  const {
    assignGuestToTable,
    dinnerTables,
    guests,
    musicCues: localMusicCues,
    speeches: localSpeeches,
    updateGuest,
    updateMusicCue,
    updateSpeech
  } = useLocalProject();
  const { resolvedRiskIds, resolveRisk } = useRiskResolutions();

  useEffect(() => {
    const loadStoredProject = window.setTimeout(() => {
      const incomingResolve = readIncomingResolveParams();
      const stored = readStoredTimeline();
      const loadedItems = stored?.timelineItems ?? createTimelineDraft(timelineItems);
      hasLoadedStoredProject.current = true;

      setProject({
        items: loadedItems,
        selectedId: getInitialSelectedId(loadedItems, incomingResolve.focusId),
        updatedAt: stored?.updatedAt
      });

      setActiveResolveRiskId(incomingResolve.riskId);
      setHasMounted(true);
    }, 0);

    return () => window.clearTimeout(loadStoredProject);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredProject.current) {
      return;
    }

    writeStoredTimeline(project.items);
  }, [project.items]);

  const selectedItem = useMemo(
    () => project.items.find((item) => item.id === project.selectedId) ?? project.items[0],
    [project.items, project.selectedId]
  );
  const rawRisks = useMemo(
    () =>
      analyzeWeddingFlow({
        timeline: project.items,
        cues: localMusicCues,
        speechItems: localSpeeches,
        guestItems: guests,
        tables: dinnerTables
      }),
    [dinnerTables, guests, localMusicCues, localSpeeches, project.items]
  );
  const risks = useMemo(() => filterResolvedRisks(rawRisks, resolvedRiskIds), [rawRisks, resolvedRiskIds]);
  const selectedRisks = useMemo(
    () => (selectedItem ? getRisksForTimelineItem(risks, selectedItem.id) : []),
    [risks, selectedItem]
  );
  const activeResolveRisk = useMemo(
    () =>
      (activeResolveRiskId ? rawRisks.find((risk) => risk.id === activeResolveRiskId) : selectedRisks[0]) ?? null,
    [activeResolveRiskId, rawRisks, selectedRisks]
  );
  const activeResolutionRecipe = activeResolveRisk ? getRiskResolutionRecipeForRisk(activeResolveRisk) : null;
  const isActiveRiskResolved = activeResolveRisk ? resolvedRiskIds.includes(activeResolveRisk.id) : false;
  const phases = useMemo(() => Array.from(new Set(project.items.map((item) => item.phase))), [project.items]);
  const saveStatus = hasMounted && project.updatedAt ? `Saved locally ${formatSavedAt(project.updatedAt)}` : "Autosave ready";
  const momentEntries = useMemo(
    () =>
      previewPhases.map((phase, phaseIndex) => {
        const relatedTimeline = getTimelineItemsForPhase(project.items, phase);
        const intelligence = buildMomentIntelligence({
          cues: localMusicCues,
          dinnerTables,
          guests,
          nextPhase: previewPhases[phaseIndex + 1],
          phase,
          phaseIndex,
          relatedTimeline,
          risks,
          speeches: localSpeeches,
          totalPhases: previewPhases.length
        });

        return {
          intelligence,
          phase,
          phaseIndex,
          relatedTimeline
        };
      }),
    [dinnerTables, guests, localMusicCues, localSpeeches, project.items, risks]
  );
  const timelineMomentMap = useMemo(() => {
    const nextMap = new Map<string, MomentIntelligence>();

    momentEntries.forEach((entry) => {
      entry.relatedTimeline.forEach((item) => {
        nextMap.set(item.id, entry.intelligence);
      });
    });

    return nextMap;
  }, [momentEntries]);
  const selectedMomentEntry = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return momentEntries.find((entry) => entry.phase.relatedTimelineItemIds.includes(selectedItem.id)) ?? null;
  }, [momentEntries, selectedItem]);
  const selectedMomentIntelligence = useMemo(() => {
    if (selectedMomentEntry) {
      return selectedMomentEntry.intelligence;
    }

    if (!selectedItem) {
      return null;
    }

    const fallbackPhase = createFallbackPreviewPhase(selectedItem);

    return buildMomentIntelligence({
      cues: localMusicCues,
      dinnerTables,
      guests,
      phase: fallbackPhase,
      phaseIndex: 0,
      relatedTimeline: [selectedItem],
      risks,
      speeches: localSpeeches,
      totalPhases: 1
    });
  }, [dinnerTables, guests, localMusicCues, localSpeeches, risks, selectedItem, selectedMomentEntry]);
  const fixQueue = useMemo(
    () =>
      momentEntries
        .filter((entry) => entry.intelligence.readiness !== "ready")
        .sort(compareMomentPriority)
        .slice(0, 3),
    [momentEntries]
  );
  const readyMomentCount = momentEntries.filter((entry) => entry.intelligence.readiness === "ready").length;

  function updateSelectedItem(updates: Partial<TimelineItem>) {
    if (!selectedItem) {
      return;
    }

    setActionStatus(null);
    setProject((currentProject) => ({
      ...currentProject,
      items: currentProject.items.map((item) => (item.id === selectedItem.id ? { ...item, ...updates } : item)),
      updatedAt: new Date().toISOString()
    }));
  }

  function resetTimeline() {
    const freshDraft = createTimelineDraft(timelineItems);
    clearStoredTimeline();
    setActiveResolveRiskId(null);
    setResolutionStatus(null);
    setActionStatus(null);
    setProject({
      items: freshDraft,
      selectedId: freshDraft[0]?.id ?? "",
      updatedAt: new Date().toISOString()
    });
  }

  function applyActiveResolution() {
    if (!activeResolveRisk || !activeResolutionRecipe) {
      return;
    }

    setProject((currentProject) => ({
      items: applyRiskResolutionToTimeline(currentProject.items, activeResolutionRecipe),
      selectedId: activeResolutionRecipe.timelineItemId,
      updatedAt: new Date().toISOString()
    }));
    resolveRisk(activeResolveRisk.id);
    setActiveResolveRiskId(activeResolveRisk.id);
    setResolutionStatus(activeResolutionRecipe.resolvedLabel);
    setActionStatus(null);
  }

  function applyUnifiedAction(action: ProductionAction) {
    let didApply = false;

    if (action.timelineItemId || action.timelineNoteToAppend || action.timelineUpdates) {
      setProject((currentProject) => ({
        ...currentProject,
        items: applyProductionActionToTimeline(currentProject.items, action),
        selectedId: action.timelineItemId ?? currentProject.selectedId,
        updatedAt: new Date().toISOString()
      }));
      didApply = true;
    }

    if (action.musicCueId) {
      const cue = localMusicCues.find((item) => item.id === action.musicCueId);

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
      const speech = localSpeeches.find((item) => item.id === action.speechId);

      if (speech) {
        updateSpeech(action.speechId, getSpeechActionUpdates(speech, action));
        didApply = true;
      }
    }

    if (action.riskId) {
      resolveRisk(action.riskId);
    }

    setActiveResolveRiskId(null);
    setResolutionStatus(action.successLabel);
    setActionStatus({
      actionId: action.id,
      label: didApply ? action.successLabel : "Open the connected studio to finish this action."
    });
  }

  function selectMomentFromQueue(phase: PreviewPhase) {
    const focusId = phase.relatedTimelineItemIds.find((id) => project.items.some((item) => item.id === id));

    if (!focusId) {
      return;
    }

    setProject((currentProject) => ({
      ...currentProject,
      selectedId: focusId
    }));
    setActiveResolveRiskId(null);
    setResolutionStatus(null);
    setActionStatus(null);
  }

  return (
    <div className="two-column day-flow-editor">
      <section>
        <StudioCommand
          actions={[
            { href: "/preview", label: "Preview Wedding Day" },
            { label: "Reset timeline", onClick: resetTimeline, variant: "secondary" }
          ]}
          description="Select one moment, apply the best repair, and keep the whole day synchronized from a single living timeline."
          eyebrow="Day Flow Studio"
          metrics={[
            { label: "Active moment", value: selectedItem?.title ?? "No moment selected" },
            { label: "Fix queue", tone: fixQueue.length > 0 ? "medium" : "confirmed", value: fixQueue.length > 0 ? `${fixQueue.length} to review` : "Ready" },
            { label: "Open risks", tone: risks.length > 0 ? "medium" : "confirmed", value: `${risks.length}` },
            { label: "Ready moments", tone: readyMomentCount === momentEntries.length ? "confirmed" : "low", value: `${readyMomentCount}/${momentEntries.length}` }
          ]}
          status={{ label: saveStatus, tone: "confirmed" }}
          title="Repair the wedding day from one selected moment."
        >
          {fixQueue.length > 0 ? (
            <div className="day-flow-best-repair" aria-label="Highest impact moment repair">
              <button
                className="studio-command-queue-item"
                onClick={() => selectMomentFromQueue(fixQueue[0].phase)}
                type="button"
              >
                <span>{String(fixQueue[0].phaseIndex + 1).padStart(2, "0")}</span>
                <strong>{fixQueue[0].phase.title}</strong>
                <small>{fixQueue[0].intelligence.primaryAction.label}</small>
              </button>
              <small>{fixQueue.length - 1 > 0 ? `${fixQueue.length - 1} more moments in the repair queue` : "This is the only moment that needs review."}</small>
            </div>
          ) : (
            <p className="card-copy">Every preview moment is ready to rehearse from the current local plan.</p>
          )}
        </StudioCommand>

        <div className="editable-timeline" aria-label="Editable wedding day timeline">
          {project.items.map((item) => {
            const isSelected = item.id === selectedItem?.id;
            const itemIntelligence = timelineMomentMap.get(item.id);

            return (
              <button
                aria-pressed={isSelected}
                className="editable-timeline-card"
                data-selected={isSelected}
                key={item.id}
                onClick={() => {
                  setActionStatus(null);
                  setProject((currentProject) => ({
                    ...currentProject,
                    selectedId: item.id
                  }));
                }}
                onFocus={() => {
                  if (item.id !== activeResolutionRecipe?.timelineItemId) {
                    setActiveResolveRiskId(null);
                    setResolutionStatus(null);
                    setActionStatus(null);
                  }
                }}
                type="button"
              >
                <span className="timeline-time">{item.time}</span>
                <span className="editable-timeline-body">
                  <span className="summary-between">
                    <strong>{item.title}</strong>
                    {itemIntelligence ? (
                      <Badge tone={itemIntelligence.readinessTone}>{itemIntelligence.readinessScore}%</Badge>
                    ) : null}
                  </span>
                  <span className="timeline-meta">
                    {item.location} · {item.responsiblePerson}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <details className="day-flow-detail-drawer">
          <summary>
            <span>Studio Workflow</span>
            <small>Open the full planning sequence when you want to see how this repair fits the wider studio.</small>
          </summary>
          <div className="day-flow-detail-drawer-content">
            <StudioWorkflow activeStep="flow" />
          </div>
        </details>
      </section>

      <aside className="page-grid">
        {activeResolutionRecipe && activeResolveRisk ? (
          <Card className="resolve-mode-card" data-resolved={isActiveRiskResolved}>
            <CardContent>
              <div className="summary-between">
                <div>
                  <p className="eyebrow">Suggested fix</p>
                  <h3 className="card-title">{activeResolutionRecipe.title}</h3>
                </div>
                <Badge tone={isActiveRiskResolved ? "confirmed" : activeResolveRisk.severity}>
                  {isActiveRiskResolved ? "resolved" : activeResolveRisk.severity}
                </Badge>
              </div>
              <p className="card-copy">{activeResolutionRecipe.description}</p>
              <Button disabled={isActiveRiskResolved} onClick={applyActiveResolution} size="small">
                {isActiveRiskResolved ? activeResolutionRecipe.resolvedLabel : activeResolutionRecipe.primaryActionLabel}
              </Button>
              <span aria-live="polite" className="copy-status">
                {resolutionStatus ?? "Saves locally and updates the connected views."}
              </span>
            </CardContent>
          </Card>
        ) : selectedMomentIntelligence ? (
          <ActionDock
            action={selectedMomentIntelligence.primaryAction}
            onApply={applyUnifiedAction}
            status={formatActionStatus(actionStatus, selectedMomentIntelligence.primaryAction.id)}
          />
        ) : null}

        <details className="day-flow-detail-drawer">
          <summary>
            <span>Moment Details</span>
            <small>Open readiness details, editing fields, and full flow analysis only when you need deeper control.</small>
          </summary>

          <div className="day-flow-detail-drawer-content">
            {selectedMomentIntelligence ? (
              <div className="day-flow-moment-inspector">
                <MomentInspector intelligence={selectedMomentIntelligence} />
              </div>
            ) : null}

            {selectedItem ? (
              <Card className="timeline-editor-card">
                <CardContent>
                  <p className="eyebrow">Selected Moment</p>
                  <h3 className="card-title">{selectedItem.title}</h3>
                  <div className="form-grid timeline-editor-form">
                    <label className="field">
                      <span>Time</span>
                      <input
                        onChange={(event) => updateSelectedItem({ time: event.target.value })}
                        value={selectedItem.time}
                      />
                    </label>
                    <label className="field">
                      <span>Title</span>
                      <input
                        onChange={(event) => updateSelectedItem({ title: event.target.value })}
                        value={selectedItem.title}
                      />
                    </label>
                    <label className="field">
                      <span>Phase</span>
                      <input
                        list="timeline-phases"
                        onChange={(event) => updateSelectedItem({ phase: event.target.value })}
                        value={selectedItem.phase}
                      />
                      <datalist id="timeline-phases">
                        {phases.map((phase) => (
                          <option key={phase} value={phase} />
                        ))}
                      </datalist>
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input
                        onChange={(event) => updateSelectedItem({ location: event.target.value })}
                        value={selectedItem.location}
                      />
                    </label>
                    <label className="field">
                      <span>Responsible role</span>
                      <input
                        onChange={(event) => updateSelectedItem({ responsibleRole: event.target.value })}
                        value={selectedItem.responsibleRole}
                      />
                    </label>
                    <label className="field">
                      <span>Responsible person</span>
                      <input
                        onChange={(event) => updateSelectedItem({ responsiblePerson: event.target.value })}
                        value={selectedItem.responsiblePerson}
                      />
                    </label>
                    <label className="field">
                      <span>Visibility</span>
                      <select
                        onChange={(event) => updateSelectedItem({ visibility: event.target.value as Visibility })}
                        value={selectedItem.visibility}
                      >
                        {visibilityOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatOption(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Risk level</span>
                      <select
                        onChange={(event) => {
                          const value = event.target.value as RiskSeverity | "none";
                          updateSelectedItem({ riskLevel: value === "none" ? undefined : value });
                        }}
                        value={selectedItem.riskLevel ?? "none"}
                      >
                        {riskOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatOption(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Duration minutes</span>
                      <input
                        min={0}
                        onChange={(event) =>
                          updateSelectedItem({
                            durationMinutes: event.target.value ? Number(event.target.value) : undefined
                          })
                        }
                        type="number"
                        value={selectedItem.durationMinutes ?? ""}
                      />
                    </label>
                    <label className="field timeline-notes-field">
                      <span>Production notes</span>
                      <textarea
                        onChange={(event) => updateSelectedItem({ notes: event.target.value })}
                        rows={5}
                        value={selectedItem.notes}
                      />
                    </label>
                  </div>
                  {selectedRisks.length > 0 ? (
                    <div className="selected-risk-note">
                      <Badge tone={selectedRisks[0].severity}>{selectedRisks[0].severity}</Badge>
                      <p>{selectedRisks[0].description}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <FlowAnalysis risks={risks} />
          </div>
        </details>
      </aside>
    </div>
  );
}

function formatOption(value: string) {
  return value
    .replaceAll("-", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatActionStatus(status: AppliedActionStatus | null, currentActionId: string) {
  if (!status) {
    return null;
  }

  return status.actionId === currentActionId ? status.label : `Last applied: ${status.label}`;
}

function createSampleProjectState() {
  const items = createTimelineDraft(timelineItems);

  return {
    items,
    selectedId: items[0]?.id ?? "",
    updatedAt: undefined as string | undefined
  };
}

function readIncomingResolveParams() {
  if (typeof window === "undefined") {
    return {
      focusId: null,
      riskId: null
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    focusId: params.get("focus"),
    riskId: params.get("resolve")
  };
}

function getInitialSelectedId(items: TimelineItem[], focusId: string | null) {
  if (focusId && items.some((item) => item.id === focusId)) {
    return focusId;
  }

  return items[0]?.id ?? "";
}

function getRisksForTimelineItem(risks: RiskItem[], timelineItemId: string) {
  return risks.filter((risk) => {
    const recipe = getRiskResolutionRecipeForRisk(risk);

    return risk.relatedEntityId === timelineItemId || recipe?.timelineItemId === timelineItemId;
  });
}

function getTimelineTitle(items: TimelineItem[], timelineItemId: string) {
  const item = items.find((timelineItem) => timelineItem.id === timelineItemId);

  return item ? `${item.time} - ${item.title}` : "Timeline moment";
}

function getTimelineItemsForPhase(items: TimelineItem[], phase: PreviewPhase) {
  return phase.relatedTimelineItemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter((item): item is TimelineItem => Boolean(item));
}

function createFallbackPreviewPhase(item: TimelineItem): PreviewPhase {
  return {
    id: `timeline-moment-${item.id}`,
    title: item.title,
    timeRange: item.time,
    location: item.location,
    summary: item.notes,
    involvedPeople: [item.responsiblePerson],
    responsibleRole: item.responsibleRole,
    responsiblePerson: item.responsiblePerson,
    musicCueId: item.musicCueId,
    relatedTimelineItemIds: [item.id]
  };
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

function formatSavedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "just now";
  }

  return date.toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit"
  });
}
