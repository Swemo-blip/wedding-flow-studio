"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RoleProductionBoard } from "@/components/director/role-production-board";
import { RoleSelector } from "@/components/director/role-selector";
import { Button } from "@/components/ui/button";
import { StudioCommand } from "@/components/ui/studio-command";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import { useTranslation } from "@/lib/i18n";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { getUnassignedMoments } from "@/lib/role-briefs";
import { buildRoleProductionBoards } from "@/lib/role-production";
import { useLocalProject } from "@/lib/use-local-project";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";

export function DirectorBoard() {
  const { t } = useTranslation();
  const { dinnerTables, guests, hasLocalProject, musicCues, speeches, timelineItems, wedding } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const risks = useMemo(
    () =>
      filterResolvedRisks(
        analyzeWeddingFlow({ timeline: timelineItems, cues: musicCues, speechItems: speeches, guestItems: guests, tables: dinnerTables, wedding }),
        resolvedRiskIds
      ),
    [dinnerTables, guests, musicCues, resolvedRiskIds, speeches, timelineItems, wedding]
  );
  // Which roles exist, and what each of them owns, comes from the couple's live
  // timeline — so a plan without a toastmaster has no toastmaster board, and a
  // moment they add lands on the board of whoever they made responsible.
  const boards = useMemo(
    () => buildRoleProductionBoards({ timeline: timelineItems, risks, cues: musicCues, speechItems: speeches }),
    [musicCues, risks, speeches, timelineItems]
  );
  const unassignedMoments = useMemo(() => getUnassignedMoments(timelineItems), [timelineItems]);
  const [selectedRole, setSelectedRole] = useState("");
  // The role set is derived, so the selected role can vanish when the couple
  // reassigns or deletes a moment. Fall back to the first board instead of
  // rendering an empty surface.
  const activeBoard = boards.find((board) => board.role === selectedRole) ?? boards[0] ?? null;

  useEffect(() => {
    const readRoleFromUrl = window.setTimeout(() => {
      setSelectedRole(new URLSearchParams(window.location.search).get("role") ?? "");
    }, 0);

    return () => window.clearTimeout(readRoleFromUrl);
  }, []);

  return (
    <StudioRouteFrame
      eyebrow="Who does what"
      primaryAction={{ href: "/exports", label: "Share these briefs" }}
      title="Everyone's part in the day."
    >
    <div className="director-mode-page studio-route-content">
      {activeBoard ? (
        <RoleProductionBoard
          board={activeBoard}
          hasLocalProject={hasLocalProject}
          roleSelector={<RoleSelector activeRole={activeBoard.role} onChange={setSelectedRole} roles={boards} />}
        />
      ) : (
        <div className="director-empty-state">
          <strong>{t("No role owns a moment yet.")}</strong>
          <p>{t("Give the moments in your day flow a responsible role, and every role gets its own board here.")}</p>
          <Button href="/day-flow" size="small">
            {t("Open Day Flow")}
          </Button>
        </div>
      )}

      {unassignedMoments.length > 0 ? (
        <p className="director-unassigned-note">
          {unassignedMoments.length === 1
            ? t("One moment has no responsible role yet, so no board carries it.")
            : t("{count} moments have no responsible role yet, so no board carries them.", { count: unassignedMoments.length })}{" "}
          <Link href="/day-flow">{t("Assign roles in Day Flow")}</Link>
        </p>
      ) : null}

      <details className="director-detail-drawer">
        <summary>
          <span>{t("Studio Context")}</span>
          <small>{t("Workflow and module metrics beyond the active role.")}</small>
        </summary>
        <div className="director-detail-drawer-content">
          <StudioCommand
            actions={[
              { href: "/exports", label: "Prepare Brief" },
              { href: "/preview", label: "Preview Day", variant: "secondary" }
            ]}
            eyebrow="Director Mode"
            title="Give every role exactly what they need."
          />
          <StudioWorkflow activeStep="director" />
        </div>
      </details>
    </div>
    </StudioRouteFrame>
  );
}
