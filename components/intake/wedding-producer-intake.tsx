"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  availableVendorRoles,
  ceremonyFormatLabels,
  complexityLabels,
  composeWeddingProducerPlan,
  defaultWeddingProducerIntake,
  receptionFormatLabels,
  stylePresetLabels,
  type CeremonyFormat,
  type ProductionComplexity,
  type ReceptionFormat,
  type WeddingProducerIntake as WeddingProducerIntakeState,
  type WeddingStylePreset
} from "@/lib/project-composer";
import { formatWeddingDate } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { createStoredProjectDraft, readStoredProject, writeStoredProject } from "@/lib/local-project-store";
import { confirmAndBackupBeforeReset } from "@/lib/project-backup";
import { clearStoredBudget } from "@/lib/use-budget";
import { clearStoredChecklist } from "@/lib/use-checklist";
import { clearStoredWeddingStudioLayout } from "@/lib/wedding-studio-storage";

const styleOptions = Object.entries(stylePresetLabels) as Array<[WeddingStylePreset, string]>;
const ceremonyOptions = Object.entries(ceremonyFormatLabels) as Array<[CeremonyFormat, string]>;
const receptionOptions = Object.entries(receptionFormatLabels) as Array<[ReceptionFormat, string]>;
const complexityOptions = Object.entries(complexityLabels) as Array<[ProductionComplexity, string]>;
const quickRolePresets = [
  {
    label: "Core team",
    roles: ["Wedding Planner", "Toastmaster / MC", "Photographer", "DJ / Musician", "Catering", "Venue", "Officiant"]
  },
  {
    label: "Planner-led",
    roles: ["Wedding Planner", "Photographer", "DJ / Musician", "Catering", "Venue", "Florist"]
  },
  {
    label: "Lean plan",
    roles: ["Toastmaster / MC", "Photographer", "DJ / Musician", "Catering", "Venue"]
  }
];

type IntakeQuestionId = "foundation" | "venue" | "guests" | "style" | "support";

const intakeQuestions: Array<{
  id: IntakeQuestionId;
  kicker: string;
  title: string;
  summary: string;
}> = [
  {
    id: "foundation",
    kicker: "Question 1",
    summary: "Names and date shape the first shareable plan.",
    title: "Who is the wedding for?"
  },
  {
    id: "venue",
    kicker: "Question 2",
    summary: "The venue model gives the digital twin its planning envelope.",
    title: "Where does the day happen?"
  },
  {
    id: "guests",
    kicker: "Question 3",
    summary: "Guest count drives seating, flow, timing, and comfort.",
    title: "How many guests should the plan support?"
  },
  {
    id: "style",
    kicker: "Question 4",
    summary: "Style and complexity decide how much detail the studio generates.",
    title: "What should the day feel like?"
  },
  {
    id: "support",
    kicker: "Question 5",
    summary: "Choose the collaborators who need a clean first handoff.",
    title: "Who needs to be included?"
  }
];

export function WeddingProducerIntake() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [intake, setIntake] = useState<WeddingProducerIntakeState>(defaultWeddingProducerIntake);
  const [status, setStatus] = useState<string | null>(null);
  const plan = useMemo(() => composeWeddingProducerPlan(intake), [intake]);
  const activeQuestion = intakeQuestions[activeQuestionIndex];
  const coreRoleCount = intake.vendorRoles.length;
  const readiness = getGeneratedReadiness(plan.generatedRisks.length, coreRoleCount);
  const isFinalQuestion = activeQuestionIndex === intakeQuestions.length - 1;

  function updateIntake(updates: Partial<WeddingProducerIntakeState>) {
    setStatus(null);
    setIntake((current) => ({
      ...current,
      ...updates
    }));
  }

  function toggleVendorRole(role: string) {
    setStatus(null);
    setIntake((current) => {
      const hasRole = current.vendorRoles.includes(role);

      return {
        ...current,
        vendorRoles: hasRole ? current.vendorRoles.filter((item) => item !== role) : [...current.vendorRoles, role]
      };
    });
  }

  function setRolePreset(roles: string[]) {
    updateIntake({ vendorRoles: roles });
  }

  function goToNextQuestion() {
    setActiveQuestionIndex((currentIndex) => Math.min(intakeQuestions.length - 1, currentIndex + 1));
  }

  function goToPreviousQuestion() {
    setActiveQuestionIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function createDigitalTwin(redirectTo?: string) {
    if (
      readStoredProject() &&
      !confirmAndBackupBeforeReset(
        t(
          "You already have a wedding plan. Creating a new one replaces your current guests, seating, timeline and speeches. A backup file downloads first so you can restore it."
        )
      )
    ) {
      return;
    }

    const storedProject = writeStoredProject(
      createStoredProjectDraft({
        dinnerTables: plan.dinnerTables,
        guests: plan.guests,
        musicCues: plan.musicCues,
        riskResolutions: [],
        speeches: plan.speeches,
        timelineItems: plan.timelineItems,
        wedding: plan.wedding
      })
    );

    if (!storedProject) {
      setStatus("The browser could not save this project yet. Review storage settings and try again.");
      return;
    }

    // A freshly generated plan must start its sibling stores from defaults, or
    // the new couple inherits the previous couple's checked-off checklist tasks
    // and budget (with an empty vendor list, so the checklist would claim a
    // caterer is "booked" for a couple that has none). Clearing the studio layout
    // also lets the home studio re-seed style/colour/decor from the new wedding.
    clearStoredChecklist();
    clearStoredBudget();
    clearStoredWeddingStudioLayout();

    setStatus("Your first visual wedding plan is ready in this browser.");

    if (redirectTo) {
      router.push(redirectTo);
    }
  }

  return (
    <div className="intake-studio guided-intake-studio">
      <section className="intake-hero guided-intake-hero" aria-labelledby="intake-title">
        <div>
          <p className="eyebrow">{t("Start with 5 questions")}</p>
          <h1 id="intake-title">{t("Get a first visual wedding plan before you start editing.")}</h1>
          <p>
            {t("Answer a few calm questions and watch your day take shape.")}
          </p>
        </div>
        <div className="intake-hero-card" aria-label={t("Generated readiness")}>
          <span>{t("Generated readiness")}</span>
          <strong>{readiness}%</strong>
          <small>{plan.generatedRisks.length === 0 ? t("Ready to preview") : `${plan.generatedRisks.length} ${t("watch notes")}`}</small>
        </div>
      </section>

      <section className="guided-intake-shell" aria-label={t("Guided first wedding plan")}>
        <aside className="guided-intake-steps" aria-label={t("Five question progress")}>
          {intakeQuestions.map((question, index) => (
            <button
              aria-current={index === activeQuestionIndex ? "step" : undefined}
              className="guided-intake-step"
              data-active={index === activeQuestionIndex}
              data-complete={index < activeQuestionIndex}
              key={question.id}
              onClick={() => setActiveQuestionIndex(index)}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{t(question.title)}</strong>
              <small>{index < activeQuestionIndex ? t("Answered") : index === activeQuestionIndex ? t("Now") : t("Next")}</small>
            </button>
          ))}

          <div className="guided-intake-save-state">
            <span>{t("Save status")}</span>
            <strong>{status ?? t("Not saved yet")}</strong>
          </div>
        </aside>

        <main className="guided-intake-main" aria-labelledby="active-intake-question">
          <div className="guided-question-card">
            <div className="guided-question-heading">
              <span>{t(activeQuestion.kicker)}</span>
              <h2 id="active-intake-question">{t(activeQuestion.title)}</h2>
              <p>{t(activeQuestion.summary)}</p>
            </div>

            {renderActiveQuestion()}

            <div className="guided-question-actions">
              <Button disabled={activeQuestionIndex === 0} onClick={goToPreviousQuestion} size="small" variant="secondary">
                {t("Back")}
              </Button>
              {isFinalQuestion ? (
                <Button onClick={() => createDigitalTwin("/")} size="small">
                  {t("Create Visual Plan")}
                </Button>
              ) : (
                <Button onClick={goToNextQuestion} size="small">
                  {t("Next Question")}
                </Button>
              )}
            </div>
          </div>

          <details className="guided-intake-details">
            <summary>
              <span>{t("Advanced project details")}</span>
              <small>{t("Open only if you want to adjust exact venue names or all role choices.")}</small>
            </summary>
            {renderAdvancedDetails()}
          </details>
        </main>

        <aside className="guided-preview-panel" aria-label={t("Generated Twin Preview")}>
          <div className="guided-preview-scene" aria-hidden="true">
            <div className="guided-preview-aisle" />
            <div className="guided-preview-focus">{t("Ceremony")}</div>
            {Array.from({ length: Math.min(10, Math.max(4, Math.ceil(intake.guestCount / 16))) }, (_, index) => (
              <div className="guided-preview-row" data-side={index % 2 === 0 ? "left" : "right"} key={index} />
            ))}
            <div className="guided-preview-reception">{t("Reception")}</div>
          </div>

          <div className="intake-preview-header">
            <p className="eyebrow">{t("Generated Twin Preview")}</p>
            <h2>{plan.wedding.coupleNames}</h2>
            <p>
              {formatWeddingDate(plan.wedding.date)} {t("at")} {plan.wedding.ceremonyLocation} {t("and")} {plan.wedding.receptionLocation}
            </p>
          </div>

          <div className="intake-preview-metrics">
            <div>
              <span>{t("Moments")}</span>
              <strong>{plan.timelineItems.length}</strong>
            </div>
            <div>
              <span>{t("Cues")}</span>
              <strong>{plan.musicCues.length}</strong>
            </div>
            <div>
              <span>{t("Tables")}</span>
              <strong>{plan.dinnerTables.length}</strong>
            </div>
            <div>
              <span>{t("Roles")}</span>
              <strong>{coreRoleCount}</strong>
            </div>
          </div>

          <div className="guided-preview-next">
            <span>{t("What will be generated")}</span>
            <strong>{t(getPreviewPromise(activeQuestion.id))}</strong>
            <p>{t(getPreviewSupportCopy(activeQuestion.id, plan.generatedRisks.length))}</p>
          </div>

          <div className="intake-flow-preview guided-flow-preview">
            <span>{t("First day flow")}</span>
            {plan.timelineItems.slice(0, 5).map((item) => (
              <article key={item.id}>
                <small>{item.time}</small>
                <strong>{item.phase}</strong>
                <p>{item.location}</p>
              </article>
            ))}
          </div>

          <div className="intake-next-actions">
            <Button onClick={() => createDigitalTwin("/preview")} size="small" variant="secondary">
              Save and Preview
            </Button>
            <Button onClick={() => createDigitalTwin("/day-flow")} size="small" variant="ghost">
              Save and Review Flow
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );

  function renderActiveQuestion() {
    if (activeQuestion.id === "foundation") {
      return (
        <div className="guided-field-grid">
          <label>
            <span>{t("Partner one")}</span>
            <input onChange={(event) => updateIntake({ partnerOneName: event.target.value })} value={intake.partnerOneName} />
          </label>
          <label>
            <span>{t("Partner two")}</span>
            <input onChange={(event) => updateIntake({ partnerTwoName: event.target.value })} value={intake.partnerTwoName} />
          </label>
          <label>
            <span>{t("Wedding date")}</span>
            <input onChange={(event) => updateIntake({ date: event.target.value })} type="date" value={intake.date} />
          </label>
        </div>
      );
    }

    if (activeQuestion.id === "venue") {
      return (
        <div className="guided-question-stack">
          <IntakeSegment
            label={t("Ceremony format")}
            onChange={(value) => updateIntake({ ceremonyFormat: value as CeremonyFormat })}
            options={ceremonyOptions}
            value={intake.ceremonyFormat}
          />
          <IntakeSegment
            label={t("Reception format")}
            onChange={(value) => updateIntake({ receptionFormat: value as ReceptionFormat })}
            options={receptionOptions}
            value={intake.receptionFormat}
          />
        </div>
      );
    }

    if (activeQuestion.id === "guests") {
      return (
        <div className="guided-guest-control">
          <div className="summary-between">
            <label htmlFor="intake-guest-count">{t("Guest count")}</label>
            <strong>{intake.guestCount}</strong>
          </div>
          <input
            id="intake-guest-count"
            max={300}
            min={2}
            onChange={(event) => updateIntake({ guestCount: Number(event.target.value) })}
            type="range"
            value={intake.guestCount}
          />
          <div className="guided-capacity-note">
            <strong>{t(getGuestCapacityLabel(intake.guestCount))}</strong>
            <span>{t(getGuestCapacityCopy(intake.guestCount))}</span>
          </div>
        </div>
      );
    }

    if (activeQuestion.id === "style") {
      return (
        <div className="guided-question-stack">
          <IntakeSegment
            label={t("Wedding style")}
            onChange={(value) => updateIntake({ stylePreset: value as WeddingStylePreset })}
            options={styleOptions}
            value={intake.stylePreset}
          />
          <IntakeSegment
            label={t("Production complexity")}
            onChange={(value) => updateIntake({ complexity: value as ProductionComplexity })}
            options={complexityOptions}
            value={intake.complexity}
          />
        </div>
      );
    }

    return (
      <div className="guided-question-stack">
        <div className="guided-role-presets" role="group" aria-label={t("Choose a collaborator preset")}>
          {quickRolePresets.map((preset) => (
            <button
              data-active={preset.roles.every((role) => intake.vendorRoles.includes(role)) && intake.vendorRoles.length === preset.roles.length}
              key={preset.label}
              onClick={() => setRolePreset(preset.roles)}
              type="button"
            >
              <strong>{t(preset.label)}</strong>
              <span>{preset.roles.length} {t("roles")}</span>
            </button>
          ))}
        </div>

        <fieldset className="intake-role-fieldset guided-role-fieldset">
          <legend>{t("Fine-tune included roles")}</legend>
          <div>
            {availableVendorRoles.map((role) => (
              <label key={role}>
                <input checked={intake.vendorRoles.includes(role)} onChange={() => toggleVendorRole(role)} type="checkbox" />
                <span>{role}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  function renderAdvancedDetails() {
    return (
      <div className="guided-advanced-grid">
        <label>
          <span>{t("Ceremony venue")}</span>
          <input onChange={(event) => updateIntake({ ceremonyLocation: event.target.value })} value={intake.ceremonyLocation} />
        </label>
        <label>
          <span>{t("Reception venue")}</span>
          <input onChange={(event) => updateIntake({ receptionLocation: event.target.value })} value={intake.receptionLocation} />
        </label>
        <label>
          <span>{t("Guest count")}</span>
          <input
            inputMode="numeric"
            max={300}
            min={2}
            onChange={(event) => updateIntake({ guestCount: Number(event.target.value) })}
            type="number"
            value={intake.guestCount}
          />
        </label>
      </div>
    );
  }
}

type IntakeSegmentProps = {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
};

function IntakeSegment({ label, onChange, options, value }: IntakeSegmentProps) {
  const { t } = useTranslation();

  return (
    <div className="intake-segment guided-intake-segment">
      <span>{label}</span>
      <div>
        {options.map(([optionValue, optionLabel]) => (
          <button
            aria-pressed={value === optionValue}
            data-active={value === optionValue}
            key={optionValue}
            onClick={() => onChange(optionValue)}
            type="button"
          >
            {t(optionLabel)}
          </button>
        ))}
      </div>
    </div>
  );
}

function getGeneratedReadiness(watchCount: number, roleCount: number) {
  return Math.max(58, Math.min(96, 84 + roleCount - watchCount * 6));
}

function getGuestCapacityLabel(guestCount: number) {
  if (guestCount <= 40) {
    return "Intimate plan";
  }

  if (guestCount <= 120) {
    return "Balanced plan";
  }

  if (guestCount <= 180) {
    return "Large plan";
  }

  return "High-capacity plan";
}

function getGuestCapacityCopy(guestCount: number) {
  if (guestCount <= 40) {
    return "The generated layout will feel close, calm, and easy to host.";
  }

  if (guestCount <= 120) {
    return "The generated layout will balance seating, aisle space, and service flow.";
  }

  if (guestCount <= 180) {
    return "The generated layout will protect timing buffers, guest movement, and table spacing.";
  }

  return "The generated layout will flag capacity, vendor flow, and arrival management as early decisions.";
}

function getPreviewPromise(questionId: IntakeQuestionId) {
  const promises: Record<IntakeQuestionId, string> = {
    foundation: "A named plan that feels ready to personalize.",
    guests: "A capacity-aware layout with tables, rows, and timing notes.",
    style: "A visual direction that guides ceremony, reception, and briefs.",
    support: "Role handoffs for the people who need to execute the day.",
    venue: "A venue-aware ceremony and reception structure."
  };

  return promises[questionId];
}

function getPreviewSupportCopy(questionId: IntakeQuestionId, riskCount: number) {
  if (questionId === "support") {
    return riskCount > 0 ? `${riskCount} watch notes will be carried into the first plan.` : "The first plan has no major generated watch notes.";
  }

  return "The preview updates as you answer, so the plan starts feeling useful before you save.";
}
