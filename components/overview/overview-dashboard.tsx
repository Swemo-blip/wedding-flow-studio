"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Expand,
  MapPin,
  Minus,
  Palette,
  PencilRuler,
  Plus,
  Sunrise,
  SunMedium,
  Users,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneEditor } from "@/components/overview/scene-editor";
import { Donut } from "@/components/ui/donut";
import { CeremonyScene, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { assetPath } from "@/lib/asset-path";
import { useTranslation } from "@/lib/i18n";
import { clearStoredProject } from "@/lib/local-project-store";
import { confirmAndBackupBeforeReset } from "@/lib/project-backup";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { useBudget } from "@/lib/use-budget";
import { useChecklist } from "@/lib/use-checklist";
import { useLocalProject } from "@/lib/use-local-project";
import { formatCurrency } from "@/lib/wedding-budget";
import { sampleWedding } from "@/lib/wedding-data";
import { clearStoredWeddingStudioLayout, readStoredWeddingStudioLayout, writeStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";
import {
  calculateWeddingStudioCapacity,
  clampSceneOffset,
  createWeddingStudioPlanFromWedding,
  defaultStudioSceneEdits,
  defaultWeddingStudioPlan,
  getEditableObjectsForStep,
  styleOptions,
  venueOptions,
  type StudioPlanningStepId,
  type StudioSceneEdits,
  type StudioSceneObjectId,
  type WeddingStudioPlan
} from "@/lib/wedding-studio-plan";

type HeroScene = "ceremony" | "ceremony-outdoor" | "reception-indoor" | "reception-outdoor";

// Photoreal hero stills per scene — these are the premium "preview" (the live
// real-time 3D can't reach photoreal, so the home leads with a rendered image
// and the interactive twin sits behind "Edit in 3D Studio"). A scene with no
// image here falls back to the live 3D, so dropping a new file in + adding a
// key is all it takes to make that scene photoreal too.
const SCENE_HERO_IMAGES: Partial<Record<HeroScene, string>> = {
  "reception-indoor": "/images/reception-atmosphere.png",
  "reception-outdoor": "/images/reception-atmosphere.png"
};

export function OverviewDashboard() {
  const localProject = useLocalProject();
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<WeddingStudioPlan>(defaultWeddingStudioPlan);
  const [sceneEdits, setSceneEdits] = useState<StudioSceneEdits>(defaultStudioSceneEdits);
  const [heroScene, setHeroScene] = useState<HeroScene>("ceremony");
  const [dimension, setDimension] = useState<"2d" | "3d">("3d");
  const [lighting, setLighting] = useState<SceneLighting>("day");
  const [zoom, setZoom] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<StudioSceneObjectId>("focalPoint");
  const [syncedProjectKey, setSyncedProjectKey] = useState<string | null>(null);
  // Computed after mount (avoids a server/client hydration mismatch on the date).
  const [daysToGo, setDaysToGo] = useState<number | null>(null);

  const activeWedding = localProject.hasLocalProject ? localProject.wedding : sampleWedding;
  // The live guest list is the single source of truth for headcount, so the 3D
  // hero capacity fills to the real invited count — not a separate slider value.
  const capacity = useMemo(
    () => calculateWeddingStudioCapacity({ ...plan, guestCount: localProject.guests.length }),
    [plan, localProject.guests.length]
  );
  const sceneStep: StudioPlanningStepId = heroScene.startsWith("reception") ? "reception" : "preview";
  const editableObjectIds = useMemo(() => getEditableObjectsForStep(sceneStep), [sceneStep]);
  const activeSelectedObjectId = editableObjectIds.includes(selectedObjectId) ? selectedObjectId : (editableObjectIds[0] ?? "focalPoint");
  const venueLabel = t(venueOptions.find((option) => option.value === plan.venueType)?.label ?? "Venue");
  // Outdoor options preview in an open-air garden venue; indoor reception uses
  // the hall (banquet room), regardless of the wedding's own ceremony venue.
  const sceneVenueType =
    heroScene === "ceremony-outdoor" || heroScene === "reception-outdoor"
      ? "garden"
      : heroScene === "reception-indoor"
        ? "hall"
        : plan.venueType;
  const styleLabel = t(styleOptions.find((option) => option.value === plan.style)?.label ?? "Classic");
  // Photoreal still for this scene, if we have one; else fall back to the live 3D.
  const heroImage = SCENE_HERO_IMAGES[heroScene];

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

  const riskedItemIds = useMemo(() => new Set(risks.map((risk) => risk.relatedEntityId)), [risks]);
  const readyMoments = localProject.timelineItems.filter((item) => !riskedItemIds.has(item.id)).length;
  const totalMoments = Math.max(1, localProject.timelineItems.length);
  const readinessPercent = Math.round((readyMoments / totalMoments) * 100);
  const attentionRisks = risks.filter((risk) => risk.severity === "high").length;
  const reviewRisks = risks.length - attentionRisks;

  // Live snapshots pulled from the real pillar stores so the home reflects the
  // actual plan (not stale mock numbers).
  const { items: budgetItems } = useBudget();
  const { tasks: checklistTasks } = useChecklist();
  const budgetTotals = useMemo(() => {
    const estimate = budgetItems.reduce((sum, item) => sum + (Number(item.estimate) || 0), 0);
    const paid = budgetItems.reduce((sum, item) => sum + (Number(item.paid) || 0), 0);
    return {
      estimate,
      paid,
      remaining: Math.max(0, estimate - paid),
      percent: estimate > 0 ? Math.min(100, Math.round((paid / estimate) * 100)) : 0
    };
  }, [budgetItems]);
  const checklistDone = checklistTasks.filter((task) => task.done).length;
  const checklistPercent = checklistTasks.length > 0 ? Math.round((checklistDone / checklistTasks.length) * 100) : 0;
  const invitedGuests = localProject.guests.length;
  const attendingGuests = localProject.guests.filter((guest) => guest.rsvpStatus === "attending").length;

  const glanceTimeline = localProject.timelineItems.slice(0, 4);
  const seatedGuests = localProject.dinnerTables.reduce((sum, table) => sum + table.assignedGuestIds.length, 0);

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
    const weddingDate = new Date(activeWedding.date);
    if (Number.isNaN(weddingDate.getTime())) {
      return;
    }
    queueMicrotask(() => setDaysToGo(Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000))));
  }, [activeWedding.date]);

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
        const nextPlan = createWeddingStudioPlanFromWedding(localProject.wedding, defaultWeddingStudioPlan);
        setPlan(nextPlan);
        writeStoredWeddingStudioLayout(nextPlan, sceneEdits, "vision");
      }

      setSyncedProjectKey(projectKey);
    });
  }, [localProject.hasLocalProject, localProject.updatedAt, localProject.wedding, sceneEdits, syncedProjectKey]);

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
    setIsEditing(false);
  }

  function toggleFullscreen() {
    const heroElement = heroRef.current;

    if (!heroElement) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void heroElement.requestFullscreen?.();
    }
  }

  return (
    <div className="overview-page">
      <div className="overview-grid">
        <div className="overview-main">
          <section aria-label="3D venue preview" className="venue-hero" ref={heroRef}>
            <div className="venue-hero-topline">
              <div className="venue-hero-label">
                <span>{heroImage ? t("Venue Preview") : t("3D Venue Preview")}</span>
                <select
                  aria-label={t("Choose preview scene")}
                  onChange={(event) => setHeroScene(event.target.value as HeroScene)}
                  value={heroScene}
                >
                  <option value="ceremony">{t("Ceremony")} – {venueLabel}</option>
                  <option value="ceremony-outdoor">{t("Ceremony")} – {t("Garden (outdoors)")}</option>
                  <option value="reception-indoor">{t("Reception")} – {t("Indoors")}</option>
                  <option value="reception-outdoor">{t("Reception")} – {t("Garden (outdoors)")}</option>
                </select>
              </div>
              <div className="venue-hero-tools">
                {heroImage ? null : (
                  <>
                    <div className="venue-dimension-toggle" role="group" aria-label={t("Choose 2D or 3D view")}>
                      <button aria-pressed={dimension === "2d"} data-active={dimension === "2d"} onClick={() => setDimension("2d")} type="button">
                        2D
                      </button>
                      <button aria-pressed={dimension === "3d"} data-active={dimension === "3d"} onClick={() => setDimension("3d")} type="button">
                        3D
                      </button>
                    </div>
                    <button
                      aria-label={lighting === "day" ? t("Switch to golden-hour lighting") : t("Switch to daylight")}
                      className="venue-tool-button"
                      onClick={() => setLighting((value) => (value === "day" ? "dusk" : "day"))}
                      type="button"
                    >
                      {lighting === "day" ? (
                        <Sunrise aria-hidden="true" size={15} strokeWidth={1.8} />
                      ) : (
                        <SunMedium aria-hidden="true" size={15} strokeWidth={1.8} />
                      )}
                    </button>
                  </>
                )}
                <button aria-label={t("Toggle fullscreen preview")} className="venue-tool-button" onClick={toggleFullscreen} type="button">
                  <Expand aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {heroImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img alt={t("Cinematic preview of your wedding day")} className="venue-hero-photo" src={assetPath(heroImage)} />
            ) : (
              <CeremonyScene
                activeStep={sceneStep}
                budgetLevel={plan.budgetLevel}
                capacity={capacity}
                colorDirection={plan.colorDirection}
                lighting={lighting}
                onMoveObject={moveSceneObject}
                onSelectObject={setSelectedObjectId}
                sceneEdits={sceneEdits}
                selectedObjectId={activeSelectedObjectId}
                style={plan.style}
                venueType={sceneVenueType}
                viewMode={dimension === "2d" ? "top" : "3d"}
                zoom={zoom}
              />
            )}

            <div className="venue-hero-bottomline">
              {heroImage ? (
                <span className="venue-hero-caption">{t("Cinematic preview")}</span>
              ) : (
                <div className="venue-zoom-tools" role="group" aria-label={t("Zoom controls")}>
                  <button aria-label={t("Zoom out")} onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))} type="button">
                    <Minus aria-hidden="true" size={15} strokeWidth={2} />
                  </button>
                  <button aria-label={t("Zoom in")} onClick={() => setZoom((value) => Math.min(1.5, Number((value + 0.15).toFixed(2))))} type="button">
                    <Plus aria-hidden="true" size={15} strokeWidth={2} />
                  </button>
                </div>
              )}
              <button className="venue-edit-button" onClick={() => setIsEditing((value) => !value)} type="button">
                <PencilRuler aria-hidden="true" size={15} strokeWidth={1.8} />
                {isEditing ? t("Close 3D Studio") : t("Edit in 3D Studio")}
              </button>
            </div>

            {isEditing ? (
              <div className="venue-edit-drawer" role="dialog" aria-label={t("Style Studio")}>
                <div className="venue-edit-drawer-head">
                  <strong>{t("Style Studio")}</strong>
                  <button aria-label={t("Close style studio")} onClick={() => setIsEditing(false)} type="button">
                    <X aria-hidden="true" size={16} strokeWidth={1.8} />
                  </button>
                </div>
                <SceneEditor capacity={capacity} onChange={updatePlan} plan={{ ...plan, guestCount: invitedGuests }} />
              </div>
            ) : null}
          </section>

          <div className="glance-row">
            <section aria-label={t("Timeline at a Glance")} className="glance-card">
              <h3>{t("Timeline at a Glance")}</h3>
              <ul className="glance-timeline">
                {glanceTimeline.map((item) => (
                  <li key={item.id}>
                    <span>{t(item.title)}</span>
                    <strong>{item.time}</strong>
                  </li>
                ))}
              </ul>
              <Button className="glance-action" href="/day-flow" size="small" variant="secondary">
                {t("View Full Timeline")}
              </Button>
            </section>

            <section aria-label={t("Guest Count")} className="glance-card">
              <h3>{t("Guest Count")}</h3>
              <div className="glance-donut-wrap">
                <Donut percent={invitedGuests > 0 ? Math.round((attendingGuests / invitedGuests) * 100) : 0} tone="sage">
                  <strong>{attendingGuests}</strong>
                  <span>
                    {t("of {count} invited", { count: invitedGuests })}
                  </span>
                </Donut>
              </div>
              <Button className="glance-action" href="/guests" size="small" variant="secondary">
                {t("Manage Guests")}
              </Button>
            </section>

            <section aria-label={t("Seating Overview")} className="glance-card">
              <h3>{t("Seating Overview")}</h3>
              <div className="glance-seating">
                {localProject.dinnerTables.slice(0, 8).map((table) => (
                  <div className="glance-table" key={table.id} title={table.name}>
                    {Array.from({ length: Math.min(10, table.capacity) }, (_, seatIndex) => (
                      <i data-filled={seatIndex < table.assignedGuestIds.length} key={seatIndex} />
                    ))}
                  </div>
                ))}
              </div>
              <Button className="glance-action" href="/reception" size="small" variant="secondary">
                {t("Open Seating Plan")}
              </Button>
            </section>

          </div>
        </div>

        <aside className="overview-rail" aria-label={t("Wedding Overview")}>
          <section className="rail-card">
            <div className="rail-card-head">
              <h3>{t("Wedding Overview")}</h3>
              <button className="rail-edit" onClick={() => setIsEditing(true)} type="button">
                {t("Edit")}
              </button>
            </div>
            <ul className="rail-facts">
              <li>
                <CalendarDays aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>{t("Date")}</span>
                <strong>
                  {activeWedding.date}
                  {daysToGo !== null ? <em className="rail-countdown">{daysToGo} {t("days to go")}</em> : null}
                </strong>
              </li>
              <li>
                <MapPin aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>{t("Venue")}</span>
                <strong>{activeWedding.receptionLocation}</strong>
              </li>
              <li>
                <Users aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>{t("Guests")}</span>
                <strong>
                  {invitedGuests} {t("invited")} · {attendingGuests} {t("attending")}
                </strong>
              </li>
              <li>
                <Palette aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>{t("Style")}</span>
                <strong>
                  {styleLabel} {venueLabel}
                </strong>
              </li>
            </ul>
            {localProject.hasLocalProject ? (
              <button className="rail-reset" onClick={startOver} type="button">
                {t("Start over with a new project")}
              </button>
            ) : null}
          </section>

          <section className="rail-card">
            <div className="rail-card-head">
              <h3>{t("Plan Readiness")}</h3>
            </div>
            <div className="rail-progress">
              <Donut percent={readinessPercent} tone={readinessPercent >= 70 ? "sage" : "gold"}>
                <strong>{readinessPercent}%</strong>
                <span>{readinessPercent >= 70 ? t("On Track") : t("In Review")}</span>
              </Donut>
              <ul className="rail-progress-rows">
                <li>
                  <span>{t("Ready moments")}</span>
                  <strong>{readyMoments}</strong>
                </li>
                <li>
                  <span>{t("Needs review")}</span>
                  <strong>{reviewRisks}</strong>
                </li>
                <li>
                  <span>{t("Needs attention")}</span>
                  <strong>{attentionRisks}</strong>
                </li>
              </ul>
            </div>
            <Button className="glance-action" href="/day-flow" size="small" variant="secondary">
              {t("View Timeline")}
            </Button>
          </section>

          <section className="rail-card">
            <div className="rail-card-head">
              <h3>{t("Budget Snapshot")}</h3>
            </div>
            <div className="rail-budget">
              <div className="rail-budget-topline">
                <span>{t("Estimated total")}</span>
                <strong>{formatCurrency(budgetTotals.estimate)}</strong>
              </div>
              <div aria-hidden="true" className="rail-meter">
                <span style={{ width: `${budgetTotals.percent}%` }} />
              </div>
              <ul className="rail-progress-rows">
                <li>
                  <span>{t("Paid")}</span>
                  <strong>{formatCurrency(budgetTotals.paid)}</strong>
                </li>
                <li>
                  <span>{t("Left to pay")}</span>
                  <strong>{formatCurrency(budgetTotals.remaining)}</strong>
                </li>
              </ul>
            </div>
            <Button className="glance-action" href="/budget" size="small" variant="secondary">
              {t("View Budget")}
            </Button>
          </section>

          <section className="rail-card">
            <div className="rail-card-head">
              <h3>{t("Checklist")}</h3>
            </div>
            <div className="rail-progress">
              <Donut percent={checklistPercent} tone={checklistPercent >= 70 ? "sage" : "gold"}>
                <strong>{checklistPercent}%</strong>
                <span>{t("done")}</span>
              </Donut>
              <ul className="rail-progress-rows">
                <li>
                  <span>{t("Done")}</span>
                  <strong>{checklistDone}</strong>
                </li>
                <li>
                  <span>{t("Still to do")}</span>
                  <strong>{checklistTasks.length - checklistDone}</strong>
                </li>
              </ul>
            </div>
            <Button className="glance-action" href="/checklist" size="small" variant="secondary">
              {t("Open checklist")}
            </Button>
          </section>
        </aside>
      </div>

      <p className="overview-footnote">{t("Everything autosaves locally on this device.")}</p>
    </div>
  );
}

