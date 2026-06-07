import { buildProductionActionForMoment, type ProductionAction } from "@/lib/action-engine";
import { exportTypes } from "@/lib/wedding-data";
import type {
  DinnerTable,
  ExportType,
  Guest,
  MusicCue,
  PreviewPhase,
  RiskItem,
  Speech,
  TimelineItem
} from "@/lib/wedding-types";

export type MomentReadiness = "ready" | "review" | "blocked";

export type MomentIntelligence = {
  id: string;
  title: string;
  readiness: MomentReadiness;
  readinessLabel: string;
  readinessScore: number;
  readinessTone: "confirmed" | "medium" | "high";
  primaryAction: ProductionAction;
  missingSignals: string[];
  affectedRoles: MomentImpactItem[];
  affectedExports: MomentImpactItem[];
  guestImpact: MomentGuestImpact;
  vendorHandoff: MomentVendorHandoff;
  rehearsalNotes: string[];
  failureModes: string[];
  decisionQueue: string[];
  summary: string;
};

export type MomentImpactItem = {
  id: string;
  label: string;
  detail: string;
};

export type MomentGuestImpact = {
  level: "light" | "moderate" | "sensitive";
  label: string;
  details: string[];
};

export type MomentVendorHandoff = {
  from: string;
  to: string;
  timing: string;
  instruction: string;
};

type MomentIntelligenceInput = {
  cues: MusicCue[];
  dinnerTables: DinnerTable[];
  guests: Guest[];
  nextPhase?: PreviewPhase;
  phase: PreviewPhase;
  phaseIndex: number;
  relatedTimeline: TimelineItem[];
  risks: RiskItem[];
  speeches: Speech[];
  totalPhases: number;
  exports?: ExportType[];
};

export function buildMomentIntelligence({
  cues,
  dinnerTables,
  guests,
  nextPhase,
  phase,
  phaseIndex,
  relatedTimeline,
  risks,
  speeches,
  totalPhases,
  exports = exportTypes
}: MomentIntelligenceInput): MomentIntelligence {
  const phaseRisks = getMomentRisks(phase, relatedTimeline, risks);
  const linkedCue = getLinkedMusicCue(phase, relatedTimeline, cues);
  const linkedSpeeches = getLinkedSpeeches(relatedTimeline, speeches);
  const guestImpact = buildGuestImpact(phase, guests, dinnerTables, phaseRisks);
  const missingSignals = buildMissingSignals(phase, relatedTimeline, linkedCue, linkedSpeeches, guestImpact, phaseRisks);
  const affectedRoles = buildAffectedRoles(phase, linkedCue, linkedSpeeches, guestImpact, phaseRisks);
  const affectedExports = buildAffectedExports(relatedTimeline, phaseRisks, exports);
  const readinessScore = getReadinessScore(phaseRisks, missingSignals, linkedCue);
  const readiness = getReadiness(readinessScore, phaseRisks);
  const primaryRole = affectedRoles[0];
  const primaryAction = buildProductionActionForMoment({
    affectedRoleId: primaryRole?.id,
    affectedRoleLabel: primaryRole?.label,
    linkedCue,
    linkedSpeeches,
    phase,
    phaseIndex,
    phaseRisks,
    totalPhases
  });
  const vendorHandoff = buildVendorHandoff(phase, nextPhase, linkedCue, linkedSpeeches, guestImpact);
  const rehearsalNotes = buildRehearsalNotes(phase, linkedCue, linkedSpeeches, guestImpact, vendorHandoff, phaseRisks);
  const failureModes = buildFailureModes(phase, linkedCue, linkedSpeeches, guestImpact, phaseRisks);
  const decisionQueue = buildDecisionQueue(primaryAction, missingSignals, phaseRisks, affectedExports);

  return {
    id: phase.id,
    title: phase.title,
    readiness,
    readinessLabel: getReadinessLabel(readiness, readinessScore),
    readinessScore,
    readinessTone: readiness === "blocked" ? "high" : readiness === "review" ? "medium" : "confirmed",
    primaryAction,
    missingSignals,
    affectedRoles,
    affectedExports,
    guestImpact,
    vendorHandoff,
    rehearsalNotes,
    failureModes,
    decisionQueue,
    summary: buildMomentSummary(phase, readiness, phaseRisks, guestImpact)
  };
}

function getMomentRisks(phase: PreviewPhase, relatedTimeline: TimelineItem[], risks: RiskItem[]) {
  const relatedTimelineIds = relatedTimeline.map((item) => item.id);
  const linkedMusicCueIds = relatedTimeline.map((item) => item.musicCueId).filter((id): id is string => Boolean(id));
  const linkedSpeechIds = relatedTimeline.map((item) => item.speechId).filter((id): id is string => Boolean(id));
  const text = `${phase.id} ${phase.title} ${phase.location}`.toLowerCase();

  return risks.filter((risk) => {
    if (risk.id === phase.riskId) {
      return true;
    }

    if (risk.relatedEntityType === "timeline") {
      return relatedTimelineIds.includes(risk.relatedEntityId);
    }

    if (risk.relatedEntityType === "musicCue") {
      return risk.relatedEntityId === phase.musicCueId || linkedMusicCueIds.includes(risk.relatedEntityId);
    }

    if (risk.relatedEntityType === "speech") {
      return linkedSpeechIds.includes(risk.relatedEntityId) || (risk.relatedEntityId === "all-speeches" && linkedSpeechIds.length > 0);
    }

    if (risk.relatedEntityType === "guest") {
      if (risk.id === "risk-accessibility") {
        return text.includes("guest-arrival") || text.includes("reception");
      }

      if (risk.id === "risk-catering-allergy" || risk.id === "risk-vegan-meal" || risk.id === "risk-child-meal") {
        return text.includes("dinner") || text.includes("reception");
      }

      return text.includes("dinner") || text.includes("reception");
    }

    if (risk.relatedEntityType === "dinnerTable") {
      return text.includes("reception") || text.includes("dinner");
    }

    if (risk.relatedEntityType === "ceremonyLayout") {
      return text.includes("chapel") || text.includes("altar") || text.includes("ceremony");
    }

    if (risk.relatedEntityType === "venueLayout") {
      return text.includes("ballroom") || text.includes("hall") || text.includes("dinner");
    }

    return false;
  });
}

function getLinkedMusicCue(phase: PreviewPhase, relatedTimeline: TimelineItem[], cues: MusicCue[]) {
  const linkedMusicCueIds = relatedTimeline.map((item) => item.musicCueId).filter((id): id is string => Boolean(id));

  if (phase.musicCueId) {
    return cues.find((cue) => cue.id === phase.musicCueId) ?? null;
  }

  return cues.find((cue) => linkedMusicCueIds.includes(cue.id)) ?? null;
}

function getLinkedSpeeches(relatedTimeline: TimelineItem[], speeches: Speech[]) {
  const linkedSpeechIds = relatedTimeline.map((item) => item.speechId).filter((id): id is string => Boolean(id));
  return speeches.filter((speech) => linkedSpeechIds.includes(speech.id));
}

function buildMissingSignals(
  phase: PreviewPhase,
  relatedTimeline: TimelineItem[],
  linkedCue: MusicCue | null,
  linkedSpeeches: Speech[],
  guestImpact: MomentGuestImpact,
  risks: RiskItem[]
) {
  const signals = new Set<string>();

  if (relatedTimeline.length === 0) {
    signals.add("No timeline moment is connected to this preview phase.");
  }

  if (!phase.responsiblePerson || !phase.responsibleRole) {
    signals.add("This moment needs a clear owner before rehearsal.");
  }

  if (linkedCue?.status === "needs-confirmation") {
    signals.add("The music cue still needs confirmation.");
  }

  if (linkedCue?.status === "needs-backup" || linkedCue?.backupPlan.toLowerCase() === "missing") {
    signals.add("The music cue needs a documented backup plan.");
  }

  if (linkedCue?.status === "needs-cue" || linkedCue?.startCue.toLowerCase().includes("missing")) {
    signals.add("The music cue needs an exact start signal.");
  }

  if (linkedSpeeches.some((speech) => speech.isSecret && speech.technicalNeeds.length > 0)) {
    signals.add("A secret program item needs discreet vendor coordination.");
  }

  if (guestImpact.level === "sensitive") {
    signals.add("Guest journey details need a final human review.");
  }

  risks.forEach((risk) => signals.add(risk.suggestedFix));

  return Array.from(signals).slice(0, 5);
}

function buildAffectedRoles(
  phase: PreviewPhase,
  linkedCue: MusicCue | null,
  linkedSpeeches: Speech[],
  guestImpact: MomentGuestImpact,
  risks: RiskItem[]
) {
  const roles = new Map<string, MomentImpactItem>();
  const addRole = (id: string, label: string, detail: string) => roles.set(id, { id, label, detail });

  addRole(getDirectorRole(phase.responsibleRole), getDirectorTitle(getDirectorRole(phase.responsibleRole)), `${phase.responsiblePerson} owns the moment.`);

  if (linkedCue) {
    addRole("dj", "DJ / Musician", `${linkedCue.moment}: ${linkedCue.songTitle}.`);
  }

  if (linkedSpeeches.length > 0) {
    addRole("toastmaster", "Toastmaster / MC", `${linkedSpeeches.length} program items need introduction and timing protection.`);
  }

  if (guestImpact.level !== "light") {
    addRole("planner", "Wedding Planner", guestImpact.label);
  }

  if (guestImpact.details.some((detail) => detail.toLowerCase().includes("allergy") || detail.toLowerCase().includes("meal"))) {
    addRole("catering", "Catering", "Meal, allergy, or child service details affect this moment.");
  }

  if (guestImpact.details.some((detail) => detail.toLowerCase().includes("accessibility") || detail.toLowerCase().includes("route"))) {
    addRole("venue", "Venue", "Guest flow and accessibility route need venue awareness.");
  }

  if (risks.some((risk) => risk.relatedEntityType === "ceremonyLayout")) {
    addRole("officiant", "Officiant", "Ceremony layout or order affects the ceremony lead.");
  }

  if (risks.some((risk) => risk.id.includes("photo") || risk.relatedEntityType === "ceremonyLayout")) {
    addRole("photographer", "Photographer", "Photo timing or positions affect capture planning.");
  }

  return Array.from(roles.values()).slice(0, 5);
}

function buildAffectedExports(relatedTimeline: TimelineItem[], risks: RiskItem[], exports: ExportType[]) {
  const timelineIds = relatedTimeline.map((item) => item.id);
  const riskIds = risks.map((risk) => risk.id);

  return exports
    .filter(
      (exportType) =>
        exportType.timelineItemIds.some((id) => timelineIds.includes(id)) ||
        exportType.warningIds.some((id) => riskIds.includes(id))
    )
    .map((exportType) => ({
      id: exportType.id,
      label: exportType.title,
      detail: exportType.description
    }))
    .slice(0, 4);
}

function buildGuestImpact(phase: PreviewPhase, guests: Guest[], dinnerTables: DinnerTable[], risks: RiskItem[]): MomentGuestImpact {
  const text = `${phase.id} ${phase.title} ${phase.location}`.toLowerCase();
  const details = new Set<string>();
  const allergyGuests = guests.filter((guest) => guest.allergies.length > 0);
  const veganGuests = guests.filter((guest) => guest.mealChoice.toLowerCase().includes("vegan"));
  const childGuests = guests.filter((guest) => guest.mealChoice.toLowerCase().includes("child") || guest.tags.some((tag) => tag.toLowerCase().includes("child")));
  const accessibilityGuests = guests.filter((guest) => guest.accessibilityNotes);
  const conflictGuests = guests.filter((guest) =>
    guest.conflictGuestIds.some((conflictGuestId) => {
      const conflictGuest = guests.find((candidate) => candidate.id === conflictGuestId);
      return conflictGuest?.tableId === guest.tableId;
    })
  );

  if (text.includes("guest-arrival") || text.includes("ceremony") || text.includes("chapel")) {
    if (accessibilityGuests.length > 0) {
      details.add(`${accessibilityGuests.length} accessibility note needs arrival awareness.`);
    }
    details.add("Guests need a clear path from arrival to ceremony seating.");
  }

  if (text.includes("reception") || text.includes("dinner") || text.includes("ballroom") || text.includes("cocktail")) {
    if (allergyGuests.length > 0) {
      details.add(`${allergyGuests.length} allergy profile needs catering awareness.`);
    }
    if (veganGuests.length > 0) {
      details.add(`${veganGuests.length} vegan meal preference needs service marking.`);
    }
    if (childGuests.length > 0) {
      details.add(`${childGuests.length} child meal or child seat detail needs setup awareness.`);
    }
    if (conflictGuests.length > 0) {
      details.add("A seating conflict touches this room plan.");
    }
    details.add(`${dinnerTables.length} tables shape guest movement through the room.`);
  }

  risks.forEach((risk) => {
    if (risk.relatedEntityType === "guest" || risk.relatedEntityType === "dinnerTable") {
      details.add(risk.title);
    }
  });

  const detailList = Array.from(details);
  const level = detailList.some((detail) => /allergy|accessibility|conflict/i.test(detail))
    ? "sensitive"
    : detailList.length > 1
      ? "moderate"
      : "light";

  return {
    level,
    label: getGuestImpactLabel(level),
    details: detailList.length > 0 ? detailList.slice(0, 5) : ["No special guest journey impact is attached to this moment."]
  };
}

function getReadinessScore(risks: RiskItem[], missingSignals: string[], linkedCue: MusicCue | null) {
  const riskPenalty = risks.reduce((total, risk) => {
    if (risk.severity === "high") {
      return total + 34;
    }

    if (risk.severity === "medium") {
      return total + 20;
    }

    return total + 10;
  }, 0);
  const signalPenalty = Math.min(30, missingSignals.length * 6);
  const cuePenalty = linkedCue && linkedCue.status !== "confirmed" ? 10 : 0;

  return Math.max(0, Math.min(100, 100 - riskPenalty - signalPenalty - cuePenalty));
}

function getReadiness(score: number, risks: RiskItem[]): MomentReadiness {
  if (score < 62 || risks.some((risk) => risk.severity === "high")) {
    return "blocked";
  }

  if (score < 88 || risks.length > 0) {
    return "review";
  }

  return "ready";
}

function getReadinessLabel(readiness: MomentReadiness, score: number) {
  if (readiness === "blocked") {
    return `Blocked until reviewed (${score}%)`;
  }

  if (readiness === "review") {
    return `Needs review (${score}%)`;
  }

  return `Ready to rehearse (${score}%)`;
}

function buildVendorHandoff(
  phase: PreviewPhase,
  nextPhase: PreviewPhase | undefined,
  linkedCue: MusicCue | null,
  linkedSpeeches: Speech[],
  guestImpact: MomentGuestImpact
): MomentVendorHandoff {
  const to = nextPhase?.responsiblePerson ?? "Final production briefs";
  const cueDetail = linkedCue ? ` Cue: ${linkedCue.startCue}.` : "";
  const speechDetail = linkedSpeeches.length > 0 ? ` Program: ${linkedSpeeches.map((speech) => speech.title).join(", ")}.` : "";
  const guestDetail = guestImpact.level !== "light" ? ` Guest journey: ${guestImpact.label}.` : "";

  return {
    from: phase.responsiblePerson,
    to,
    timing: phase.timeRange,
    instruction: `${phase.responsiblePerson} should confirm ${phase.title} completion before handing off to ${to}.${cueDetail}${speechDetail}${guestDetail}`
  };
}

function buildRehearsalNotes(
  phase: PreviewPhase,
  linkedCue: MusicCue | null,
  linkedSpeeches: Speech[],
  guestImpact: MomentGuestImpact,
  vendorHandoff: MomentVendorHandoff,
  risks: RiskItem[]
) {
  const notes = new Set<string>();

  notes.add(`Walk through ${phase.title} at ${phase.location} with ${phase.responsiblePerson}.`);
  notes.add(vendorHandoff.instruction);

  if (linkedCue) {
    notes.add(`Confirm music cue: ${linkedCue.songTitle} starts with "${linkedCue.startCue}".`);
  }

  linkedSpeeches.forEach((speech) => {
    notes.add(`Confirm ${speech.title} with ${speech.introPerson} and ${speech.technicalNeeds.join(", ")}.`);
  });

  if (guestImpact.level !== "light") {
    notes.add(guestImpact.details[0]);
  }

  risks.forEach((risk) => notes.add(risk.suggestedFix));

  return Array.from(notes).slice(0, 5);
}

function buildFailureModes(
  phase: PreviewPhase,
  linkedCue: MusicCue | null,
  linkedSpeeches: Speech[],
  guestImpact: MomentGuestImpact,
  risks: RiskItem[]
) {
  const modes = new Set<string>();

  risks.forEach((risk) => modes.add(risk.title));

  if (linkedCue && linkedCue.status !== "confirmed") {
    modes.add("The music handoff may feel uncertain without a confirmed cue.");
  }

  if (linkedSpeeches.some((speech) => speech.isSecret)) {
    modes.add("A surprise can leak if technical needs are shared too broadly.");
  }

  if (guestImpact.level === "sensitive") {
    modes.add("Guest experience can suffer if meal, accessibility, or seating notes are missed.");
  }

  if (modes.size === 0) {
    modes.add(`${phase.title} may still drift if the next handoff is not verbally confirmed.`);
  }

  return Array.from(modes).slice(0, 4);
}

function buildDecisionQueue(
  primaryAction: ProductionAction,
  missingSignals: string[],
  risks: RiskItem[],
  affectedExports: MomentImpactItem[]
) {
  const decisions = new Set<string>();

  decisions.add(primaryAction.detail);
  risks.forEach((risk) => decisions.add(risk.suggestedFix));
  missingSignals.forEach((signal) => decisions.add(signal));

  if (affectedExports.length > 0) {
    decisions.add(`Confirm this moment before sending ${affectedExports[0].label}.`);
  }

  return Array.from(decisions).slice(0, 5);
}

function buildMomentSummary(phase: PreviewPhase, readiness: MomentReadiness, risks: RiskItem[], guestImpact: MomentGuestImpact) {
  if (readiness === "blocked") {
    return `${phase.title} needs a decision before it can feel production-ready.`;
  }

  if (risks.length > 0) {
    return `${phase.title} is mostly shaped, but ${risks.length} warning still needs attention.`;
  }

  if (guestImpact.level !== "light") {
    return `${phase.title} is ready structurally, with guest journey details to keep visible.`;
  }

  return `${phase.title} is ready to rehearse as part of the wedding-day digital twin.`;
}

function getGuestImpactLabel(level: MomentGuestImpact["level"]) {
  if (level === "sensitive") {
    return "Sensitive guest journey";
  }

  if (level === "moderate") {
    return "Moderate guest impact";
  }

  return "Light guest impact";
}

function getDirectorRole(role: string) {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole.includes("toastmaster") || normalizedRole.includes("mc")) {
    return "toastmaster";
  }

  if (normalizedRole.includes("photo")) {
    return "photographer";
  }

  if (normalizedRole.includes("dj") || normalizedRole.includes("music")) {
    return "dj";
  }

  if (normalizedRole.includes("catering")) {
    return "catering";
  }

  if (normalizedRole.includes("venue")) {
    return "venue";
  }

  if (normalizedRole.includes("officiant")) {
    return "officiant";
  }

  return "planner";
}

function getDirectorTitle(role: string) {
  const titles: Record<string, string> = {
    catering: "Catering",
    dj: "DJ / Musician",
    officiant: "Officiant",
    photographer: "Photographer",
    planner: "Wedding Planner",
    toastmaster: "Toastmaster / MC",
    venue: "Venue"
  };

  return titles[role] ?? "Director Mode";
}
