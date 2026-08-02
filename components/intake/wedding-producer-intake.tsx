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
import { fileToDownscaledDataUrl } from "@/lib/image-upload";
import { useTranslation } from "@/lib/i18n";
import { useCouplePhotos, type CoupleRole } from "@/lib/use-couple-photos";
import { createStoredProjectDraft, readStoredProject, writeStoredProject } from "@/lib/local-project-store";
import { confirmAndBackupBeforeReset } from "@/lib/project-backup";
import { clearStoredBudget } from "@/lib/use-budget";
import { clearStoredCurrency } from "@/lib/use-currency";
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

// Three questions, not five. Venue format, style and collaborators all still
// shape the generated plan, but they are decisions with sane defaults that a
// couple can revisit — asking them before the couple has seen anything put four
// screens between "I want to try this" and the church. They now live in the
// Advanced fold below, unchanged and still real.
type IntakeQuestionId = "foundation" | "guests" | "portrait";

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
    id: "guests",
    kicker: "Question 2",
    summary: "Guest count drives seating, flow, timing, and comfort.",
    title: "How many guests should the plan support?"
  },
  {
    id: "portrait",
    kicker: "Question 3",
    summary: "Optional — your faces appear on the couple in the 3D church.",
    title: "Add a photo of each of you?"
  }
];

export function WeddingProducerIntake() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [intake, setIntake] = useState<WeddingProducerIntakeState>(defaultWeddingProducerIntake);
  const [status, setStatus] = useState<string | null>(null);
  // Portraits are held here and only committed to the photo store when the plan
  // is created. Writing them on upload would leave an abandoned intake's faces
  // in storage, and would land them before the reset below could clear the
  // previous couple's — so the new couple would look at someone else's face.
  const [portraits, setPortraits] = useState<Record<CoupleRole, string | null>>({ bride: null, groom: null });
  const { setPhoto } = useCouplePhotos();
  const plan = useMemo(() => composeWeddingProducerPlan(intake), [intake]);
  const activeQuestion = intakeQuestions[activeQuestionIndex];
  const coreRoleCount = intake.vendorRoles.length;
  const isFinalQuestion = activeQuestionIndex === intakeQuestions.length - 1;
  // Same role mapping the guest studio uses: partner one is the groom figure.
  // The slots take the names once they are typed, so nobody has to guess which
  // face they are uploading.
  const portraitSlots: Array<{ label: string; photo: string | null; role: CoupleRole }> = [
    { label: intake.partnerOneName.trim() || t("Partner one"), photo: portraits.groom, role: "groom" },
    { label: intake.partnerTwoName.trim() || t("Partner two"), photo: portraits.bride, role: "bride" }
  ];

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

  async function handlePortrait(role: CoupleRole, file: File | null) {
    if (!file) {
      return;
    }

    setStatus(null);
    const dataUrl = await fileToDownscaledDataUrl(file);
    setPortraits((current) => ({ ...current, [role]: dataUrl }));
  }

  function goToNextQuestion() {
    setActiveQuestionIndex((currentIndex) => Math.min(intakeQuestions.length - 1, currentIndex + 1));
  }

  function goToPreviousQuestion() {
    setActiveQuestionIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }

  function createDigitalTwin(redirectTo?: string) {
    // The form now starts blank rather than pre-filled with the sample couple, so
    // guard the essentials: a plan saved without names or a date would leave the
    // studio, exports and share link headed by a placeholder couple.
    if (!intake.partnerOneName.trim() || !intake.partnerTwoName.trim()) {
      setActiveQuestionIndex(0);
      setStatus(t("Add both of your names before creating the plan."));
      return;
    }

    if (!intake.date.trim()) {
      setActiveQuestionIndex(0);
      setStatus(t("Add your wedding date before creating the plan."));
      return;
    }

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
    clearStoredCurrency();
    clearStoredWeddingStudioLayout();

    // Written after the reset, and written unconditionally: passing null clears
    // the slot, so a couple who skipped this step never inherits the faces of
    // whoever used this browser before them.
    setPhoto("groom", portraits.groom);
    setPhoto("bride", portraits.bride);

    setStatus("Your first visual wedding plan is ready in this browser.");

    if (redirectTo) {
      router.push(redirectTo);
    }
  }

  return (
    <div className="intake-studio guided-intake-studio">
      <section className="intake-hero guided-intake-hero" aria-labelledby="intake-title">
        <div>
          <p className="eyebrow">{t("Start with 3 questions")}</p>
          <h1 id="intake-title">{t("Get a first visual wedding plan before you start editing.")}</h1>
          <p>
            {t("Answer a few calm questions and watch your day take shape.")}
          </p>
        </div>
        {/* There was a "Generated readiness" percentage here: 84 + roles - 6*risks,
            clamped to 58-96. No denominator, nothing measured, and it went UP when
            you ticked a vendor checkbox. The first screen a couple sees was
            asserting a confidence figure about their own wedding as fact. The
            counts below it are real and stay; the invented number is gone. */}
        <div className="intake-hero-card" aria-label={t("Watch notes")}>
          <span>{t("Watch notes")}</span>
          <strong>{plan.generatedRisks.length}</strong>
          <small>{plan.generatedRisks.length === 0 ? t("Ready to preview") : t("to review before the day")}</small>
        </div>
      </section>

      <section className="guided-intake-shell" aria-label={t("Guided first wedding plan")}>
        <aside className="guided-intake-steps" aria-label={t("Three question progress")}>
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
              <small>{t("Format, style, venues and who is involved — all have sensible defaults.")}</small>
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
            <input
              autoFocus
              onChange={(event) => updateIntake({ partnerOneName: event.target.value })}
              placeholder={t("First name")}
              value={intake.partnerOneName}
            />
          </label>
          <label>
            <span>{t("Partner two")}</span>
            <input
              onChange={(event) => updateIntake({ partnerTwoName: event.target.value })}
              placeholder={t("First name")}
              value={intake.partnerTwoName}
            />
          </label>
          <label>
            <span>{t("Wedding date")}</span>
            <input onChange={(event) => updateIntake({ date: event.target.value })} type="date" value={intake.date} />
          </label>
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

    // The last question is the only optional one, so it says so and can be
    // walked past. The faces land on the couple in the church, which is the
    // whole reason to ask.
    return (
      <div className="guided-portraits">
        {portraitSlots.map(({ label, photo, role }) => (
          <div className="guided-portrait-slot" key={role}>
            <span className="guests-avatar couple-face-avatar" data-has-photo={photo ? "true" : undefined}>
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={photo} />
                  <button
                    aria-label={t("Remove photo")}
                    className="guests-avatar-remove"
                    onClick={() => setPortraits((current) => ({ ...current, [role]: null }))}
                    type="button"
                  >
                    ×
                  </button>
                </>
              ) : (
                <label className="guests-avatar-add" title={t("Add photo")}>
                  <span aria-hidden="true">+</span>
                  <input
                    accept="image/*"
                    hidden
                    onChange={(event) => void handlePortrait(role, event.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <span className="sr-only">{t("Add photo")}</span>
                </label>
              )}
            </span>
            <small>{label}</small>
          </div>
        ))}
      </div>
    );
  }

  function renderAdvancedDetails() {
    return (
      <>
        <div className="guided-advanced-stack">
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

        <div className="guided-advanced-grid">
        {/* Venues stay optional — plenty of couples plan before they have booked —
            so these carry a hint rather than a required marker. */}
        <label>
          <span>{t("Ceremony venue")}</span>
          <input
            onChange={(event) => updateIntake({ ceremonyLocation: event.target.value })}
            placeholder={t("Not booked yet")}
            value={intake.ceremonyLocation}
          />
        </label>
        <label>
          <span>{t("Reception venue")}</span>
          <input
            onChange={(event) => updateIntake({ receptionLocation: event.target.value })}
            placeholder={t("Not booked yet")}
            value={intake.receptionLocation}
          />
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
      </>
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
    portrait: "Your own faces on the couple at the altar."
  };

  return promises[questionId];
}

function getPreviewSupportCopy(questionId: IntakeQuestionId, riskCount: number) {
  if (questionId === "portrait") {
    return riskCount > 0 ? `${riskCount} watch notes will be carried into the first plan.` : "The first plan has no major generated watch notes.";
  }

  return "The preview updates as you answer, so the plan starts feeling useful before you save.";
}
