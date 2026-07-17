"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  Compass,
  Expand,
  Minus,
  MoreHorizontal,
  Move,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Share2,
  SunMedium
} from "lucide-react";
import { MobileNavigation } from "@/components/app-shell/navigation";
import { SavedChip } from "@/components/app-shell/saved-chip";
import { StudioInspector, type SceneWarning, type StudioTool } from "@/components/overview/studio-inspector";
import { StudioPlayback } from "@/components/overview/studio-playback";
import { PreviewWalkthrough } from "@/components/preview/preview-walkthrough";
import { CeremonyScene, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { useTranslation } from "@/lib/i18n";
import { clearStoredProject } from "@/lib/local-project-store";
import { derivePreviewPhases, isReceptionPhase, waypointIndexForPhase } from "@/lib/preview-phases";
import { confirmAndBackupBeforeReset } from "@/lib/project-backup";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { buildShareSnapshot, buildShareUrl, encodeSnapshot } from "@/lib/share-snapshot";
import { useLocalProject } from "@/lib/use-local-project";
import { formatWeddingDate } from "@/lib/utils";
import { previewPhases, sampleWedding } from "@/lib/wedding-data";
import { clearStoredWeddingStudioLayout, readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  clampSceneOffset,
  createWeddingStudioPlanFromWedding,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  getEditableObjectsForStep,
  studioEditableObjects,
  type StudioPlanningStepId,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type StudioVenueType,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

// The three scenes of the day, per the owner's brief: the church ceremony, an
// open-air ceremony, and the dinner — all live 3D.
type HeroScene = "ceremony" | "ceremony-outdoor" | "reception";

// The workspace has exactly two modes: build the scene, or watch the day.
// The full edit interface and the full playback interface never show together.
type StudioMode = "edit" | "preview";

const RAIL_TOOLS: Array<{ icon: typeof Compass; id: StudioTool; label: string }> = [
  { icon: Compass, id: "overview", label: "Scene overview" },
  { icon: Move, id: "objects", label: "Objects" },
  { icon: Palette, id: "style", label: "Style" },
  { icon: Armchair, id: "seating", label: "Seating" },
  { icon: SunMedium, id: "lighting", label: "Lighting" }
];

export function OverviewDashboard() {
  const localProject = useLocalProject();
  const { language, setLanguage, t } = useTranslation();
  const canvasRef = useRef<HTMLElement & HTMLDivElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);

  const [mode, setMode] = useState<StudioMode>("edit");
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [sceneEdits, setSceneEdits] = useState<StudioSceneEdits>(defaultStudioSceneEdits);
  const [heroScene, setHeroScene] = useState<HeroScene>("ceremony");
  const [dimension, setDimension] = useState<"2d" | "3d">("3d");
  const [lighting, setLighting] = useState<SceneLighting>("day");
  const [zoom, setZoom] = useState(1);
  const [activeTool, setActiveTool] = useState<StudioTool>("overview");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [selectedObjectId, setSelectedObjectId] = useState<StudioSceneObjectId>("focalPoint");
  const [syncedProjectKey, setSyncedProjectKey] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeWedding = localProject.hasLocalProject ? localProject.wedding : sampleWedding;
  // The live guest list is the single source of truth for headcount, so the 3D
  // capacity fills to the real invited count — not a separate slider value.
  const capacity = useMemo(
    () => calculateWeddingStudioCapacity({ ...plan, guestCount: localProject.guests.length }),
    [plan, localProject.guests.length]
  );
  const sceneStep: StudioPlanningStepId = heroScene === "reception" ? "reception" : "preview";
  const sceneKind: "ceremony" | "reception" = heroScene === "reception" ? "reception" : "ceremony";
  const editableObjectIds = useMemo(() => getEditableObjectsForStep(sceneStep), [sceneStep]);
  const activeSelectedObjectId = editableObjectIds.includes(selectedObjectId) ? selectedObjectId : (editableObjectIds[0] ?? "focalPoint");
  // Three fixed scenes: the church, an open-air (garden) ceremony, and the
  // evening dinner. Independent of the wedding's own saved venue so the studio
  // stays a clean 3-scene gallery.
  const sceneVenueType: StudioVenueType = heroScene === "ceremony" ? "church" : "garden";

  const invitedGuests = localProject.guests.length;
  const seatedGuests = useMemo(
    () => localProject.dinnerTables.reduce((sum, table) => sum + table.assignedGuestIds.length, 0),
    [localProject.dinnerTables]
  );
  const unassignedGuests = Math.max(0, invitedGuests - seatedGuests);
  const receptionSeatCount = useMemo(
    () => localProject.dinnerTables.reduce((sum, table) => sum + table.capacity, 0),
    [localProject.dinnerTables]
  );

  // The scene's own start time, from the couple's real timeline.
  const beginsAt = useMemo(() => {
    const items = localProject.timelineItems;
    if (sceneKind === "reception") {
      return items.find((item) => isReceptionPhase(item.phase))?.time ?? null;
    }
    // The first ceremony-side moment IS when the ceremony day begins; only fall
    // back to null (the row then hides) rather than mislabel a reception time.
    return items.find((item) => !isReceptionPhase(item.phase))?.time ?? null;
  }, [localProject.timelineItems, sceneKind]);

  const risks = useMemo(
    () =>
      analyzeWeddingFlow({
        cues: localProject.musicCues,
        guestItems: localProject.guests,
        speechItems: localProject.speeches,
        tables: localProject.dinnerTables,
        timeline: localProject.timelineItems
      }),
    [localProject.dinnerTables, localProject.guests, localProject.musicCues, localProject.speeches, localProject.timelineItems]
  );

  // Scene check: real, actionable problems only — each links to the place where
  // it can be fixed. No readiness percentages, no vanity numbers.
  const warnings = useMemo<SceneWarning[]>(() => {
    const list: SceneWarning[] = [];

    if (sceneKind === "ceremony" && capacity.overflowGuests > 0) {
      list.push({
        actionLabel: t("Review guest list"),
        href: "/guests",
        id: "scene-overflow",
        text: t("{count} guests over comfortable capacity", { count: capacity.overflowGuests })
      });
    }

    if (sceneKind === "reception" && unassignedGuests > 0) {
      list.push({
        actionLabel: t("Open Seating Plan"),
        href: "/reception",
        id: "scene-unseated",
        text: t("{count} guests don't have a seat yet", { count: unassignedGuests })
      });
    }

    for (const risk of risks) {
      const item = localProject.timelineItems.find((timelineItem) => timelineItem.id === risk.relatedEntityId);
      // Risks tied to a timeline moment belong to that moment's scene; risks
      // about cues/speeches/guests apply to the whole day, so show them in both.
      const belongsHere = item ? isReceptionPhase(item.phase) === (sceneKind === "reception") : true;
      if (!belongsHere) {
        continue;
      }
      list.push({
        actionLabel: t("Fine-tune the timing"),
        href: item ? `/day-flow?resolve=${risk.id}&focus=${item.id}` : `/day-flow?resolve=${risk.id}`,
        id: risk.id,
        text: t(risk.title)
      });
    }

    return list;
  }, [capacity.overflowGuests, localProject.timelineItems, risks, sceneKind, t, unassignedGuests]);

  // Preview mode plays the couple's own day: phases derived from their real
  // timeline, falling back to the sample reel only if the timeline is empty.
  const phases = useMemo(() => {
    const derived = derivePreviewPhases(localProject.timelineItems);
    return derived.length ? derived : previewPhases;
  }, [localProject.timelineItems]);
  const safePhaseIndex = Math.min(phaseIndex, phases.length - 1);

  useEffect(() => {
    if (mode !== "preview" || !isPlaying) {
      return;
    }

    const interval = window.setInterval(() => {
      setPhaseIndex((currentIndex) => {
        if (currentIndex >= phases.length - 1) {
          setIsPlaying(false);
          return currentIndex;
        }
        return currentIndex + 1;
      });
    }, 3400);

    return () => window.clearInterval(interval);
  }, [isPlaying, mode, phases.length]);

  useEffect(() => {
    queueMicrotask(() => {
      const storedLayout = readStoredWeddingStudioLayout();

      if (storedLayout) {
        setPlan(storedLayout.plan);
        setSceneEdits(storedLayout.sceneEdits);
      }
    });
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Close the overflow menu on Escape or an outside click (a bare <details>
  // otherwise stays open until its summary is clicked again).
  useEffect(() => {
    function closeMenu(event: Event) {
      const menu = menuRef.current;
      if (!menu?.open) {
        return;
      }
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") {
        return;
      }
      if (event.type === "pointerdown" && menu.contains(event.target as Node)) {
        return;
      }
      menu.open = false;
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

  useEffect(() => {
    if (!localProject.hasLocalProject) {
      return;
    }

    const projectKey = `${localProject.wedding.id}:${localProject.updatedAt ?? "local"}`;
    if (syncedProjectKey === projectKey) {
      return;
    }

    queueMicrotask(() => {
      // Prefer a saved layout when it is newer than the wedding record, so plan
      // edits made in the Ceremony studio (or here) flow back both ways. Fall
      // back to deriving from the wedding when the wedding itself changed last.
      const storedLayout = readStoredWeddingStudioLayout();
      const weddingTime = localProject.updatedAt ?? "";

      if (storedLayout && storedLayout.updatedAt >= weddingTime) {
        setPlan(storedLayout.plan);
        setSceneEdits(storedLayout.sceneEdits);
      } else {
        // The wedding record changed more recently — refresh only the fields the
        // wedding actually drives (venue/style seed), but KEEP everything the
        // couple set here (object nudges, seating layout, aisle width, accessible
        // seats). Basing off the stored layout instead of defaults is what stops
        // a stray guest/timeline edit from silently wiping this page's own work.
        const base = storedLayout?.plan ?? defaultWeddingStudioPlan;
        const nextEdits = storedLayout?.sceneEdits ?? sceneEdits;
        const nextPlan = createWeddingStudioPlanFromWedding(localProject.wedding, base);
        setPlan(nextPlan);
        setSceneEdits(nextEdits);
        writeStoredWeddingStudioLayout(nextPlan, nextEdits, "vision");
      }

      setSyncedProjectKey(projectKey);
    });
  }, [localProject.hasLocalProject, localProject.updatedAt, localProject.wedding, sceneEdits, syncedProjectKey]);

  // A shareable read-only link carrying the plan in its hash, so a recipient
  // sees this couple's plan, not their own localStorage.
  const shareUrl = useMemo(
    () =>
      buildShareUrl(
        encodeSnapshot(buildShareSnapshot({ guests: localProject.guests, timelineItems: localProject.timelineItems, wedding: activeWedding }))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeWedding, localProject.guests, localProject.timelineItems, localProject.updatedAt]
  );

  function updatePlan(nextPlan: WeddingStudioPlan) {
    setPlan(nextPlan);
    writeStoredWeddingStudioLayout(nextPlan, sceneEdits, "vision");
  }

  function moveSceneObject(objectId: StudioSceneObjectId, deltaX: number, deltaZ: number) {
    setSceneEdits((currentEdits) => {
      const currentOffset = currentEdits[objectId];
      const nextEdits = {
        ...currentEdits,
        [objectId]: {
          x: clampSceneOffset(currentOffset.x + deltaX),
          z: clampSceneOffset(currentOffset.z + deltaZ)
        }
      };

      writeStoredWeddingStudioLayout(plan, nextEdits, "vision");

      return nextEdits;
    });
  }

  // A click on an object in the 3D scene selects it and opens its inspector.
  function selectObjectFromScene(objectId: StudioSceneObjectId) {
    setSelectedObjectId(objectId);
    setActiveTool("objects");
    setInspectorOpen(true);
  }

  function enterPreview() {
    setMode("preview");
    setPhaseIndex(0);
    setIsPlaying(true);
  }

  function exitPreview() {
    setMode("edit");
    setIsPlaying(false);
  }

  async function copyStudioLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus(t("Link copied"));
      setShareFallbackUrl(null);
      window.setTimeout(() => setShareStatus(null), 2400);
    } catch {
      // Clipboard can be blocked — surface the actual link so it can be copied
      // by hand instead of pointing at the (wrong) address-bar URL.
      setShareFallbackUrl(shareUrl);
    }
  }

  function startOver() {
    if (
      !confirmAndBackupBeforeReset(
        t(
          "Start over? This permanently deletes your current wedding plan — guests, seating, timeline, speeches and vendors. A backup file downloads first so you can restore it."
        )
      )
    ) {
      return;
    }

    clearStoredProject();
    clearStoredWeddingStudioLayout();
    localProject.resetLocalProject();
    setPlan(defaultWeddingStudioPlan);
    setSceneEdits(defaultStudioSceneEdits);
    setSyncedProjectKey(null);
  }

  function toggleFullscreen() {
    const canvasElement = canvasRef.current;

    if (!canvasElement) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void canvasElement.requestFullscreen?.();
    }
  }

  const selectedObjectLabel = t(studioEditableObjects[activeSelectedObjectId].label);

  return (
    <div className="vstudio" data-mode={mode}>
      <header className="vstudio-header">
        <div className="vstudio-identity">
          <h1>{localProject.hasLocalProject ? activeWedding.coupleNames : t("Your Wedding Studio")}</h1>
          <span>{formatWeddingDate(activeWedding.date)}</span>
        </div>

        {mode === "edit" ? (
          <label className="vstudio-scene-select">
            <span className="sr-only">{t("Choose preview scene")}</span>
            <select onChange={(event) => setHeroScene(event.target.value as HeroScene)} value={heroScene}>
              <option value="ceremony">
                {t("Ceremony")} · {t("Church")}
              </option>
              <option value="ceremony-outdoor">
                {t("Ceremony")} · {t("Outdoor")}
              </option>
              <option value="reception">
                {t("Reception")} · {t("Dinner")}
              </option>
            </select>
          </label>
        ) : (
          <span className="vstudio-scene-static">{t("Previewing your day")}</span>
        )}

        <div className="vstudio-mode" role="group" aria-label={t("Mode")}>
          <button
            aria-pressed={mode === "edit"}
            data-active={mode === "edit"}
            onClick={() => {
              if (mode !== "edit") {
                exitPreview();
              }
            }}
            type="button"
          >
            {t("Edit")}
          </button>
          <button
            aria-pressed={mode === "preview"}
            data-active={mode === "preview"}
            onClick={() => {
              if (mode !== "preview") {
                enterPreview();
              }
            }}
            type="button"
          >
            {t("Preview")}
          </button>
        </div>

        <div className="vstudio-header-end">
          <SavedChip />
          {mode === "edit" ? (
            <button className="vstudio-primary" onClick={enterPreview} type="button">
              {t("Preview the day")}
            </button>
          ) : (
            <button className="vstudio-primary" onClick={exitPreview} type="button">
              {t("Exit preview")}
            </button>
          )}

          <details className="vstudio-menu" ref={menuRef}>
            <summary aria-label={t("More options")} title={t("More options")}>
              <MoreHorizontal aria-hidden="true" size={17} strokeWidth={1.8} />
            </summary>
            <div className="vstudio-menu-panel">
              <div className="vstudio-menu-row" role="group" aria-label={t("Language")}>
                <span>{t("Language")}</span>
                <span className="vstudio-menu-lang">
                  <button aria-pressed={language === "en"} data-active={language === "en"} onClick={() => setLanguage("en")} type="button">
                    EN
                  </button>
                  <button aria-pressed={language === "sv"} data-active={language === "sv"} onClick={() => setLanguage("sv")} type="button">
                    SV
                  </button>
                </span>
              </div>
              <button className="vstudio-menu-action" onClick={copyStudioLink} type="button">
                <Share2 aria-hidden="true" size={14} strokeWidth={1.8} />
                {shareStatus ?? t("Copy link")}
              </button>
              {shareFallbackUrl ? (
                <input
                  aria-label={t("Shareable link")}
                  className="vstudio-menu-url"
                  onFocus={(event) => event.target.select()}
                  readOnly
                  value={shareFallbackUrl}
                />
              ) : null}
              {localProject.hasLocalProject ? (
                <button className="vstudio-menu-action vstudio-menu-danger" onClick={startOver} type="button">
                  {t("Start over with a new project")}
                </button>
              ) : null}
            </div>
          </details>
        </div>

        <MobileNavigation />
      </header>

      {mode === "edit" ? (
        <>
          <div className="vstudio-body" data-inspector={inspectorOpen ? "open" : "closed"}>
            <nav aria-label={t("Scene tools")} className="vstudio-rail">
              {RAIL_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    aria-label={t(tool.label)}
                    aria-pressed={activeTool === tool.id}
                    data-active={activeTool === tool.id}
                    key={tool.id}
                    onClick={() => {
                      setActiveTool(tool.id);
                      setInspectorOpen(true);
                    }}
                    title={t(tool.label)}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
                  </button>
                );
              })}
            </nav>

            <section aria-label={t("3D venue workspace")} className="vstudio-canvas" ref={canvasRef}>
              <CeremonyScene
                activeStep={sceneStep}
                budgetLevel={plan.budgetLevel}
                capacity={capacity}
                colorDirection={plan.colorDirection}
                lighting={lighting}
                onMoveObject={moveSceneObject}
                onSelectObject={selectObjectFromScene}
                sceneEdits={sceneEdits}
                selectedObjectId={activeSelectedObjectId}
                style={plan.style}
                venueType={sceneVenueType}
                viewMode={dimension === "2d" ? "top" : "3d"}
                zoom={zoom}
              />

              <div className="vstudio-camera" role="group" aria-label={t("Camera controls")}>
                <button aria-pressed={dimension === "2d"} data-active={dimension === "2d"} onClick={() => setDimension("2d")} type="button">
                  2D
                </button>
                <button aria-pressed={dimension === "3d"} data-active={dimension === "3d"} onClick={() => setDimension("3d")} type="button">
                  3D
                </button>
                <i aria-hidden="true" />
                <button
                  aria-label={t("Zoom out")}
                  disabled={zoom <= 0.75}
                  onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))}
                  title={t("Zoom out")}
                  type="button"
                >
                  <Minus aria-hidden="true" size={14} strokeWidth={2} />
                </button>
                <button
                  aria-label={t("Zoom in")}
                  disabled={zoom >= 1.5}
                  onClick={() => setZoom((value) => Math.min(1.5, Number((value + 0.15).toFixed(2))))}
                  title={t("Zoom in")}
                  type="button"
                >
                  <Plus aria-hidden="true" size={14} strokeWidth={2} />
                </button>
                <i aria-hidden="true" />
                <button aria-label={t("Toggle fullscreen preview")} onClick={toggleFullscreen} title={t("Toggle fullscreen preview")} type="button">
                  <Expand aria-hidden="true" size={14} strokeWidth={1.9} />
                </button>
                {isFullscreen ? null : (
                  <button
                    aria-label={inspectorOpen ? t("Hide panel") : t("Show panel")}
                    onClick={() => setInspectorOpen((value) => !value)}
                    title={inspectorOpen ? t("Hide panel") : t("Show panel")}
                    type="button"
                  >
                    {inspectorOpen ? (
                      <PanelRightClose aria-hidden="true" size={14} strokeWidth={1.9} />
                    ) : (
                      <PanelRightOpen aria-hidden="true" size={14} strokeWidth={1.9} />
                    )}
                  </button>
                )}
              </div>
            </section>

            {inspectorOpen ? (
              <aside aria-label={t("Scene inspector")} className="vstudio-inspector">
                <StudioInspector
                  activeTool={activeTool}
                  beginsAt={beginsAt}
                  capacity={capacity}
                  editableObjectIds={editableObjectIds}
                  invitedGuests={invitedGuests}
                  lighting={lighting}
                  onLightingChange={setLighting}
                  onMoveObject={moveSceneObject}
                  onSelectObject={setSelectedObjectId}
                  onSelectTool={setActiveTool}
                  plan={{ ...plan, guestCount: invitedGuests }}
                  receptionSeatCount={receptionSeatCount}
                  receptionTableCount={localProject.dinnerTables.length}
                  sceneEdits={sceneEdits}
                  sceneKind={sceneKind}
                  seatedGuests={seatedGuests}
                  selectedObjectId={activeSelectedObjectId}
                  updatePlan={updatePlan}
                  warnings={warnings}
                />
              </aside>
            ) : null}
          </div>

          <footer className="vstudio-status">
            <span>
              {sceneKind === "reception"
                ? t("{seated} of {invited} guests have a seat", { invited: invitedGuests, seated: seatedGuests })
                : `${invitedGuests} ${t("guests")} · ${capacity.totalCapacity} ${t("seats")}`}
            </span>
            <span className="vstudio-status-selected">
              {t("Selected")}: {selectedObjectLabel}
            </span>
            <button
              className="vstudio-status-check"
              data-tone={warnings.length > 0 ? "warn" : "ok"}
              onClick={() => {
                setActiveTool("overview");
                setInspectorOpen(true);
              }}
              type="button"
            >
              {warnings.length > 0
                ? t("{count} to review", { count: warnings.length })
                : t("All clear")}
            </button>
          </footer>
        </>
      ) : (
        <div className="vstudio-body vstudio-body-preview" data-fullscreen={isFullscreen ? "true" : undefined} ref={canvasRef}>
          <section aria-label={t("Ceremony preview")} className="vstudio-canvas vstudio-canvas-preview">
            <PreviewWalkthrough phaseIndex={waypointIndexForPhase(phases[safePhaseIndex]?.title ?? "")} />
            <div className="vstudio-preview-overlay">
              <span>{phases[safePhaseIndex]?.timeRange}</span>
              <strong>{t(phases[safePhaseIndex]?.title ?? "")}</strong>
            </div>
            <div className="vstudio-camera" role="group" aria-label={t("Camera controls")}>
              <button aria-label={t("Toggle fullscreen preview")} onClick={toggleFullscreen} title={t("Toggle fullscreen preview")} type="button">
                <Expand aria-hidden="true" size={14} strokeWidth={1.9} />
              </button>
            </div>
          </section>

          <StudioPlayback
            index={safePhaseIndex}
            isPlaying={isPlaying}
            onExit={exitPreview}
            onJump={(index) => {
              setPhaseIndex(index);
              setIsPlaying(false);
            }}
            onNext={() => {
              setPhaseIndex((value) => Math.min(phases.length - 1, value + 1));
              setIsPlaying(false);
            }}
            onPrevious={() => {
              setPhaseIndex((value) => Math.max(0, value - 1));
              setIsPlaying(false);
            }}
            onRestart={() => {
              setPhaseIndex(0);
              setIsPlaying(true);
            }}
            onTogglePlay={() => setIsPlaying((value) => !value)}
            phases={phases}
          />
        </div>
      )}
    </div>
  );
}
