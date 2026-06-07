"use client";

import { useState } from "react";
import { ExportPreview } from "@/components/exports/export-preview";
import { RunOfShow } from "@/components/exports/run-of-show";
import { Card, CardContent } from "@/components/ui/card";
import { StudioCommand } from "@/components/ui/studio-command";
import { StudioWorkflow } from "@/components/wedding/studio-workflow";
import { exportTypes } from "@/lib/wedding-data";

export function ExportStudio() {
  const [selectedExportId, setSelectedExportId] = useState(exportTypes[0].id);
  const selectedExport = exportTypes.find((exportType) => exportType.id === selectedExportId) ?? exportTypes[0];

  return (
    <div className="export-studio">
      <StudioCommand
        actions={[
          { label: "Print Preview", onClick: () => window.print() },
          { href: "/director", label: "Open Director Mode", variant: "secondary" }
        ]}
        description="Choose one focused handoff, review the source run of show, and prepare a clear role-ready production sheet."
        eyebrow="Brief Builder"
        metrics={[
          { label: "Selected brief", tone: "confirmed", value: selectedExport.title },
          { label: "Brief types", value: `${exportTypes.length}` },
          { label: "Format", value: "Print-ready preview" },
          { label: "Source", value: "Digital twin" }
        ]}
        status={{ label: "Export preview ready", tone: "confirmed" }}
        title="Turn the plan into one clear brief at a time."
      >
        <label className="field export-select-field">
          <span>Brief type</span>
          <select onChange={(event) => setSelectedExportId(event.target.value)} value={selectedExportId}>
            {exportTypes.map((exportType) => (
              <option key={exportType.id} value={exportType.id}>
                {exportType.title}
              </option>
            ))}
          </select>
        </label>
      </StudioCommand>

      <StudioWorkflow activeStep="exports" />

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

      <div className="two-column export-studio-grid">
        <div>
          <ExportPreview exportType={selectedExport} />
        </div>
        <aside>
          <Card>
            <CardContent>
              <p className="eyebrow">Reference</p>
              <h3 className="card-title">Full Run of Show</h3>
              <p className="card-copy">A compact source view for the selected brief.</p>
              <RunOfShow />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
