"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskList } from "@/components/wedding/risk-list";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { useTranslation } from "@/lib/i18n";
import { buildRoleProductionBoard } from "@/lib/role-production";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { useLocalProject } from "@/lib/use-local-project";
import type { RoleBrief } from "@/lib/wedding-types";

type RoleProductionBoardProps = {
  brief: RoleBrief;
  roleSelector?: React.ReactNode;
};

export function RoleProductionBoard({ brief, roleSelector }: RoleProductionBoardProps) {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState(t("Ready to brief"));
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
      setCopyStatus(t("Production brief copied"));
      setShowManualCopy(false);
    } catch {
      setCopyStatus(t("Brief text ready below"));
      setShowManualCopy(true);
    }
  }

  return (
    <section className="director-production-board" aria-label={`${board.title} production board`}>
      <div className="director-live-hero">
        <div>
          <p className="eyebrow">{t("Live Role Production Board")}</p>
          <h3>{board.title}</h3>
          <p>{t(board.description)}</p>
        </div>
        <div className="director-live-actions">
          {roleSelector}
          <span className="director-state-line" data-tone="confirmed">{hasLocalProject ? t("Live project state") : t("Sample project")}</span>
          <span className="director-state-line" data-tone={board.readiness === "critical" ? "high" : board.readiness === "attention" ? "medium" : "confirmed"}>
            {board.readinessLabel}
          </span>
          <Button onClick={copyProductionBrief} size="small" variant={board.readyToBrief ? "primary" : "secondary"}>
            {board.readyToBrief ? t("Copy Ready Brief") : t("Copy Working Brief")}
          </Button>
          <span aria-live="polite" className="copy-status">{copyStatus}</span>
        </div>
      </div>

      {showManualCopy ? (
        <div className="director-copy-fallback">
          <label className="field">
            <span>{t("Manual copy brief")}</span>
            <textarea readOnly rows={7} value={board.copyText} />
          </label>
        </div>
      ) : null}

      <div className="director-command-strip">
        <div>
          <span>{t("Current phase")}</span>
          <strong>{t(board.currentPhase)}</strong>
        </div>
        <div>
          <span>{t("Next up")}</span>
          <strong>{board.nextUp}</strong>
        </div>
        <div>
          <span>{t("Ready to brief")}</span>
          <strong>{board.readyToBrief ? t("Yes") : t("Review first")}</strong>
        </div>
      </div>

      <div className="director-board-grid">
        <Card className="director-queue-card">
          <CardContent>
            <div className="summary-between">
              <div>
                <p className="eyebrow">{t("Production Queue")}</p>
                <h3 className="card-title">{t("Role-specific timeline")}</h3>
              </div>
              <span className="director-count-line">{board.timeline.length} {t("moments")}</span>
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
                    {item.isSecret ? <span data-tone="secret">{t("Secret")}</span> : null}
                    <span data-tone={item.hasWarning ? "medium" : "confirmed"}>{item.hasWarning ? t("Attention") : t("Clear")}</span>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <aside className="director-side-stack">
          <Card>
            <CardContent>
              <p className="eyebrow">{t("Handoffs")}</p>
              <h3 className="card-title">{t("What this role needs next")}</h3>
              <ul className="director-handoff-list">
                {board.handoffs.map((handoff) => (
                  <li key={handoff.id}>
                    <div className="summary-between">
                      <strong>{handoff.label}</strong>
                      <span className="director-count-line" data-tone={handoff.severity === "clear" ? "confirmed" : handoff.severity}>{handoff.timing}</span>
                    </div>
                    <p>{handoff.detail}</p>
                    <small>
                      {handoff.from} {t("to")} {handoff.to}
                    </small>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <p className="eyebrow">{t("Coordinate with")}</p>
              <h3 className="card-title">{board.contacts[0]}</h3>
              <div className="contact-list">
                <span>{board.readyToBrief ? t("Brief can be sent after final review.") : t("Review warnings before sending the brief.")}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <details className="director-role-detail-drawer">
        <summary>
          <span>{t("Brief Details")}</span>
          <small>{t("Open checklist, contacts, and role-specific warnings when preparing the final handoff.")}</small>
        </summary>

        <div className="director-role-detail-grid">
          <Card>
            <CardContent>
              <p className="eyebrow">{t("Checklist")}</p>
              <h3 className="card-title">{t("Day-of checks")}</h3>
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
              <p className="eyebrow">{t("Coordinate with")}</p>
              <h3 className="card-title">{t("Roles to coordinate")}</h3>
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
                  <p className="eyebrow">{t("Needs Attention")}</p>
                  <h3 className="card-title">{board.warnings.length > 0 ? t("Role-specific warnings") : t("This role is clear.")}</h3>
                </div>
                <span className="director-count-line" data-tone={board.warnings.length > 0 ? "medium" : "confirmed"}>
                  {board.warnings.length > 0 ? `${board.warnings.length} ${t("active")}` : t("Ready")}
                </span>
              </div>
              {board.warnings.length > 0 ? (
                <RiskList risks={board.warnings} />
              ) : (
                <p className="card-copy">{t("No active warnings remain for this role. The brief is ready to send.")}</p>
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
