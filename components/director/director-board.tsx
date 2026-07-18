"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleProductionBoard } from "@/components/director/role-production-board";
import { RoleSelector } from "@/components/director/role-selector";
import { StudioCommand } from "@/components/ui/studio-command";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import { useTranslation } from "@/lib/i18n";
import { buildRoleBriefs } from "@/lib/role-briefs";

export function DirectorBoard() {
  const { t } = useTranslation();
  const briefs = useMemo(() => buildRoleBriefs(), []);
  const [activeRole, setActiveRole] = useState(briefs[0].role);
  const activeBrief = briefs.find((brief) => brief.role === activeRole) ?? briefs[0];

  useEffect(() => {
    const readRoleFromUrl = window.setTimeout(() => {
      const incomingRole = new URLSearchParams(window.location.search).get("role");

      if (incomingRole && briefs.some((brief) => brief.role === incomingRole)) {
        setActiveRole(incomingRole);
      }
    }, 0);

    return () => window.clearTimeout(readRoleFromUrl);
  }, [briefs]);

  return (
    <StudioRouteFrame
      eyebrow="Who does what"
      primaryAction={{ href: "/exports", label: "Share these briefs" }}
      title="Everyone's part in the day."
    >
    <div className="director-mode-page studio-route-content">
      <RoleProductionBoard
        brief={activeBrief}
        roleSelector={<RoleSelector activeRole={activeRole} briefs={briefs} onChange={setActiveRole} />}
      />

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
            description="One focused board per role: relevant timing, warnings, handoffs, checklist, contacts, and copy-ready instructions."
            eyebrow="Director Mode"
            metrics={[
              { label: "Active role", value: activeBrief.title },
              { label: "Timeline moments", value: `${activeBrief.relevantTimelineItemIds.length}` },
              { label: "Checklist", tone: "confirmed", value: `${activeBrief.checklistItems.length} items` },
              { label: "Coordinate with", value: activeBrief.contactPerson }
            ]}
            status={{ label: "Role board live", tone: "confirmed" }}
            title="Give every role exactly what they need."
          />
          <StudioWorkflow activeStep="director" />
        </div>
      </details>
    </div>
    </StudioRouteFrame>
  );
}
