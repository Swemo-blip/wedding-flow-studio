"use client";

import { useState } from "react";
import { ExportPreview } from "@/components/exports/export-preview";
import { RunOfShow } from "@/components/exports/run-of-show";
import { Card, CardContent } from "@/components/ui/card";
import { StudioRouteFrame } from "@/components/ui/studio-route-frame";
import { StudioSceneSurface } from "@/components/ui/studio-scene-surface";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import { exportTypes } from "@/lib/wedding-data";

export function ExportStudio() {
  const [selectedExportId, setSelectedExportId] = useState(exportTypes[0].id);
  const selectedExport = exportTypes.find((exportType) => exportType.id === selectedExportId) ?? exportTypes[0];

  return (
    <StudioRouteFrame
      description="Choose one focused handoff, review the source run of show, and prepare a clear role-ready production sheet."
      eyebrow="Brief Builder"
      meta={[
        { label: "Selected", value: selectedExport.title },
        { label: "Types", value: `${exportTypes.length}` },
        { label: "Format", value: "Print-ready" }
      ]}
      primaryAction={{ label: "Print Preview", onClick: () => window.print() }}
      secondaryAction={{ href: "/director", label: "Director Mode" }}
      title="Turn the plan into one clear brief at a time."
    >
      <div className="export-studio">
        <details className="studio-detail-drawer export-brief-library">
          <summary>
            <span>Brief library</span>
            <strong>{exportTypes.length} export types</strong>
          </summary>
          <div className="export-brief-board" aria-label="Export brief selector">
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
            <span>Export Workflow</span>
            <strong>Open planning context</strong>
          </summary>
          <StudioWorkflow activeStep="exports" />
        </details>

        <StudioSceneSurface
          aside={
            <Card>
              <CardContent>
                <label className="field export-select-field">
                  <span>Brief type</span>
                  <select aria-label="Choose export brief type" onChange={(event) => setSelectedExportId(event.target.value)} value={selectedExportId}>
                    {exportTypes.map((exportType) => (
                      <option key={exportType.id} value={exportType.id}>
                        {exportType.title}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="eyebrow">Reference</p>
                <h3 className="card-title">Full Run of Show</h3>
                <p className="card-copy">A compact source view for the selected brief.</p>
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
      </div>
    </StudioRouteFrame>
  );
}
