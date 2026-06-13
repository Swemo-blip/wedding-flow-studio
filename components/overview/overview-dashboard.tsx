"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { CeremonyScene, type SceneLighting } from "@/components/wedding-studio/church-scene";
import { clearStoredProject } from "@/lib/local-project-store";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { useLocalProject } from "@/lib/use-local-project";
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

type HeroScene = "ceremony" | "reception";

const styleSwatches: Record<string, string[]> = {
  classic: ["#6b7b62", "#9caf88", "#e9dcc0", "#dbb9a4", "#c9a767"],
  modern: ["#5d6d60", "#aebdb0", "#dfe0d4", "#bdc8be", "#aebdb0"],
  romantic: ["#7d6660", "#d8a79c", "#ecdcd0", "#e3bdb2", "#c9a767"],
  rustic: ["#6d5b3f", "#b08a52", "#e4d4b2", "#d4b993", "#c2a065"]
};

export function OverviewDashboard() {
  const localProject = useLocalProject();
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
  const [showWelcome, setShowWelcome] = useState(false);

  const activeWedding = localProject.hasLocalProject ? localProject.wedding : sampleWedding;
  const capacity = useMemo(() => calculateWeddingStudioCapacity(plan), [plan]);
  const sceneStep: StudioPlanningStepId = heroScene === "reception" ? "reception" : "preview";
  const editableObjectIds = useMemo(() => getEditableObjectsForStep(sceneStep), [sceneStep]);
  const activeSelectedObjectId = editableObjectIds.includes(selectedObjectId) ? selectedObjectId : (editableObjectIds[0] ?? "focalPoint");
  const venueLabel = venueOptions.find((option) => option.value === plan.venueType)?.label ?? "Venue";
  const styleLabel = styleOptions.find((option) => option.value === plan.style)?.label ?? "Classic";
  const themeColors = styleSwatches[plan.style] ?? styleSwatches.classic;

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

  const confirmedCues = localProject.musicCues.filter((cue) => cue.status === "confirmed").length;
  const totalCues = Math.max(1, localProject.musicCues.length);

  const glanceTimeline = localProject.timelineItems.slice(0, 4);
  const seatedGuests = localProject.dinnerTables.reduce((sum, table) => sum + table.assignedGuestIds.length, 0);

  useEffect(() => {
    queueMicrotask(() => {
      const storedLayout = readStoredWeddingStudioLayout();

      if (storedLayout) {
        setPlan(storedLayout.plan);
        setSceneEdits(storedLayout.sceneEdits);
      }

      setShowWelcome(window.localStorage.getItem("wfs-welcome-dismissed") !== "1");
    });
  }, []);

  function dismissWelcome() {
    window.localStorage.setItem("wfs-welcome-dismissed", "1");
    setShowWelcome(false);
  }

  useEffect(() => {
    if (!localProject.hasLocalProject) {
      return;
    }

    const projectKey = `${localProject.wedding.id}:${localProject.updatedAt ?? "local"}`;
    if (syncedProjectKey === projectKey) {
      return;
    }

    queueMicrotask(() => {
      const nextPlan = createWeddingStudioPlanFromWedding(localProject.wedding, defaultWeddingStudioPlan);
      setPlan(nextPlan);
      writeStoredWeddingStudioLayout(nextPlan, sceneEdits, "vision");
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
      {!localProject.hasLocalProject && showWelcome ? (
        <div className="overview-welcome" role="status">
          <p>
            <strong>You are viewing a sample wedding.</strong> Explore freely — then create your own in about two minutes.
          </p>
          <div className="overview-welcome-actions">
            <Link className="button button-primary button-small" href="/intake">
              Create your wedding
            </Link>
            <button aria-label="Dismiss welcome message" onClick={dismissWelcome} type="button">
              <X aria-hidden="true" size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="overview-grid">
        <div className="overview-main">
          <section aria-label="3D venue preview" className="venue-hero" ref={heroRef}>
            <div className="venue-hero-topline">
              <div className="venue-hero-label">
                <span>3D Venue Preview</span>
                <select
                  aria-label="Choose preview scene"
                  onChange={(event) => setHeroScene(event.target.value as HeroScene)}
                  value={heroScene}
                >
                  <option value="ceremony">Ceremony – {venueLabel}</option>
                  <option value="reception">Reception – {venueLabel}</option>
                </select>
              </div>
              <div className="venue-hero-tools">
                <div className="venue-dimension-toggle" role="group" aria-label="Choose 2D or 3D view">
                  <button aria-pressed={dimension === "2d"} data-active={dimension === "2d"} onClick={() => setDimension("2d")} type="button">
                    2D
                  </button>
                  <button aria-pressed={dimension === "3d"} data-active={dimension === "3d"} onClick={() => setDimension("3d")} type="button">
                    3D
                  </button>
                </div>
                <button
                  aria-label={lighting === "day" ? "Switch to golden-hour lighting" : "Switch to daylight"}
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
                <button aria-label="Toggle fullscreen preview" className="venue-tool-button" onClick={toggleFullscreen} type="button">
                  <Expand aria-hidden="true" size={15} strokeWidth={1.8} />
                </button>
              </div>
            </div>

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
              venueType={plan.venueType}
              viewMode={dimension === "2d" ? "top" : "3d"}
              zoom={zoom}
            />

            <div className="venue-hero-bottomline">
              <div className="venue-zoom-tools" role="group" aria-label="Zoom controls">
                <button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))} type="button">
                  <Minus aria-hidden="true" size={15} strokeWidth={2} />
                </button>
                <button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.5, Number((value + 0.15).toFixed(2))))} type="button">
                  <Plus aria-hidden="true" size={15} strokeWidth={2} />
                </button>
              </div>
              <button className="venue-edit-button" onClick={() => setIsEditing((value) => !value)} type="button">
                <PencilRuler aria-hidden="true" size={15} strokeWidth={1.8} />
                {isEditing ? "Close 3D Studio" : "Edit in 3D Studio"}
              </button>
            </div>

            {isEditing ? (
              <div className="venue-edit-drawer" role="dialog" aria-label="Style studio">
                <div className="venue-edit-drawer-head">
                  <strong>Style Studio</strong>
                  <button aria-label="Close style studio" onClick={() => setIsEditing(false)} type="button">
                    <X aria-hidden="true" size={16} strokeWidth={1.8} />
                  </button>
                </div>
                <SceneEditor capacity={capacity} onChange={updatePlan} plan={plan} />
              </div>
            ) : null}
          </section>

          <div className="glance-row">
            <section aria-label="Timeline at a glance" className="glance-card">
              <h3>Timeline at a Glance</h3>
              <ul className="glance-timeline">
                {glanceTimeline.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    <strong>{item.time}</strong>
                  </li>
                ))}
              </ul>
              <Button className="glance-action" href="/day-flow" size="small" variant="secondary">
                View Full Timeline
              </Button>
            </section>

            <section aria-label="Guest count" className="glance-card">
              <h3>Guest Count</h3>
              <div className="glance-donut-wrap">
                <Donut percent={Math.min(100, Math.round((plan.guestCount / Math.max(1, capacity.totalCapacity)) * 100))} tone="sage">
                  <strong>{plan.guestCount}</strong>
                  <span>Expected</span>
                </Donut>
              </div>
              <Button className="glance-action" href="/reception" size="small" variant="secondary">
                Manage Guests
              </Button>
            </section>

            <section aria-label="Seating overview" className="glance-card">
              <h3>Seating Overview</h3>
              <div aria-label={`${seatedGuests} guests seated across ${localProject.dinnerTables.length} tables`} className="glance-seating">
                {localProject.dinnerTables.slice(0, 8).map((table) => (
                  <div className="glance-table" key={table.id} title={table.name}>
                    {Array.from({ length: Math.min(10, table.capacity) }, (_, seatIndex) => (
                      <i data-filled={seatIndex < table.assignedGuestIds.length} key={seatIndex} />
                    ))}
                  </div>
                ))}
              </div>
              <Button className="glance-action" href="/reception" size="small" variant="secondary">
                Open Seating Plan
              </Button>
            </section>

            <section aria-label="Style and design" className="glance-card">
              <h3>Style &amp; Design</h3>
              <div className="glance-style-tiles" aria-label={`${styleLabel} palette`}>
                {themeColors.slice(0, 4).map((color, index) => (
                  <span key={index} style={{ background: `linear-gradient(160deg, ${color}, ${themeColors[(index + 1) % themeColors.length]})` }} />
                ))}
              </div>
              <Button className="glance-action" onClick={() => setIsEditing(true)} size="small" variant="secondary">
                Open Style Studio
              </Button>
            </section>
          </div>
        </div>

        <aside className="overview-rail" aria-label="Wedding overview">
          <section className="rail-card">
            <div className="rail-card-head">
              <h3>Wedding Overview</h3>
              <button className="rail-edit" onClick={() => setIsEditing(true)} type="button">
                Edit
              </button>
            </div>
            <ul className="rail-facts">
              <li>
                <CalendarDays aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>Date</span>
                <strong>{activeWedding.date}</strong>
              </li>
              <li>
                <MapPin aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>Venue</span>
                <strong>{activeWedding.receptionLocation}</strong>
              </li>
              <li>
                <Users aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>Guests</span>
                <strong>
                  {plan.guestCount} invited · {capacity.totalCapacity} seats
                </strong>
              </li>
              <li>
                <Palette aria-hidden="true" size={16} strokeWidth={1.7} />
                <span>Style</span>
                <strong>
                  {styleLabel} {venueLabel}
                </strong>
              </li>
              <li className="rail-theme-row">
                <span>Theme Colors</span>
                <span className="rail-theme-dots">
                  {themeColors.map((color, index) => (
                    <i key={index} style={{ background: color }} />
                  ))}
                </span>
              </li>
            </ul>
            {localProject.hasLocalProject ? (
              <button className="rail-reset" onClick={startOver} type="button">
                Start over with a new project
              </button>
            ) : null}
          </section>

          <section className="rail-card">
            <div className="rail-card-head">
              <h3>Plan Readiness</h3>
            </div>
            <div className="rail-progress">
              <Donut percent={readinessPercent} tone={readinessPercent >= 70 ? "sage" : "gold"}>
                <strong>{readinessPercent}%</strong>
                <span>{readinessPercent >= 70 ? "On Track" : "In Review"}</span>
              </Donut>
              <ul className="rail-progress-rows">
                <li>
                  <span>Ready moments</span>
                  <strong>{readyMoments}</strong>
                </li>
                <li>
                  <span>Needs review</span>
                  <strong>{reviewRisks}</strong>
                </li>
                <li>
                  <span>Needs attention</span>
                  <strong>{attentionRisks}</strong>
                </li>
              </ul>
            </div>
            <Button className="glance-action" href="/day-flow" size="small" variant="secondary">
              View Timeline
            </Button>
          </section>

          <section className="rail-card">
            <div className="rail-card-head">
              <h3>Cue Sheet</h3>
            </div>
            <div className="rail-budget">
              <div className="rail-budget-topline">
                <span>Confirmed cues</span>
                <strong>
                  {confirmedCues} / {totalCues}
                </strong>
              </div>
              <div aria-hidden="true" className="rail-meter">
                <span style={{ width: `${Math.round((confirmedCues / totalCues) * 100)}%` }} />
              </div>
              <p>
                {totalCues - confirmedCues > 0
                  ? `${totalCues - confirmedCues} cues still need confirmation before the rehearsal.`
                  : "Every music cue is confirmed and rehearsal-ready."}
              </p>
            </div>
            <Button className="glance-action" href="/music" size="small" variant="secondary">
              View Cue Sheet
            </Button>
          </section>
        </aside>
      </div>

      <p className="overview-footnote">
        Everything autosaves locally on this device.
      </p>
    </div>
  );
}

function Donut({ children, percent, tone }: { children: React.ReactNode; percent: number; tone: "sage" | "gold" }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = tone === "sage" ? "#6f8a5e" : "#c9a25c";

  return (
    <div className="studio-donut">
      <svg aria-hidden="true" viewBox="0 0 84 84">
        <circle cx="42" cy="42" fill="none" r={radius} stroke="rgba(146, 118, 73, 0.16)" strokeWidth="7" />
        <circle
          cx="42"
          cy="42"
          fill="none"
          r={radius}
          stroke={stroke}
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="7"
          transform="rotate(-90 42 42)"
        />
      </svg>
      <div className="studio-donut-center">{children}</div>
    </div>
  );
}
