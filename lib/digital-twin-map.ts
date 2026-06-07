import { buildMomentIntelligence, type MomentReadiness } from "@/lib/moment-intelligence";
import { buildPreviewCockpitContext } from "@/lib/preview-cockpit";
import { getTimelineItemsByIds } from "@/lib/use-local-timeline";
import type { DinnerTable, Guest, MusicCue, PreviewPhase, RiskItem, Speech, TimelineItem } from "@/lib/wedding-types";

export type DigitalTwinMapNode = {
  id: string;
  index: number;
  title: string;
  timeRange: string;
  location: string;
  sceneLabel: string;
  owner: string;
  role: string;
  cueLabel: string;
  nextHandoff: string;
  readiness: MomentReadiness;
  readinessScore: number;
  riskCount: number;
  riskTone: "confirmed" | "medium" | "high";
  guestSignal: string;
  x: number;
  y: number;
};

export type DigitalTwinMapConnection = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  tone: "confirmed" | "medium" | "high";
};

export type DigitalTwinMap = {
  nodes: DigitalTwinMapNode[];
  connections: DigitalTwinMapConnection[];
  stats: {
    readyCount: number;
    reviewCount: number;
    blockedCount: number;
    openRiskCount: number;
    averageReadiness: number;
    roleCount: number;
    cueCount: number;
  };
  headline: string;
  summary: string;
};

type DigitalTwinMapInput = {
  dinnerTables: DinnerTable[];
  guests: Guest[];
  musicCues: MusicCue[];
  phases: PreviewPhase[];
  risks: RiskItem[];
  speeches: Speech[];
  timelineItems: TimelineItem[];
};

const nodePositions = [
  { x: 8, y: 47 },
  { x: 16, y: 34 },
  { x: 24, y: 52 },
  { x: 32, y: 38 },
  { x: 40, y: 56 },
  { x: 48, y: 34 },
  { x: 56, y: 50 },
  { x: 64, y: 36 },
  { x: 72, y: 54 },
  { x: 80, y: 40 },
  { x: 87, y: 58 },
  { x: 93, y: 42 },
  { x: 97, y: 52 }
];

export function buildDigitalTwinMap({
  dinnerTables,
  guests,
  musicCues,
  phases,
  risks,
  speeches,
  timelineItems
}: DigitalTwinMapInput): DigitalTwinMap {
  const nodes = phases.map((phase, index) => {
    const nextPhase = phases[index + 1];
    const relatedTimeline = getTimelineItemsByIds(timelineItems, phase.relatedTimelineItemIds);
    const intelligence = buildMomentIntelligence({
      cues: musicCues,
      dinnerTables,
      guests,
      nextPhase,
      phase,
      phaseIndex: index,
      relatedTimeline,
      risks,
      speeches,
      totalPhases: phases.length
    });
    const cockpit = buildPreviewCockpitContext({
      cues: musicCues,
      nextPhase,
      phase,
      phaseIndex: index,
      relatedTimeline,
      risks,
      speechItems: speeches,
      totalPhases: phases.length
    });
    const position = nodePositions[index] ?? { x: Math.min(96, 8 + index * 7), y: index % 2 === 0 ? 44 : 56 };

    return {
      cueLabel: cockpit.musicCue ? cockpit.musicCue.songTitle : "No cue linked",
      guestSignal: intelligence.guestImpact.label,
      id: phase.id,
      index,
      location: phase.location,
      nextHandoff: cockpit.handoffLine,
      owner: phase.responsiblePerson,
      readiness: intelligence.readiness,
      readinessScore: intelligence.readinessScore,
      riskCount: cockpit.primaryRisk ? 1 : 0,
      riskTone: getRiskTone(cockpit.primaryRisk),
      role: phase.responsibleRole,
      sceneLabel: cockpit.sceneLabel,
      timeRange: phase.timeRange,
      title: phase.title,
      x: position.x,
      y: position.y
    };
  });
  const connections = nodes.slice(0, -1).map((node, index) => {
    const nextNode = nodes[index + 1];
    const tone = getConnectionTone(node, nextNode);

    return {
      fromId: node.id,
      id: `${node.id}-${nextNode.id}`,
      label: `${node.role} to ${nextNode.role}`,
      toId: nextNode.id,
      tone
    };
  });
  const readyCount = nodes.filter((node) => node.readiness === "ready").length;
  const reviewCount = nodes.filter((node) => node.readiness === "review").length;
  const blockedCount = nodes.filter((node) => node.readiness === "blocked").length;
  const averageReadiness = Math.round(nodes.reduce((total, node) => total + node.readinessScore, 0) / Math.max(1, nodes.length));
  const roleCount = new Set(nodes.map((node) => node.role)).size;
  const cueCount = musicCues.filter((cue) => phases.some((phase) => phase.musicCueId === cue.id || phase.relatedTimelineItemIds.includes(cue.timelineItemId))).length;

  return {
    connections,
    headline: blockedCount > 0 ? "The day is visible, but a few handoffs still need direction." : "The wedding day is connected enough to rehearse.",
    nodes,
    stats: {
      averageReadiness,
      blockedCount,
      cueCount,
      openRiskCount: risks.length,
      readyCount,
      reviewCount,
      roleCount
    },
    summary: `This map connects ${nodes.length} moments, ${roleCount} role lanes, ${cueCount} music cues, and ${risks.length} active production watches into one day-of digital twin.`
  };
}

function getRiskTone(risk: RiskItem | null | undefined): "confirmed" | "medium" | "high" {
  if (!risk) {
    return "confirmed";
  }

  return risk.severity === "high" ? "high" : "medium";
}

function getConnectionTone(left: DigitalTwinMapNode, right: DigitalTwinMapNode): "confirmed" | "medium" | "high" {
  if (left.readiness === "blocked" || right.readiness === "blocked" || left.riskTone === "high" || right.riskTone === "high") {
    return "high";
  }

  if (left.readiness === "review" || right.readiness === "review" || left.riskTone === "medium" || right.riskTone === "medium") {
    return "medium";
  }

  return "confirmed";
}
