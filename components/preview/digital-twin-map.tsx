"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildDigitalTwinMap } from "@/lib/digital-twin-map";
import { analyzeWeddingFlow } from "@/lib/risk-analysis";
import { useLocalProject } from "@/lib/use-local-project";
import { filterResolvedRisks, useRiskResolutions } from "@/lib/use-risk-resolutions";
import { previewPhases } from "@/lib/wedding-data";

export function DigitalTwinMap() {
  const [selectedNodeId, setSelectedNodeId] = useState(previewPhases[0]?.id ?? "");
  const { dinnerTables, guests, musicCues, speeches, timelineItems } = useLocalProject();
  const { resolvedRiskIds } = useRiskResolutions();
  const risks = useMemo(
    () =>
      filterResolvedRisks(
        analyzeWeddingFlow({
          cues: musicCues,
          guestItems: guests,
          speechItems: speeches,
          tables: dinnerTables,
          timeline: timelineItems
        }),
        resolvedRiskIds
      ),
    [dinnerTables, guests, musicCues, resolvedRiskIds, speeches, timelineItems]
  );
  const digitalTwinMap = useMemo(
    () =>
      buildDigitalTwinMap({
        dinnerTables,
        guests,
        musicCues,
        phases: previewPhases,
        risks,
        speeches,
        timelineItems
      }),
    [dinnerTables, guests, musicCues, risks, speeches, timelineItems]
  );
  const selectedNode = digitalTwinMap.nodes.find((node) => node.id === selectedNodeId) ?? digitalTwinMap.nodes[0];

  if (!selectedNode) {
    return null;
  }

  return (
    <section className="digital-twin-map" aria-label="Wedding Day Digital Twin Map">
      <div className="digital-twin-map-header">
        <div>
          <p className="eyebrow">Wedding Day Digital Twin Map</p>
          <h2>{digitalTwinMap.headline}</h2>
          <p>{digitalTwinMap.summary}</p>
        </div>
        <div className="digital-twin-score">
          <span>Map readiness</span>
          <strong>{digitalTwinMap.stats.averageReadiness}%</strong>
          <small>
            {digitalTwinMap.stats.readyCount} ready, {digitalTwinMap.stats.reviewCount} review, {digitalTwinMap.stats.blockedCount} blocked
          </small>
        </div>
      </div>

      <div className="digital-twin-map-layout">
        <div className="digital-twin-canvas">
          <div className="digital-twin-route-line" aria-hidden="true" />
          {digitalTwinMap.connections.map((connection, index) => (
            <span
              aria-hidden="true"
              className="digital-twin-connection"
              data-tone={connection.tone}
              key={connection.id}
              style={{
                left: `${8 + index * 7.4}%`,
                top: `${index % 2 === 0 ? 50 : 45}%`,
                width: "8%"
              }}
            />
          ))}
          {digitalTwinMap.nodes.map((node) => (
            <button
              aria-label={`Inspect ${node.title}`}
              aria-pressed={node.id === selectedNode.id}
              className="digital-twin-node"
              data-active={node.id === selectedNode.id}
              data-readiness={node.readiness}
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              type="button"
            >
              <span>{String(node.index + 1).padStart(2, "0")}</span>
              <strong>{node.title}</strong>
            </button>
          ))}
        </div>

        <aside className="digital-twin-detail">
          <div className="digital-twin-detail-top">
            <Badge tone={selectedNode.riskTone}>
              {selectedNode.riskTone === "confirmed" ? "clear" : `${selectedNode.riskTone} watch`}
            </Badge>
            <Badge tone={selectedNode.readiness === "ready" ? "confirmed" : selectedNode.readiness === "review" ? "medium" : "high"}>
              {selectedNode.readinessScore}% ready
            </Badge>
          </div>
          <div>
            <span>{selectedNode.timeRange}</span>
            <h3>{selectedNode.title}</h3>
            <p>{selectedNode.sceneLabel} at {selectedNode.location}</p>
          </div>

          <div className="digital-twin-detail-grid">
            <div>
              <span>Owner</span>
              <strong>{selectedNode.owner}</strong>
              <small>{selectedNode.role}</small>
            </div>
            <div>
              <span>Music</span>
              <strong>{selectedNode.cueLabel}</strong>
              <small>cue layer</small>
            </div>
            <div>
              <span>Guest signal</span>
              <strong>{selectedNode.guestSignal}</strong>
              <small>guest journey layer</small>
            </div>
            <div>
              <span>Next handoff</span>
              <strong>{selectedNode.nextHandoff}</strong>
              <small>director layer</small>
            </div>
          </div>

          <div className="digital-twin-stats-row">
            <div>
              <span>Roles</span>
              <strong>{digitalTwinMap.stats.roleCount}</strong>
            </div>
            <div>
              <span>Cues</span>
              <strong>{digitalTwinMap.stats.cueCount}</strong>
            </div>
            <div>
              <span>Risks</span>
              <strong>{digitalTwinMap.stats.openRiskCount}</strong>
            </div>
          </div>

          <Button href="/director" size="small" variant="secondary">
            Open Director Mode
          </Button>
        </aside>
      </div>
    </section>
  );
}
