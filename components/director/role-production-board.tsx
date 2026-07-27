"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskList } from "@/components/wedding/risk-list";
import { useTranslation } from "@/lib/i18n";
import { joinDetails } from "@/lib/utils";
import type { RoleMomentCue, RoleProductionBoard as RoleProductionBoardData } from "@/lib/wedding-types";

type RoleProductionBoardProps = {
  board: RoleProductionBoardData;
  hasLocalProject: boolean;
  roleSelector?: React.ReactNode;
};

export function RoleProductionBoard({ board, hasLocalProject, roleSelector }: RoleProductionBoardProps) {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState(t("Ready to brief"));
  const [showManualCopy, setShowManualCopy] = useState(false);

  // Only the connector is chrome: the moment title stays in the couple's own
  // wording, exactly as the queue below prints it — translating it here and not
  // there is the half-translated data card we keep away from. A moment without a
  // time keeps its title alone rather than borrowing a time from elsewhere.
  function momentCueLabel(cue: RoleMomentCue | null, emptyLabel: string) {
    if (!cue) {
      return t(emptyLabel);
    }

    return cue.time ? t("{title} at {time}", { title: cue.title, time: cue.time }) : cue.title;
  }

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
          <span>{t("Starts with")}</span>
          <strong>{momentCueLabel(board.startsWith, "No moment in this plan yet")}</strong>
        </div>
        <div>
          <span>{t("Then")}</span>
          <strong>{momentCueLabel(board.nextUp, "No later moment in this plan")}</strong>
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
              {/* A derived board often holds a single moment, so the count reads
                  "1 moment" rather than "1 moments". */}
              <span className="director-count-line">{board.timeline.length} {t(board.timeline.length === 1 ? "moment" : "moments")}</span>
            </div>
            <ol className="director-production-queue">
              {board.timeline.map((item) => (
                <li data-secret={item.isSecret} data-warning={item.hasWarning} key={item.id}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    {/* A fresh plan carries the role but no named person, so name the
                        gap rather than trailing a dangling separator. */}
                    <p>{joinDetails([item.location, item.owner || t("No owner named yet")], " - ")}</p>
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
              <h3 className="card-title">{t("Roles to coordinate")}</h3>
              <div className="contact-list">
                {/* Roles, not people: the plan holds no contact details, so it must
                    not print a role name where a person's name belongs. The titles
                    stay untranslated, like the board heading, the role picker and
                    the handoff lines that also name them. */}
                {board.coordinateWith.length > 0 ? (
                  board.coordinateWith.map((role) => <span key={role}>{role}</span>)
                ) : (
                  <span>{t("No other role in this plan owns a moment yet.")}</span>
                )}
              </div>
              <p className="card-copy">{board.readyToBrief ? t("Brief can be sent after final review.") : t("Review warnings before sending the brief.")}</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <details className="director-role-detail-drawer">
        <summary>
          <span>{t("Brief Details")}</span>
          <small>{t("Open the day-of checklist and this role's warnings when preparing the final handoff.")}</small>
        </summary>

        <div className="director-role-detail-grid">
          <Card>
            <CardContent>
              <p className="eyebrow">{t("Checklist")}</p>
              <h3 className="card-title">{t("Day-of checks")}</h3>
              {board.checklistItems.length > 0 ? (
                <ul className="check-list">
                  {board.checklistItems.map((item) => (
                    <li key={item}>
                      <span aria-hidden="true" />
                      {t(item)}
                    </li>
                  ))}
                </ul>
              ) : (
                // A role the couple named themselves gets no invented checklist.
                <p className="card-copy">{t("This role was named in your own plan, so the studio has no standard checks for it. Their moments are the brief.")}</p>
              )}
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
