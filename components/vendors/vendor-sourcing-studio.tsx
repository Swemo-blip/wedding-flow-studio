"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import {
  buildVendorCandidateBrief,
  buildVendorIntelligence,
  createVendorCandidateFromSuggestion,
  formatPriceTier,
  formatVendorStatus,
  type VendorDecisionEntry
} from "@/lib/vendor-intelligence";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency } from "@/lib/wedding-budget";
import { VENDOR_CATEGORY_TO_CHECKLIST_TASK, useChecklist } from "@/lib/use-checklist";
import { buildVendorSearchSuggestions, getVendorSourcingSummary, vendorSourcingCategories } from "@/lib/vendor-sourcing";
import { useLocalProject } from "@/lib/use-local-project";
import type { SourcingPriority, VendorCandidate, VendorCandidateStatus, VendorPriceTier, VendorSearchSuggestion } from "@/lib/wedding-types";

const vendorStatusOptions: VendorCandidateStatus[] = ["shortlisted", "contacted", "quote-requested", "booked", "rejected"];
const priceTierOptions: VendorPriceTier[] = ["unknown", "budget", "standard", "premium", "luxury"];

export function VendorSourcingStudio() {
  const { t } = useTranslation();
  const { addVendorCandidate, updateVendorCandidate, vendorCandidates, wedding } = useLocalProject();
  const { markTaskDone } = useChecklist();
  const suggestions = useMemo(() => buildVendorSearchSuggestions(wedding), [wedding]);
  const summary = getVendorSourcingSummary(suggestions);
  const intelligence = useMemo(
    () => buildVendorIntelligence(vendorSourcingCategories, suggestions, vendorCandidates),
    [suggestions, vendorCandidates]
  );
  const bookedTotal = useMemo(
    () => vendorCandidates.filter((candidate) => candidate.status === "booked").reduce((sum, candidate) => sum + (Number(candidate.quote) || 0), 0),
    [vendorCandidates]
  );
  const [selectedId, setSelectedId] = useState(suggestions[0]?.id ?? "");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedId) ?? suggestions[0];
  const selectedDecision =
    intelligence.entries.find((entry) => entry.suggestion.id === selectedSuggestion?.id) ?? intelligence.entries[0];

  if (!selectedSuggestion || !selectedDecision) {
    return null;
  }

  function saveCandidate(suggestion: VendorSearchSuggestion) {
    const candidate = createVendorCandidateFromSuggestion(suggestion, vendorCandidates);

    addVendorCandidate(candidate);
    setCopyStatus(`${candidate.name} saved to the sourcing shortlist.`);
  }

  function setCandidateStatus(candidate: VendorCandidate, status: VendorCandidateStatus) {
    updateVendorCandidate(candidate.id, { status });

    if (status === "booked" && VENDOR_CATEGORY_TO_CHECKLIST_TASK[candidate.categoryId]) {
      markTaskDone(VENDOR_CATEGORY_TO_CHECKLIST_TASK[candidate.categoryId]);
      setCopyStatus(t("{name} booked — checked off on your checklist.", { name: candidate.name }));
    }
  }

  async function copySourcingBrief(suggestion: VendorSearchSuggestion) {
    const brief = [
      `${suggestion.label} sourcing brief`,
      `Location basis: ${suggestion.locationLabel}`,
      `Search query: ${suggestion.query}`,
      `Why it matters: ${suggestion.reason}`,
      `Checklist: ${suggestion.checklist.join("; ")}`
    ].join("\n");

    await navigator.clipboard.writeText(brief);
    setCopyStatus(`${suggestion.label} sourcing brief copied.`);
  }

  async function copyCandidateBrief(candidate: VendorCandidate, decision: VendorDecisionEntry) {
    await navigator.clipboard.writeText(buildVendorCandidateBrief(candidate, decision.category));
    setCopyStatus(`${candidate.name} candidate brief copied.`);
  }

  return (
    <StudioRouteFrame
      description="Turn each party need into a local search, save the best candidates, and track quotes and bookings in one place."
      eyebrow="Vendors"
      meta={[
        { label: "Booked", value: `${intelligence.bookedCount}` },
        { label: "Booked cost", value: formatCurrency(bookedTotal) },
        { label: "Open gaps", value: `${intelligence.openRequiredCount}` }
      ]}
      primaryAction={{ href: "/exports", label: "Prepare vendor brief" }}
      title="The team behind the day."
    >
      <div className="sourcing-studio">
        {intelligence.bestNextDecision ? (
          <div className="module-decision-strip" aria-label={t("Next vendor to lock")}>
            <div>
              <span>{t("Next vendor to lock")}</span>
              <strong>{intelligence.bestNextDecision.nextAction}</strong>
              <p>
                {intelligence.bestNextDecision.category.label} affects {intelligence.bestNextDecision.impactLabel.toLowerCase()} and is based on{" "}
                {intelligence.bestNextDecision.suggestion.locationLabel}.
              </p>
            </div>
            <button
              className="button button-secondary"
              onClick={() => {
                setSelectedId(intelligence.bestNextDecision?.suggestion.id ?? selectedSuggestion.id);
                setCopyStatus(null);
              }}
              type="button"
            >
              {t("Focus")}
            </button>
          </div>
        ) : null}

        <div className="sourcing-layout">
        <aside className="sourcing-queue" aria-label={t("Sourcing categories")}>
          <div>
            <span>{t("Location basis")}</span>
            <strong>{wedding.receptionLocation}</strong>
            <small>{t("Search links use ceremony and reception locations from the digital twin.")}</small>
          </div>

          <div className="sourcing-category-list">
            {intelligence.entries.map((entry) => (
              <button
                aria-pressed={entry.suggestion.id === selectedSuggestion.id}
                data-active={entry.suggestion.id === selectedSuggestion.id}
                key={entry.id}
                onClick={() => {
                  setSelectedId(entry.suggestion.id);
                  setCopyStatus(null);
                }}
                type="button"
              >
                <span>{t(formatPriority(entry.category.priority))}</span>
                <strong>{entry.category.label}</strong>
                <small>
                  {entry.readinessLabel} · {entry.suggestion.locationLabel}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <article className="sourcing-detail">
          <div className="sourcing-detail-header">
            <div>
              <Badge tone={getPriorityTone(selectedSuggestion.priority)}>{t(formatPriority(selectedSuggestion.priority))}</Badge>
              <h2>{selectedSuggestion.label}</h2>
              <p>{selectedSuggestion.reason}</p>
            </div>
            <div className="sourcing-role-card">
              <span>{t("Decision status")}</span>
              <strong>{selectedDecision.readinessLabel}</strong>
              <small>{selectedDecision.readinessScore}% {t("ready")}</small>
            </div>
          </div>

          <div className="sourcing-search-card">
            <span>{t("Suggested local search")}</span>
            <strong>{selectedSuggestion.query}</strong>
            <p>
              {t("Open live external results, save a candidate after review, then track fit, quote progress, and booking status inside Wedding Flow Studio.")}
            </p>
            <div className="sourcing-action-row">
              <a className="button button-primary" href={selectedSuggestion.mapsUrl} rel="noreferrer" target="_blank">
                {t("Open Map Search")}
              </a>
              <button className="button button-secondary" onClick={() => saveCandidate(selectedSuggestion)} type="button">
                {t("Save Candidate")}
              </button>
              <a className="sourcing-text-link" href={selectedSuggestion.webUrl} rel="noreferrer" target="_blank">
                {t("Search Web")}
              </a>
            </div>
            {copyStatus ? <p className="sourcing-copy-status">{copyStatus}</p> : null}
          </div>

          <div className="vendor-intelligence-panel">
            <div className="vendor-panel-header">
              <div>
                <span>{t("Candidate intelligence")}</span>
                <strong>{selectedDecision.nextAction}</strong>
                {bookedTotal > 0 ? (
                  <small className="vendor-panel-money">
                    <strong>{formatCurrency(bookedTotal)}</strong> {t("committed to booked vendors")}
                  </small>
                ) : null}
              </div>
              <button className="button button-ghost" onClick={() => copySourcingBrief(selectedSuggestion)} type="button">
                {t("Copy Brief")}
              </button>
            </div>

            {selectedDecision.candidates.length > 0 ? (
              <div className="vendor-candidate-list">
                {selectedDecision.candidates.map((candidate) => (
                  <article className="vendor-candidate-card" key={candidate.id}>
                    <div className="vendor-candidate-main">
                      <div>
                        <span>{t(formatVendorStatus(candidate.status))}</span>
                        <strong>{candidate.name}</strong>
                        <p>{candidate.notes}</p>
                      </div>
                      <div className="vendor-candidate-stats">
                        <div className="vendor-fit-score">
                          <span>{t("Fit")}</span>
                          <strong>{candidate.fitScore}%</strong>
                        </div>
                        {candidate.quote > 0 ? (
                          <div className="vendor-fit-score vendor-quote-figure">
                            <span>{t("Quote")}</span>
                            <strong>{formatCurrency(candidate.quote)}</strong>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="vendor-candidate-controls">
                      <label>
                        {t("Status")}
                        <select
                          aria-label={`${t("Status")} – ${candidate.name}`}
                          onChange={(event) => setCandidateStatus(candidate, event.target.value as VendorCandidateStatus)}
                          value={candidate.status}
                        >
                          {vendorStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {t(formatVendorStatus(status))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("Price tier")}
                        <select
                          aria-label={`${t("Price tier")} – ${candidate.name}`}
                          onChange={(event) => updateVendorCandidate(candidate.id, { priceTier: event.target.value as VendorPriceTier })}
                          value={candidate.priceTier}
                        >
                          {priceTierOptions.map((tier) => (
                            <option key={tier} value={tier}>
                              {t(formatPriceTier(tier))}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t("Quote")}
                        <input
                          aria-label={`${t("Quote")} – ${candidate.name}`}
                          inputMode="numeric"
                          min={0}
                          onChange={(event) => updateVendorCandidate(candidate.id, { quote: Math.max(0, Number(event.target.value) || 0) })}
                          type="number"
                          value={candidate.quote ?? 0}
                        />
                      </label>
                      <button className="button button-ghost" onClick={() => copyCandidateBrief(candidate, selectedDecision)} type="button">
                        {t("Copy Candidate")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="vendor-empty-state">
                <strong>{t("No candidate saved yet.")}</strong>
                <p>{t("Open the map search, review real local options, then save the strongest candidate into this decision studio.")}</p>
              </div>
            )}
          </div>

          <div className="sourcing-detail-grid">
            <div>
              <span>{t("Needed for")}</span>
              <ul>
                {selectedDecision.category.neededFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>{t("Ask before booking")}</span>
              <ul>
                {selectedSuggestion.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </div>

      <details className="sourcing-full-list">
        <summary>
          <span>{t("All sourcing decisions")}</span>
          <small>{t("Open the complete party and production sourcing list.")}</small>
        </summary>
        <div>
          {intelligence.entries.map((entry) => (
            <article key={entry.id}>
              <Badge tone={getPriorityTone(entry.category.priority)}>{formatPriority(entry.category.priority)}</Badge>
              <strong>{entry.category.label}</strong>
              <p>
                {entry.readinessLabel} · {entry.nextAction}
              </p>
            </article>
          ))}
        </div>
      </details>
      </div>
    </StudioRouteFrame>
  );
}

function formatPriority(priority: SourcingPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getPriorityTone(priority: SourcingPriority) {
  if (priority === "required") {
    return "high";
  }

  if (priority === "recommended") {
    return "medium";
  }

  return "neutral";
}
