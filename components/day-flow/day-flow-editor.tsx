"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionDock } from "@/components/action/action-dock";
import { MomentInspector } from "@/components/moment/moment-inspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
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
import { useTranslation } from "@/lib/i18n";
import { derivePreviewPhases } from "@/lib/preview-phases";
import { useLocalProject } from "@/lib/use-local-project";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { previewPhases, timelineItems } from "@/lib/wedding-data";
import type { PreviewPhase, RiskItem, RiskSeverity, TimelineItem, Visibility } from "@/lib/wedding-types";
import { getMomentEndMinutes, formatMinutesAsTime, joinDetails, sortTimelineByTime } from "@/lib/utils";

const visibilityOptions: Visibility[] = ["everyone", "couple", "toastmaster", "planner", "vendor", "secret"];
const riskOptions: Array<RiskSeverity | "none"> = ["none", "low", "medium", "high"];
type AppliedActionStatus = {
  actionId: string;
  label: string;
};

export function DayFlowEditor() {
  const { t } = useTranslation();
  const hasLoadedStoredProject = useRef(false);
  // Guards the write-back so visiting /day-flow on a fresh install (no stored
  // project) does NOT silently persist the sample timeline as a real project.
  // We only write once a real project already exists, or the user actually edits
  // (project.items diverges from the sample seed we loaded).
  const storedProjectExisted = useRef(false);
  const seededItems = useRef<TimelineItem[] | null>(null);
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
    updateSpeech,
    wedding
  } = useLocalProject();
  const { resolvedRiskIds, resolveRisk } = useRiskResolutions();

  useEffect(() => {
    const loadStoredProject = window.setTimeout(() => {
      const incomingResolve = readIncomingResolveParams();
      const stored = readStoredTimeline();
      const loadedItems = stored?.timelineItems ?? createTimelineDraft(timelineItems);
      hasLoadedStoredProject.current = true;
      storedProjectExisted.current = stored != null;
      seededItems.current = loadedItems;

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

    // Fresh install + no user edit yet: the timeline is still the sample seed we
    // loaded, so persisting it would fabricate a project the couple never made.
    if (!storedProjectExisted.current && project.items === seededItems.current) {
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
        tables: dinnerTables,
        wedding
      }),
    [dinnerTables, guests, localMusicCues, localSpeeches, project.items, wedding]
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
  // Derive the phases from the LIVE edited timeline so the readiness badges,
  // the "next moment to review" strip, and the Moment Intelligence drawer track
  // what the couple actually edits (owner, time, location) — falling back to the
  // static sample only when the timeline is empty. Matches the overview + player.
  const activePhases = useMemo(() => {
    const derived = derivePreviewPhases(project.items);
    return derived.length > 0 ? derived : previewPhases;
  }, [project.items]);
  const momentEntries = useMemo(
    () =>
      activePhases.map((phase, phaseIndex) => {
        const relatedTimeline = getTimelineItemsForPhase(project.items, phase);
        const intelligence = buildMomentIntelligence({
          cues: localMusicCues,
          dinnerTables,
          guests,
          nextPhase: activePhases[phaseIndex + 1],
          phase,
          phaseIndex,
          relatedTimeline,
          risks,
          speeches: localSpeeches,
          totalPhases: activePhases.length
        });

        return {
          intelligence,
          phase,
          phaseIndex,
          relatedTimeline
        };
      }),
    [activePhases, dinnerTables, guests, localMusicCues, localSpeeches, project.items, risks]
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

  function addMoment() {
    setActionStatus(null);
    setProject((currentProject) => {
      const lastItem = currentProject.items[currentProject.items.length - 1];
      const newItem: TimelineItem = {
        id: `moment-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e5).toString(36)}`,
        time: lastItem?.time ?? "3:00 PM",
        title: "New moment",
        phase: lastItem?.phase ?? currentProject.items[0]?.phase ?? "Ceremony",
        location: lastItem?.location ?? "",
        responsibleRole: "",
        responsiblePerson: "",
        notes: "",
        visibility: "everyone",
        durationMinutes: 15
      };

      return {
        ...currentProject,
        // Sorted on ADD so the new moment visibly lands in the right place. Not
        // sorted on every keystroke while a time is being edited — rows jumping
        // under the cursor mid-typing is worse than settling a moment later, and
        // the store sorts on write regardless.
        items: sortTimelineByTime([...currentProject.items, newItem]),
        selectedId: newItem.id,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function removeMoment(id: string) {
    setActionStatus(null);
    setProject((currentProject) => {
      const remaining = currentProject.items.filter((item) => item.id !== id);
      const nextSelectedId = currentProject.selectedId === id ? (remaining[0]?.id ?? "") : currentProject.selectedId;

      return {
        ...currentProject,
        items: remaining,
        selectedId: nextSelectedId,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function applyActiveResolution() {
    if (!activeResolveRisk || !activeResolutionRecipe) {
      return;
    }

    // The recipe targets a moment by id. If the couple's timeline has no such
    // moment the map below is a no-op — so check for a real change before
    // reporting success and, above all, before hiding the warning. Resolving a
    // risk is permanent: it filters that id out of the studio, day flow, preview,
    // director boards and exports for good. Announcing "resolved" while changing
    // nothing was the worst thing this app did.
    const nextItems = applyRiskResolutionToTimeline(project.items, activeResolutionRecipe);
    const changed = nextItems.some((item, index) => item !== project.items[index]);

    if (!changed) {
      setResolutionStatus(t("This fix belongs to a moment that isn't in your timeline. Open the connected studio to finish it."));
      return;
    }

    setProject((currentProject) => ({
      ...currentProject,
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
      // Only count this as applied if a moment actually matched — the action's
      // target id may not exist in the couple's own timeline, in which case the
      // map below returns every item unchanged.
      const nextItems = applyProductionActionToTimeline(project.items, action);

      if (nextItems.some((item, index) => item !== project.items[index])) {
        setProject((currentProject) => ({
          ...currentProject,
          items: applyProductionActionToTimeline(currentProject.items, action),
          selectedId: action.timelineItemId ?? currentProject.selectedId,
          updatedAt: new Date().toISOString()
        }));
        didApply = true;
      }
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

      // The guest and table ids can come from the action's fallbacks, which are
      // sample ids — reseating requires that BOTH actually exist in this plan.
      if (guest && action.guestTableId && dinnerTables.some((table) => table.id === action.guestTableId)) {
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

    // Dismiss the warning ONLY when something really changed. This used to fire
    // unconditionally, so an action that matched nothing still hid its risk
    // everywhere, permanently, while the problem stayed in the data.
    if (action.riskId && didApply) {
      resolveRisk(action.riskId);
    }

    setActiveResolveRiskId(null);
    setResolutionStatus(didApply ? action.successLabel : null);
    setActionStatus({
      actionId: action.id,
      label: didApply ? action.successLabel : t("Nothing to change here yet — open the connected studio to finish this action.")
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
    <StudioRouteFrame
      eyebrow="Timeline"
      primaryAction={{ href: "/preview", label: "Preview the day" }}
      title="The shape of the day."
    >
      {fixQueue.length > 0 ? (
        <div className="module-decision-strip" aria-label={t("Next moment to review")}>
          <div>
            <span>{t("Next moment to review")}</span>
            <strong>{fixQueue[0].phase.title}</strong>
            <p>
              {t(fixQueue[0].intelligence.primaryAction.label)}
              {fixQueue.length - 1 > 0 ? ` · ${fixQueue.length - 1} ${t("more to review")}` : ""}
            </p>
          </div>
          <button className="button button-secondary" onClick={() => selectMomentFromQueue(fixQueue[0].phase)} type="button">
            {t("Focus")}
          </button>
        </div>
      ) : null}

      <div className="sr-only" aria-live="polite">
        {saveStatus}
      </div>

      <div className="two-column day-flow-editor">
      <section>
        <div className="editable-timeline" aria-label="Editable wedding day timeline">
          {project.items.map((item) => {
            const isSelected = item.id === selectedItem?.id;
            const itemIntelligence = timelineMomentMap.get(item.id);

            return (
              <div className="editable-timeline-row" key={item.id}>
                <button
                  aria-pressed={isSelected}
                  className="editable-timeline-card"
                  data-selected={isSelected}
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
                        <Badge tone={itemIntelligence.readinessTone}>{t(itemIntelligence.readinessShortLabel)}</Badge>
                      ) : null}
                    </span>
                    <span className="timeline-meta">
                      {joinDetails([item.location, item.responsiblePerson])}
                    </span>
                  </span>
                </button>
                <button
                  aria-label={t("Remove {title}", { title: item.title })}
                  className="editable-timeline-remove"
                  onClick={() => removeMoment(item.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} strokeWidth={1.7} />
                </button>
              </div>
            );
          })}

          <button className="editable-timeline-add" onClick={addMoment} type="button">
            <Plus aria-hidden="true" size={16} strokeWidth={1.9} />
            {t("Add moment")}
          </button>
        </div>

        <details className="day-flow-detail-drawer">
          <summary>
            <span>{t("Studio Workflow")}</span>
            <small>{t("Open the full planning sequence when you want to see how this repair fits the wider studio.")}</small>
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
                  <p className="eyebrow">{t("Suggested fix")}</p>
                  <h3 className="card-title">{t(activeResolutionRecipe.title)}</h3>
                </div>
                <Badge tone={isActiveRiskResolved ? "confirmed" : activeResolveRisk.severity}>
                  {isActiveRiskResolved ? t("resolved") : t(activeResolveRisk.severity)}
                </Badge>
              </div>
              <p className="card-copy">{t(activeResolutionRecipe.description)}</p>
              <Button disabled={isActiveRiskResolved} onClick={applyActiveResolution} size="small">
                {isActiveRiskResolved ? t(activeResolutionRecipe.resolvedLabel) : t(activeResolutionRecipe.primaryActionLabel)}
              </Button>
              <span aria-live="polite" className="copy-status">
                {resolutionStatus ?? t("Saves locally and updates the connected views.")}
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
            <span>{t("Moment Details")}</span>
            <small>{t("Open readiness details, editing fields, and full flow analysis only when you need deeper control.")}</small>
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
                  <p className="eyebrow">{t("Selected Moment")}</p>
                  <h3 className="card-title">{selectedItem.title}</h3>
                  <div className="form-grid timeline-editor-form">
                    <label className="field">
                      <span>{t("Time")}</span>
                      <input
                        onChange={(event) => updateSelectedItem({ time: event.target.value })}
                        value={selectedItem.time}
                      />
                    </label>
                    <label className="field">
                      <span>{t("Title")}</span>
                      <input
                        onChange={(event) => updateSelectedItem({ title: event.target.value })}
                        value={selectedItem.title}
                      />
                    </label>
                    <label className="field">
                      <span>{t("Phase")}</span>
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
                      <span>{t("Location")}</span>
                      <input
                        onChange={(event) => updateSelectedItem({ location: event.target.value })}
                        value={selectedItem.location}
                      />
                    </label>
                    <label className="field">
                      <span>{t("Responsible role")}</span>
                      <input
                        onChange={(event) => updateSelectedItem({ responsibleRole: event.target.value })}
                        value={selectedItem.responsibleRole}
                      />
                    </label>
                    <label className="field">
                      <span>{t("Responsible person")}</span>
                      <input
                        onChange={(event) => updateSelectedItem({ responsiblePerson: event.target.value })}
                        value={selectedItem.responsiblePerson}
                      />
                    </label>
                    <label className="field">
                      <span>{t("Visibility")}</span>
                      <select
                        onChange={(event) => updateSelectedItem({ visibility: event.target.value as Visibility })}
                        value={selectedItem.visibility}
                      >
                        {visibilityOptions.map((option) => (
                          <option key={option} value={option}>
                            {t(formatOption(option))}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{t("Risk level")}</span>
                      <select
                        onChange={(event) => {
                          const value = event.target.value as RiskSeverity | "none";
                          updateSelectedItem({ riskLevel: value === "none" ? undefined : value });
                        }}
                        value={selectedItem.riskLevel ?? "none"}
                      >
                        {riskOptions.map((option) => (
                          <option key={option} value={option}>
                            {t(formatOption(option))}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>{t("Duration minutes")}</span>
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
                      <span>{t("Production notes")}</span>
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
    </StudioRouteFrame>
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
