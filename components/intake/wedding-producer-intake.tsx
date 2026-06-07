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
import { createStoredProjectDraft, writeStoredProject } from "@/lib/local-project-store";

const styleOptions = Object.entries(stylePresetLabels) as Array<[WeddingStylePreset, string]>;
const ceremonyOptions = Object.entries(ceremonyFormatLabels) as Array<[CeremonyFormat, string]>;
const receptionOptions = Object.entries(receptionFormatLabels) as Array<[ReceptionFormat, string]>;
const complexityOptions = Object.entries(complexityLabels) as Array<[ProductionComplexity, string]>;

export function WeddingProducerIntake() {
  const router = useRouter();
  const [intake, setIntake] = useState<WeddingProducerIntakeState>(defaultWeddingProducerIntake);
  const [status, setStatus] = useState<string | null>(null);
  const plan = useMemo(() => composeWeddingProducerPlan(intake), [intake]);
  const coreRoleCount = intake.vendorRoles.length;

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

  function createDigitalTwin() {
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

    setStatus(
      storedProject
        ? "Your first wedding-day digital twin is ready in this browser."
        : "The browser could not save this project yet. Review storage settings and try again."
    );
  }

  return (
    <div className="intake-studio">
      <section className="intake-hero" aria-labelledby="intake-title">
        <div>
          <p className="eyebrow">Wedding Producer Intake</p>
          <h1 id="intake-title">Build the first digital twin in one calm pass.</h1>
          <p>
            Answer a few production questions. Wedding Flow Studio composes the first day flow, cue sheet, reception map, role handoffs, and rehearsal watch list.
          </p>
        </div>
        <div className="intake-hero-card" aria-label="Generated project readiness">
          <span>Generated readiness</span>
          <strong>{getGeneratedReadiness(plan.generatedRisks.length, coreRoleCount)}%</strong>
          <small>{plan.generatedRisks.length === 0 ? "Ready to preview" : `${plan.generatedRisks.length} watch notes`}</small>
        </div>
      </section>

      <section className="intake-layout" aria-label="Wedding Producer Intake composer">
        <form className="intake-form" onSubmit={(event) => event.preventDefault()}>
          <div className="intake-section-heading">
            <span>Foundation</span>
            <strong>Who, when, and where?</strong>
          </div>

          <div className="intake-field-grid">
            <label>
              <span>Partner one</span>
              <input
                onChange={(event) => updateIntake({ partnerOneName: event.target.value })}
                value={intake.partnerOneName}
              />
            </label>
            <label>
              <span>Partner two</span>
              <input
                onChange={(event) => updateIntake({ partnerTwoName: event.target.value })}
                value={intake.partnerTwoName}
              />
            </label>
            <label>
              <span>Wedding date</span>
              <input onChange={(event) => updateIntake({ date: event.target.value })} value={intake.date} />
            </label>
            <label>
              <span>Guest count</span>
              <input
                inputMode="numeric"
                min={2}
                max={300}
                onChange={(event) => updateIntake({ guestCount: Number(event.target.value) })}
                type="number"
                value={intake.guestCount}
              />
            </label>
            <label>
              <span>Ceremony venue</span>
              <input
                onChange={(event) => updateIntake({ ceremonyLocation: event.target.value })}
                value={intake.ceremonyLocation}
              />
            </label>
            <label>
              <span>Reception venue</span>
              <input
                onChange={(event) => updateIntake({ receptionLocation: event.target.value })}
                value={intake.receptionLocation}
              />
            </label>
          </div>

          <div className="intake-section-heading">
            <span>Production style</span>
            <strong>What kind of day should the studio compose?</strong>
          </div>

          <div className="intake-choice-grid">
            <IntakeSegment
              label="Wedding style"
              onChange={(value) => updateIntake({ stylePreset: value as WeddingStylePreset })}
              options={styleOptions}
              value={intake.stylePreset}
            />
            <IntakeSegment
              label="Ceremony format"
              onChange={(value) => updateIntake({ ceremonyFormat: value as CeremonyFormat })}
              options={ceremonyOptions}
              value={intake.ceremonyFormat}
            />
            <IntakeSegment
              label="Reception format"
              onChange={(value) => updateIntake({ receptionFormat: value as ReceptionFormat })}
              options={receptionOptions}
              value={intake.receptionFormat}
            />
            <IntakeSegment
              label="Production complexity"
              onChange={(value) => updateIntake({ complexity: value as ProductionComplexity })}
              options={complexityOptions}
              value={intake.complexity}
            />
          </div>

          <fieldset className="intake-role-fieldset">
            <legend>Who is already involved?</legend>
            <div>
              {availableVendorRoles.map((role) => (
                <label key={role}>
                  <input
                    checked={intake.vendorRoles.includes(role)}
                    onChange={() => toggleVendorRole(role)}
                    type="checkbox"
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="intake-create-card">
            <div>
              <span>Producer action</span>
              <strong>Create the first wedding-day digital twin.</strong>
              <p>
                This saves a local project with generated timeline, cue sheet, speeches, guest journey, tables, and role handoffs.
              </p>
            </div>
            <Button onClick={createDigitalTwin} size="small">
              Create Digital Twin
            </Button>
          </div>

          <p aria-live="polite" className="copy-status">
            {status ?? "Nothing is saved until you create the digital twin."}
          </p>
        </form>

        <aside className="intake-preview-panel">
          <div className="intake-preview-header">
            <p className="eyebrow">Generated Twin Preview</p>
            <h2>{plan.wedding.coupleNames}</h2>
            <p>
              {plan.wedding.date} at {plan.wedding.ceremonyLocation} and {plan.wedding.receptionLocation}
            </p>
          </div>

          <div className="intake-preview-metrics">
            <div>
              <span>Moments</span>
              <strong>{plan.timelineItems.length}</strong>
            </div>
            <div>
              <span>Cues</span>
              <strong>{plan.musicCues.length}</strong>
            </div>
            <div>
              <span>Tables</span>
              <strong>{plan.dinnerTables.length}</strong>
            </div>
            <div>
              <span>Roles</span>
              <strong>{coreRoleCount}</strong>
            </div>
          </div>

          <div className="intake-flow-preview">
            <span>First day flow</span>
            {plan.timelineItems.slice(0, 8).map((item) => (
              <article key={item.id}>
                <small>{item.time}</small>
                <strong>{item.phase}</strong>
                <p>{item.location}</p>
              </article>
            ))}
          </div>

          <div className="intake-notes-grid">
            <div>
              <span>Producer notes</span>
              <ul>
                {plan.producerNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>Watch list</span>
              <ul>
                {(plan.generatedRisks.length > 0 ? plan.generatedRisks : ["No major setup gaps in the first generated twin."]).map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="intake-next-actions">
            <Button href="/preview" size="small" variant="secondary">
              Preview Wedding Day
            </Button>
            <Button href="/" size="small" variant="ghost">
              Open Studio Cockpit
            </Button>
            <Button onClick={() => router.push("/day-flow")} size="small" variant="ghost">
              Review Day Flow
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}

type IntakeSegmentProps = {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
};

function IntakeSegment({ label, onChange, options, value }: IntakeSegmentProps) {
  return (
    <div className="intake-segment">
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
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function getGeneratedReadiness(watchCount: number, roleCount: number) {
  return Math.max(58, Math.min(96, 84 + roleCount - watchCount * 6));
}
