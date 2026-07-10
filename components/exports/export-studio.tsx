"use client";

import { useState } from "react";
import { BudgetSheet } from "@/components/exports/budget-sheet";
import { ExportPreview } from "@/components/exports/export-preview";
import { RunOfShow } from "@/components/exports/run-of-show";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioSceneSurface } from "@/components/ui/studio-scene-surface";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import { useTranslation } from "@/lib/i18n";
import { downloadTimelineIcs } from "@/lib/timeline-ics";
import { useLocalProject } from "@/lib/use-local-project";
import { exportTypes } from "@/lib/wedding-data";

export function ExportStudio() {
  const { t } = useTranslation();
  const { timelineItems, wedding } = useLocalProject();
  const [selectedExportId, setSelectedExportId] = useState(exportTypes[0].id);
  const selectedExport = exportTypes.find((exportType) => exportType.id === selectedExportId) ?? exportTypes[0];

  return (
    <StudioRouteFrame
      eyebrow="Brief Builder"
      primaryAction={{ label: "Print Preview", onClick: () => window.print() }}
      title="Turn the plan into one clear brief at a time."
    >
      <div className="export-studio">
        <details className="studio-detail-drawer export-brief-library">
          <summary>
            <span>{t("Brief library")}</span>
            <strong>{exportTypes.length} {t("export types")}</strong>
          </summary>
          <div className="export-brief-board" aria-label={t("Export brief selector")}>
            {exportTypes.map((exportType, index) => (
              <button
                aria-pressed={exportType.id === selectedExport.id}
                className="export-brief-card"
                data-active={exportType.id === selectedExport.id}
                key={exportType.id}
                onClick={() => setSelectedExportId(exportType.id)}
                type="button"
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{exportType.title}</strong>
                <small>{exportType.contactPerson}</small>
              </button>
            ))}
          </div>
        </details>

        <details className="studio-detail-drawer export-context-drawer">
          <summary>
            <span>{t("Export Workflow")}</span>
            <strong>{t("Open planning context")}</strong>
          </summary>
          <StudioWorkflow activeStep="exports" />
        </details>

        <StudioSceneSurface
          aside={
            <Card>
              <CardContent>
                <label className="field export-select-field">
                  <span>{t("Brief type")}</span>
                  <select aria-label={t("Choose export brief type")} onChange={(event) => setSelectedExportId(event.target.value)} value={selectedExportId}>
                    {exportTypes.map((exportType) => (
                      <option key={exportType.id} value={exportType.id}>
                        {exportType.title}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="eyebrow">{t("Reference")}</p>
                <h3 className="card-title">{t("Full Run of Show")}</h3>
                <p className="card-copy">{t("A compact source view for the selected brief.")}</p>
                <div className="button-row no-print">
                  <Button onClick={() => downloadTimelineIcs(wedding, timelineItems)} size="small" variant="secondary">
                    {t("Add to calendar (.ics)")}
                  </Button>
                </div>
                <RunOfShow />
              </CardContent>
            </Card>
          }
          description={`${selectedExport.contactPerson} receives only the details connected to this handoff.`}
          eyebrow="Print Preview"
          title={selectedExport.title}
        >
          <ExportPreview exportType={selectedExport} />
        </StudioSceneSurface>

        <Card className="export-budget-card">
          <CardContent>
            <BudgetSheet />
          </CardContent>
        </Card>
      </div>
    </StudioRouteFrame>
  );
}
