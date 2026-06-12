"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { StudioCommand } from "@/components/ui/studio-command";
import {
  buildVendorCandidateBrief,
  buildVendorIntelligence,
  createVendorCandidateFromSuggestion,
  formatPriceTier,
  formatVendorStatus,
  type VendorDecisionEntry
} from "@/lib/vendor-intelligence";
import { buildVendorSearchSuggestions, getVendorSourcingSummary, vendorSourcingCategories } from "@/lib/vendor-sourcing";
import { useLocalProject } from "@/lib/use-local-project";
import type { SourcingPriority, VendorCandidate, VendorCandidateStatus, VendorPriceTier, VendorSearchSuggestion } from "@/lib/wedding-types";

const vendorStatusOptions: VendorCandidateStatus[] = ["shortlisted", "contacted", "quote-requested", "booked", "rejected"];
const priceTierOptions: VendorPriceTier[] = ["unknown", "budget", "standard", "premium", "luxury"];

export function VendorSourcingStudio() {
  const { addVendorCandidate, updateVendorCandidate, vendorCandidates, wedding } = useLocalProject();
  const suggestions = useMemo(() => buildVendorSearchSuggestions(wedding), [wedding]);
  const summary = getVendorSourcingSummary(suggestions);
  const intelligence = useMemo(
    () => buildVendorIntelligence(vendorSourcingCategories, suggestions, vendorCandidates),
    [suggestions, vendorCandidates]
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
    <section className="sourcing-studio" aria-label="Production Sourcing">
      <StudioCommand
        actions={[{ href: "/exports", label: "Prepare Vendor Brief" }]}
        description="Turn party needs into location-aware searches, save vendor candidates, and keep every sourcing decision connected to the wedding-day digital twin."
        eyebrow="Production Sourcing"
        metrics={[
          { label: "Readiness", tone: intelligence.readinessAverage >= 70 ? "confirmed" : "medium", value: `${intelligence.readinessAverage}%` },
          { label: "Candidates", value: `${intelligence.candidateCount}` },
          { label: "Booked", tone: intelligence.bookedCount > 0 ? "confirmed" : "neutral", value: `${intelligence.bookedCount}` },
          { label: "Required gaps", tone: intelligence.openRequiredCount > 0 ? "medium" : "confirmed", value: `${intelligence.openRequiredCount}` }
        ]}
        status={{ label: "Vendor fit live", tone: intelligence.openRequiredCount > 0 ? "medium" : "confirmed" }}
        title="Find, shortlist, and compare the real-world services behind the wedding flow."
      >
        {intelligence.bestNextDecision ? (
          <div className="module-decision-strip" aria-label="Best next vendor decision">
            <div>
              <span>Best vendor decision</span>
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
              Focus Decision
            </button>
          </div>
        ) : null}
      </StudioCommand>

      <div className="sourcing-layout">
        <aside className="sourcing-queue" aria-label="Sourcing categories">
          <div>
            <span>Location basis</span>
            <strong>{wedding.receptionLocation}</strong>
            <small>Search links use ceremony and reception locations from the digital twin.</small>
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
                <span>{formatPriority(entry.category.priority)}</span>
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
              <Badge tone={getPriorityTone(selectedSuggestion.priority)}>{formatPriority(selectedSuggestion.priority)}</Badge>
              <h2>{selectedSuggestion.label}</h2>
              <p>{selectedSuggestion.reason}</p>
            </div>
            <div className="sourcing-role-card">
              <span>Decision status</span>
              <strong>{selectedDecision.readinessLabel}</strong>
              <small>{selectedDecision.readinessScore}% ready</small>
            </div>
          </div>

          <div className="sourcing-search-card">
            <span>Suggested local search</span>
            <strong>{selectedSuggestion.query}</strong>
            <p>
              Open live external results, save a candidate after review, then track fit, quote progress, and booking status inside Wedding Flow Studio.
            </p>
            <div className="sourcing-action-row">
              <a className="button button-primary" href={selectedSuggestion.mapsUrl} rel="noreferrer" target="_blank">
                Open Map Search
              </a>
              <button className="button button-secondary" onClick={() => saveCandidate(selectedSuggestion)} type="button">
                Save Candidate
              </button>
              <a className="sourcing-text-link" href={selectedSuggestion.webUrl} rel="noreferrer" target="_blank">
                Search Web
              </a>
            </div>
            {copyStatus ? <p className="sourcing-copy-status">{copyStatus}</p> : null}
          </div>

          <div className="vendor-intelligence-panel">
            <div className="vendor-panel-header">
              <div>
                <span>Candidate intelligence</span>
                <strong>{selectedDecision.nextAction}</strong>
              </div>
              <button className="button button-ghost" onClick={() => copySourcingBrief(selectedSuggestion)} type="button">
                Copy Brief
              </button>
            </div>

            {selectedDecision.candidates.length > 0 ? (
              <div className="vendor-candidate-list">
                {selectedDecision.candidates.map((candidate) => (
                  <article className="vendor-candidate-card" key={candidate.id}>
                    <div className="vendor-candidate-main">
                      <div>
                        <span>{formatVendorStatus(candidate.status)}</span>
                        <strong>{candidate.name}</strong>
                        <p>{candidate.notes}</p>
                      </div>
                      <div className="vendor-fit-score">
                        <span>Fit</span>
                        <strong>{candidate.fitScore}%</strong>
                      </div>
                    </div>

                    <div className="vendor-candidate-controls">
                      <label>
                        Status
                        <select
                          aria-label={`Status for ${candidate.name}`}
                          onChange={(event) =>
                            updateVendorCandidate(candidate.id, { status: event.target.value as VendorCandidateStatus })
                          }
                          value={candidate.status}
                        >
                          {vendorStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {formatVendorStatus(status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Price tier
                        <select
                          aria-label={`Price tier for ${candidate.name}`}
                          onChange={(event) => updateVendorCandidate(candidate.id, { priceTier: event.target.value as VendorPriceTier })}
                          value={candidate.priceTier}
                        >
                          {priceTierOptions.map((tier) => (
                            <option key={tier} value={tier}>
                              {formatPriceTier(tier)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="button button-ghost" onClick={() => copyCandidateBrief(candidate, selectedDecision)} type="button">
                        Copy Candidate
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="vendor-empty-state">
                <strong>No candidate saved yet.</strong>
                <p>Open the map search, review real local options, then save the strongest candidate into this decision studio.</p>
              </div>
            )}
          </div>

          <div className="sourcing-detail-grid">
            <div>
              <span>Needed for</span>
              <ul>
                {selectedDecision.category.neededFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span>Ask before booking</span>
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
          <span>All sourcing decisions</span>
          <small>Open the complete party and production sourcing list.</small>
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
    </section>
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
