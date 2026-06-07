import { exportTypes, sampleWedding } from "@/lib/wedding-data";
import type {
  DinnerTable,
  ExportType,
  Guest,
  MusicCue,
  PreviewPhase,
  RiskItem,
  Speech,
  TimelineItem,
  Wedding
} from "@/lib/wedding-types";

export type WeddingGraphNodeType =
  | "wedding"
  | "timeline"
  | "music"
  | "speech"
  | "guest"
  | "table"
  | "risk"
  | "export"
  | "role"
  | "phase";

export type WeddingGraphNode = {
  id: string;
  type: WeddingGraphNodeType;
  label: string;
  detail: string;
};

export type WeddingGraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type WeddingGraph = {
  nodes: WeddingGraphNode[];
  edges: WeddingGraphEdge[];
  wedding: Wedding;
  timeline: TimelineItem[];
  musicCues: MusicCue[];
  speeches: Speech[];
  guests: Guest[];
  dinnerTables: DinnerTable[];
  risks: RiskItem[];
  exports: ExportType[];
};

export type MomentGraphContext = {
  phase: PreviewPhase;
  timelineItems: TimelineItem[];
  musicCues: MusicCue[];
  speeches: Speech[];
  guests: Guest[];
  tables: DinnerTable[];
  risks: RiskItem[];
  exports: ExportType[];
  roles: string[];
  dependencyPath: WeddingGraphEdge[];
  graphNodeCount: number;
  graphEdgeCount: number;
};

type WeddingGraphInput = {
  wedding?: Wedding;
  timeline: TimelineItem[];
  musicCues: MusicCue[];
  speeches: Speech[];
  guests: Guest[];
  dinnerTables: DinnerTable[];
  risks: RiskItem[];
  exports?: ExportType[];
};

export function buildWeddingGraph({
  wedding = sampleWedding,
  timeline,
  musicCues,
  speeches,
  guests,
  dinnerTables,
  risks,
  exports = exportTypes
}: WeddingGraphInput): WeddingGraph {
  const nodes = new Map<string, WeddingGraphNode>();
  const edges = new Map<string, WeddingGraphEdge>();
  const addNode = (node: WeddingGraphNode) => nodes.set(node.id, node);
  const addEdge = (from: string, to: string, label: string) => {
    const id = `${from}-${label}-${to}`;
    edges.set(id, { id, from, to, label });
  };

  addNode({
    id: wedding.id,
    type: "wedding",
    label: wedding.coupleNames,
    detail: `${wedding.date} at ${wedding.ceremonyLocation} and ${wedding.receptionLocation}`
  });

  timeline.forEach((item) => {
    addNode({
      id: item.id,
      type: "timeline",
      label: item.title,
      detail: `${item.time} - ${item.location}`
    });
    addEdge(wedding.id, item.id, "contains");
    addRoleNodeAndEdge(addNode, addEdge, item.responsibleRole, item.id, "owns");
  });

  musicCues.forEach((cue) => {
    addNode({
      id: cue.id,
      type: "music",
      label: cue.songTitle,
      detail: `${cue.moment} - ${cue.responsiblePerson}`
    });
    addEdge(cue.timelineItemId, cue.id, "uses cue");
    addRoleNodeAndEdge(addNode, addEdge, "DJ / Musician", cue.id, "needs");
  });

  speeches.forEach((speech) => {
    addNode({
      id: speech.id,
      type: "speech",
      label: speech.title,
      detail: `${speech.speakerName} - ${speech.durationMinutes} minutes`
    });
    addEdge(speech.timelineItemId, speech.id, speech.isSecret ? "contains secret layer" : "contains program item");
    addRoleNodeAndEdge(addNode, addEdge, "Toastmaster / MC", speech.id, "introduces");
  });

  guests.forEach((guest) => {
    addNode({
      id: guest.id,
      type: "guest",
      label: guest.name,
      detail: `${guest.relationship} - ${guest.mealChoice}`
    });
    addEdge(guest.tableId, guest.id, "seats");
  });

  dinnerTables.forEach((table) => {
    addNode({
      id: table.id,
      type: "table",
      label: table.name,
      detail: `${table.capacity} seats`
    });
    addEdge(wedding.id, table.id, "maps seating");
  });

  risks.forEach((risk) => {
    addNode({
      id: risk.id,
      type: "risk",
      label: risk.title,
      detail: risk.description
    });
    addEdge(risk.relatedEntityId, risk.id, `${risk.severity} risk`);
    getRolesForRisk(risk).forEach((role) => addRoleNodeAndEdge(addNode, addEdge, role, risk.id, "must review"));
  });

  exports.forEach((exportType) => {
    addNode({
      id: exportType.id,
      type: "export",
      label: exportType.title,
      detail: exportType.contactPerson
    });

    exportType.timelineItemIds.forEach((timelineItemId) => addEdge(timelineItemId, exportType.id, "feeds brief"));
    exportType.warningIds.forEach((warningId) => addEdge(warningId, exportType.id, "appears in brief"));
  });

  return {
    dinnerTables,
    edges: Array.from(edges.values()),
    exports,
    guests,
    musicCues,
    nodes: Array.from(nodes.values()),
    risks,
    speeches,
    timeline,
    wedding
  };
}

export function getMomentGraphContext(graph: WeddingGraph, phase: PreviewPhase): MomentGraphContext {
  const timelineItems = phase.relatedTimelineItemIds
    .map((itemId) => graph.timeline.find((item) => item.id === itemId))
    .filter((item): item is TimelineItem => Boolean(item));
  const timelineIds = new Set(timelineItems.map((item) => item.id));
  const musicCueIds = new Set([
    ...timelineItems.map((item) => item.musicCueId).filter((id): id is string => Boolean(id)),
    ...(phase.musicCueId ? [phase.musicCueId] : [])
  ]);
  const speechIds = new Set(timelineItems.map((item) => item.speechId).filter((id): id is string => Boolean(id)));
  const musicCues = graph.musicCues.filter((cue) => musicCueIds.has(cue.id) || timelineIds.has(cue.timelineItemId));
  const speeches = graph.speeches.filter((speech) => speechIds.has(speech.id) || timelineIds.has(speech.timelineItemId));
  const risks = graph.risks.filter((risk) => isRiskRelevantToMoment(risk, phase, timelineIds, musicCueIds, speechIds));
  const riskIds = new Set(risks.map((risk) => risk.id));
  const guestIds = new Set(
    risks
      .filter((risk) => risk.relatedEntityType === "guest")
      .map((risk) => risk.relatedEntityId)
  );
  const tableIds = new Set(
    risks
      .filter((risk) => risk.relatedEntityType === "dinnerTable")
      .map((risk) => risk.relatedEntityId)
  );

  if (isGuestJourneyMoment(phase)) {
    graph.guests
      .filter(hasProductionGuestNote)
      .forEach((guest) => {
        guestIds.add(guest.id);
        tableIds.add(guest.tableId);
      });
  }

  const guests = graph.guests.filter((guest) => guestIds.has(guest.id));
  const tables = graph.dinnerTables.filter((table) => tableIds.has(table.id) || guests.some((guest) => guest.tableId === table.id));
  const exports = graph.exports.filter(
    (exportType) =>
      exportType.timelineItemIds.some((timelineItemId) => timelineIds.has(timelineItemId)) ||
      exportType.warningIds.some((warningId) => riskIds.has(warningId))
  );
  const roles = Array.from(
    new Set([
      phase.responsibleRole,
      ...timelineItems.map((item) => item.responsibleRole),
      ...risks.flatMap(getRolesForRisk),
      ...exports.map((exportType) => getRoleFromContact(exportType.contactPerson))
    ])
  ).filter(Boolean);
  const connectedIds = new Set<string>([
    phase.id,
    ...timelineItems.map((item) => item.id),
    ...musicCues.map((cue) => cue.id),
    ...speeches.map((speech) => speech.id),
    ...risks.map((risk) => risk.id),
    ...exports.map((exportType) => exportType.id),
    ...guests.map((guest) => guest.id),
    ...tables.map((table) => table.id)
  ]);
  const dependencyPath = graph.edges
    .filter((edge) => connectedIds.has(edge.from) && connectedIds.has(edge.to))
    .slice(0, 8);

  return {
    dependencyPath,
    exports,
    graphEdgeCount: graph.edges.length,
    graphNodeCount: graph.nodes.length,
    guests,
    musicCues,
    phase,
    risks,
    roles,
    speeches,
    tables,
    timelineItems
  };
}

function addRoleNodeAndEdge(
  addNode: (node: WeddingGraphNode) => void,
  addEdge: (from: string, to: string, label: string) => void,
  role: string,
  targetId: string,
  label: string
) {
  const roleId = `role-${normalizeRole(role)}`;
  addNode({
    id: roleId,
    type: "role",
    label: getRoleTitle(role),
    detail: "Role-specific production context"
  });
  addEdge(roleId, targetId, label);
}

function getRolesForRisk(risk: RiskItem) {
  if (risk.relatedEntityType === "musicCue") {
    return ["DJ / Musician", "Wedding Planner"];
  }

  if (risk.relatedEntityType === "speech") {
    return ["Toastmaster / MC", "Wedding Planner"];
  }

  if (risk.relatedEntityType === "guest") {
    return ["Catering", "Venue", "Wedding Planner"];
  }

  if (risk.relatedEntityType === "dinnerTable") {
    return ["Wedding Planner", "Venue"];
  }

  if (risk.relatedEntityType === "ceremonyLayout") {
    return ["Venue", "Photographer", "Wedding Planner"];
  }

  if (risk.relatedEntityType === "venueLayout") {
    return ["Venue", "Catering", "Wedding Planner"];
  }

  if (risk.relatedEntityType === "timeline" && risk.relatedEntityId.includes("photo")) {
    return ["Photographer", "Wedding Planner"];
  }

  return ["Wedding Planner"];
}

function getRoleFromContact(contactPerson: string) {
  if (contactPerson === "Daniel Brooks") {
    return "Toastmaster / MC";
  }

  if (contactPerson === "Clara Hayes") {
    return "Photographer";
  }

  if (contactPerson === "Miles Reed") {
    return "DJ / Musician";
  }

  if (contactPerson === "Sophia Grant") {
    return "Catering";
  }

  if (contactPerson === "Henry Cole") {
    return "Venue";
  }

  if (contactPerson === "Reverend Thomas Allen") {
    return "Officiant";
  }

  return "Wedding Planner";
}

function isRiskRelevantToMoment(
  risk: RiskItem,
  phase: PreviewPhase,
  timelineIds: Set<string>,
  musicCueIds: Set<string>,
  speechIds: Set<string>
) {
  if (risk.id === phase.riskId) {
    return true;
  }

  if (risk.relatedEntityType === "timeline") {
    return timelineIds.has(risk.relatedEntityId);
  }

  if (risk.relatedEntityType === "musicCue") {
    return musicCueIds.has(risk.relatedEntityId);
  }

  if (risk.relatedEntityType === "speech") {
    return speechIds.has(risk.relatedEntityId) || (risk.relatedEntityId === "all-speeches" && phase.title.toLowerCase().includes("speech"));
  }

  if (risk.relatedEntityType === "guest") {
    return isGuestJourneyMoment(phase);
  }

  if (risk.relatedEntityType === "dinnerTable") {
    return isGuestJourneyMoment(phase);
  }

  if (risk.relatedEntityType === "ceremonyLayout") {
    return phase.location.toLowerCase().includes("chapel") || phase.location.toLowerCase().includes("altar");
  }

  if (risk.relatedEntityType === "venueLayout") {
    return phase.location.toLowerCase().includes("hall") || phase.location.toLowerCase().includes("ballroom");
  }

  return false;
}

function isGuestJourneyMoment(phase: PreviewPhase) {
  const text = `${phase.title} ${phase.location}`.toLowerCase();
  return text.includes("arrival") || text.includes("reception") || text.includes("dinner") || text.includes("ballroom");
}

function hasProductionGuestNote(guest: Guest) {
  return (
    guest.allergies.length > 0 ||
    guest.accessibilityNotes.length > 0 ||
    guest.mealChoice.toLowerCase().includes("vegan") ||
    guest.tags.some((tag) => tag.toLowerCase().includes("child") || tag.toLowerCase().includes("conflict"))
  );
}

function normalizeRole(role: string) {
  return role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getRoleTitle(role: string) {
  if (role.toLowerCase() === "music") {
    return "DJ / Musician";
  }

  if (role.toLowerCase().includes("planner")) {
    return "Wedding Planner";
  }

  if (role.toLowerCase().includes("dj")) {
    return "DJ / Musician";
  }

  return role;
}
