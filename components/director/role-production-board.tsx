"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskList } from "@/components/wedding/risk-list";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { buildRoleProductionBoard } from "@/lib/role-production";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import type { RoleBrief } from "@/lib/wedding-types";

type RoleProductionBoardProps = {
  brief: RoleBrief;
};

export function RoleProductionBoard({ brief }: RoleProductionBoardProps) {
  const [copyStatus, setCopyStatus] = useState("Ready to brief");
  const [showManualCopy, setShowManualCopy] = useState(false);
  const { dinnerTables, guests, hasLocalProject, musicCues, speeches, timelineItems } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const risks = useMemo(
    () =>
      filterResolvedRisks(
        analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues, speechItems: speeches, guestItems: guests, tables: dinnerTables }),
        resolvedRiskIds
      ),
    [dinnerTables, guests, musicCues, resolvedRiskIds, speeches, timelineItems]
  );
  const board = useMemo(
    () => buildRoleProductionBoard(brief, timelineItems, risks, musicCues, speeches),
    [brief, musicCues, risks, speeches, timelineItems]
  );

  async function copyProductionBrief() {
    try {
      await copyTextToClipboard(board.copyText);
      setCopyStatus("Production brief copied");
      setShowManualCopy(false);
    } catch {
      setCopyStatus("Brief text ready below");
      setShowManualCopy(true);
    }
  }

  return (
    <section className="director-production-board" aria-label={`${board.title} production board`}>
      <div className="director-live-hero">
        <div>
          <p className="eyebrow">Live Role Production Board</p>
          <h3>{board.title}</h3>
          <p>{board.description}</p>
        </div>
        <div className="director-live-actions">
          <span className="director-state-line" data-tone="confirmed">{hasLocalProject ? "Live project state" : "Sample project"}</span>
          <span className="director-state-line" data-tone={board.readiness === "critical" ? "high" : board.readiness === "attention" ? "medium" : "confirmed"}>
            {board.readinessLabel}
          </span>
          <Button onClick={copyProductionBrief} size="small" variant={board.readyToBrief ? "primary" : "secondary"}>
            {board.readyToBrief ? "Copy Ready Brief" : "Copy Working Brief"}
          </Button>
          <span aria-live="polite" className="copy-status">{copyStatus}</span>
        </div>
      </div>

      {showManualCopy ? (
        <div className="director-copy-fallback">
          <label className="field">
            <span>Manual copy brief</span>
            <textarea readOnly rows={7} value={board.copyText} />
          </label>
        </div>
      ) : null}

      <div className="director-command-strip">
        <div>
          <span>Current phase</span>
          <strong>{board.currentPhase}</strong>
        </div>
        <div>
          <span>Next up</span>
          <strong>{board.nextUp}</strong>
        </div>
        <div>
          <span>Ready to brief</span>
          <strong>{board.readyToBrief ? "Yes" : "Review first"}</strong>
        </div>
      </div>

      <div className="director-board-grid">
        <Card className="director-queue-card">
          <CardContent>
            <div className="summary-between">
              <div>
                <p className="eyebrow">Production Queue</p>
                <h3 className="card-title">Role-specific timeline</h3>
              </div>
              <span className="director-count-line">{board.timeline.length} moments</span>
            </div>
            <ol className="director-production-queue">
              {board.timeline.map((item) => (
                <li data-secret={item.isSecret} data-warning={item.hasWarning} key={item.id}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.location} - {item.owner}</p>
                    <small>{item.cue}</small>
                  </div>
                  <div className="director-queue-status">
                    {item.isSecret ? <span data-tone="secret">Secret</span> : null}
                    <span data-tone={item.hasWarning ? "medium" : "confirmed"}>{item.hasWarning ? "Attention" : "Clear"}</span>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <aside className="director-side-stack">
          <Card>
            <CardContent>
              <p className="eyebrow">Handoffs</p>
              <h3 className="card-title">What this role needs next</h3>
              <ul className="director-handoff-list">
                {board.handoffs.map((handoff) => (
                  <li key={handoff.id}>
                    <div className="summary-between">
                      <strong>{handoff.label}</strong>
                      <span className="director-count-line" data-tone={handoff.severity === "clear" ? "confirmed" : handoff.severity}>{handoff.timing}</span>
                    </div>
                    <p>{handoff.detail}</p>
                    <small>
                      {handoff.from} to {handoff.to}
                    </small>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="eyebrow">Primary Contact</p>
              <h3 className="card-title">{board.contacts[0]}</h3>
              <div className="contact-list">
                <span>{board.readyToBrief ? "Brief can be sent after final review." : "Review warnings before sending the brief."}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <details className="director-role-detail-drawer">
        <summary>
          <span>Brief Details</span>
          <small>Open checklist, contacts, and role-specific warnings when preparing the final handoff.</small>
        </summary>

        <div className="director-role-detail-grid">
          <Card>
            <CardContent>
              <p className="eyebrow">Checklist</p>
              <h3 className="card-title">Day-of checks</h3>
              <ul className="check-list">
                {board.checklistItems.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="eyebrow">Contacts</p>
              <h3 className="card-title">Important contacts</h3>
              <div className="contact-list">
                {board.contacts.map((contact, index) => (
                  index === 0 ? <strong key={contact}>{contact}</strong> : <span key={contact}>{contact}</span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="director-warning-board">
            <CardContent>
              <div className="summary-between">
                <div>
                  <p className="eyebrow">Needs Attention</p>
                  <h3 className="card-title">{board.warnings.length > 0 ? "Role-specific warnings" : "This role is clear."}</h3>
                </div>
                <span className="director-count-line" data-tone={board.warnings.length > 0 ? "medium" : "confirmed"}>
                  {board.warnings.length > 0 ? `${board.warnings.length} active` : "Ready"}
                </span>
              </div>
              {board.warnings.length > 0 ? (
                <RiskList risks={board.warnings} />
              ) : (
                <p className="card-copy">No active warnings remain for this role. The brief is ready to send.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </details>
    </section>
  );
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy copy path when browser permissions block the Clipboard API.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Clipboard copy failed");
  }
}
