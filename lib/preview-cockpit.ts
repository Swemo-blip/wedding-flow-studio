import { createResolutionHref } from "@/lib/risk-resolution";
import type { MusicCue, PreviewPhase, RiskItem, Speech, TimelineItem } from "@/lib/wedding-types";

export type PreviewCockpitContext = {
  musicCue: MusicCue | null;
  musicLabel: string;
  primaryRisk: RiskItem | null;
  phaseRisks: RiskItem[];
  upcomingRisks: RiskItem[];
  sceneKind: PreviewSceneKind;
  sceneLabel: string;
  speechLabels: string[];
  directorRole: string;
  directorTitle: string;
  healthTone: "confirmed" | "medium" | "high";
  healthLabel: string;
  primaryAction: PreviewCockpitAction;
  supportActions: PreviewCockpitAction[];
  handoffLine: string;
  feelingLine: string;
  watchLine: string;
};

export type PreviewCockpitAction = {
  label: string;
  href: string;
  detail: string;
};

export type PreviewSceneKind = "ballroom" | "chapel" | "dance" | "garden" | "terrace";

type PreviewCockpitInput = {
  cues: MusicCue[];
  nextPhase?: PreviewPhase;
  phase: PreviewPhase;
  phaseIndex: number;
  relatedTimeline: TimelineItem[];
  risks: RiskItem[];
  speechItems: Speech[];
  totalPhases: number;
};

export function buildPreviewCockpitContext({
  cues,
  nextPhase,
  phase,
  phaseIndex,
  relatedTimeline,
  risks,
  speechItems,
  totalPhases
}: PreviewCockpitInput): PreviewCockpitContext {
  const linkedMusicCueIds = relatedTimeline
    .map((item) => item.musicCueId)
    .filter((cueId): cueId is string => Boolean(cueId));
  const linkedSpeechIds = relatedTimeline
    .map((item) => item.speechId)
    .filter((speechId): speechId is string => Boolean(speechId));
  const musicCue = phase.musicCueId
    ? cues.find((cue) => cue.id === phase.musicCueId) ?? null
    : cues.find((cue) => linkedMusicCueIds.includes(cue.id)) ?? null;
  const speechLabels = relatedTimeline
    .map((item) => {
      const speech = item.speechId ? speechItems.find((speechItem) => speechItem.id === item.speechId) : null;
      return speech ? `${speech.timing} - ${speech.title}${speech.isSecret ? " (Secret Layer)" : ""}` : null;
    })
    .filter((label): label is string => Boolean(label));
  const phaseRisks = risks.filter((risk) =>
    isRiskRelevantToPhase(risk, phase, relatedTimeline, linkedMusicCueIds, linkedSpeechIds)
  );
  const primaryRisk = phase.riskId
    ? phaseRisks.find((risk) => risk.id === phase.riskId) ?? phaseRisks[0] ?? null
    : phaseRisks[0] ?? null;
  const upcomingRisks = risks.filter((risk) => !phaseRisks.some((phaseRisk) => phaseRisk.id === risk.id)).slice(0, 3);
  const sceneKind = getSceneKind(phase);
  const directorRole = getDirectorRole(phase.responsibleRole);
  const directorTitle = getDirectorTitle(directorRole);
  const musicNeedsWork = musicCue ? musicCue.status !== "confirmed" : false;
  const healthTone = primaryRisk?.severity === "high" ? "high" : primaryRisk || musicNeedsWork ? "medium" : "confirmed";
  const primaryAction = getPrimaryAction({
    directorRole,
    directorTitle,
    musicCue,
    phase,
    phaseIndex,
    primaryRisk,
    sceneKind,
    speechLabels,
    totalPhases
  });

  return {
    musicCue,
    musicLabel: musicCue ? `${musicCue.songTitle} by ${musicCue.artist}` : "No music cue linked",
    primaryRisk,
    phaseRisks,
    upcomingRisks,
    sceneKind,
    sceneLabel: getSceneLabel(sceneKind),
    speechLabels,
    directorRole,
    directorTitle,
    healthTone,
    healthLabel: getHealthLabel(primaryRisk, musicNeedsWork),
    primaryAction,
    supportActions: [
      {
        label: "Open Full Timeline",
        href: "/day-flow",
        detail: "Adjust timing, ownership, notes, and risk resolution from the full run of show."
      },
      {
        label: `Open ${directorTitle}`,
        href: `/director?role=${directorRole}`,
        detail: "See the role-specific production board for this moment."
      },
      {
        label: "Prepare Brief",
        href: "/exports",
        detail: "Move from preview into copy-ready production handoffs."
      }
    ],
    handoffLine: nextPhase
      ? `${phase.responsiblePerson} hands off to ${nextPhase.responsiblePerson} for ${nextPhase.title}.`
      : "The production map is complete and ready to become role briefs.",
    feelingLine: getFeelingLine(sceneKind, phase),
    watchLine: primaryRisk
      ? primaryRisk.suggestedFix
      : musicNeedsWork
        ? "Tighten the cue before rehearsal so the handoff feels intentional."
        : "This moment has a clear owner, location, timing, and next handoff."
  };
}

function isRiskRelevantToPhase(
  risk: RiskItem,
  phase: PreviewPhase,
  relatedTimeline: TimelineItem[],
  linkedMusicCueIds: string[],
  linkedSpeechIds: string[]
) {
  const relatedTimelineIds = relatedTimeline.map((item) => item.id);

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
      return phase.id === "phase-guest-arrival" || phase.id === "phase-reception-entrance";
    }

    if (risk.id === "risk-catering-allergy" || risk.id === "risk-vegan-meal" || risk.id === "risk-child-meal") {
      return phase.id === "phase-dinner" || phase.id === "phase-reception-entrance";
    }

    return phase.id === "phase-dinner" || phase.id === "phase-reception-entrance";
  }

  if (risk.relatedEntityType === "dinnerTable") {
    return phase.id === "phase-reception-entrance" || phase.id === "phase-dinner";
  }

  if (risk.relatedEntityType === "ceremonyLayout") {
    return phase.location.toLowerCase().includes("chapel") || phase.location.toLowerCase().includes("altar");
  }

  if (risk.relatedEntityType === "venueLayout") {
    return phase.location.toLowerCase().includes("ballroom") || phase.location.toLowerCase().includes("hall");
  }

  return false;
}

function getPrimaryAction({
  directorRole,
  directorTitle,
  musicCue,
  phase,
  phaseIndex,
  primaryRisk,
  sceneKind,
  speechLabels,
  totalPhases
}: {
  directorRole: string;
  directorTitle: string;
  musicCue: MusicCue | null;
  phase: PreviewPhase;
  phaseIndex: number;
  primaryRisk: RiskItem | null;
  sceneKind: PreviewSceneKind;
  speechLabels: string[];
  totalPhases: number;
}): PreviewCockpitAction {
  if (primaryRisk) {
    return {
      label: "Resolve This Moment",
      href: createResolutionHref(primaryRisk),
      detail: primaryRisk.description
    };
  }

  if (musicCue && musicCue.status !== "confirmed") {
    return {
      label: "Tighten Music Cue",
      href: "/music",
      detail: `${musicCue.moment} needs cue confidence before rehearsal.`
    };
  }

  if (speechLabels.length > 0) {
    return {
      label: "Open Program Layer",
      href: "/speeches",
      detail: "Review speech timing, secret layers, introductions, and technical needs."
    };
  }

  if (sceneKind === "chapel") {
    return {
      label: "Open Ceremony Layout",
      href: "/ceremony",
      detail: "Review chapel positions, ceremony flow, music moments, and photographer sight lines."
    };
  }

  if (sceneKind === "ballroom" || sceneKind === "terrace") {
    return {
      label: "Open Reception Plan",
      href: "/reception",
      detail: "Review guest journey, tables, room flow, service paths, and accessibility notes."
    };
  }

  if (phaseIndex >= totalPhases - 2) {
    return {
      label: "Prepare Final Briefs",
      href: "/exports",
      detail: "Turn the previewed plan into role-ready handoffs."
    };
  }

  return {
    label: `Open ${directorTitle}`,
    href: `/director?role=${directorRole}`,
    detail: `${phase.responsiblePerson} owns this moment. Review their focused production board.`
  };
}

function getHealthLabel(primaryRisk: RiskItem | null, musicNeedsWork: boolean) {
  if (primaryRisk?.severity === "high") {
    return "Command decision needed";
  }

  if (primaryRisk) {
    return "Needs one review";
  }

  if (musicNeedsWork) {
    return "Cue needs polish";
  }

  return "Ready to rehearse";
}

export function getSceneKind(phase: PreviewPhase): PreviewSceneKind {
  const text = `${phase.title} ${phase.location}`.toLowerCase();

  if (text.includes("garden") || text.includes("photo")) {
    return "garden";
  }

  if (text.includes("terrace") || text.includes("cocktail")) {
    return "terrace";
  }

  if (text.includes("dance") || text.includes("party")) {
    return "dance";
  }

  if (text.includes("ballroom") || text.includes("dinner") || text.includes("speech") || text.includes("cake") || text.includes("reception")) {
    return "ballroom";
  }

  return "chapel";
}

function getSceneLabel(scene: PreviewSceneKind) {
  if (scene === "garden") {
    return "Photo gathering point";
  }

  if (scene === "terrace") {
    return "Guest arrival terrace";
  }

  if (scene === "dance") {
    return "Dance floor";
  }

  if (scene === "ballroom") {
    return "Reception room";
  }

  return "Ceremony focal point";
}

function getFeelingLine(scene: PreviewSceneKind, phase: PreviewPhase) {
  if (scene === "chapel") {
    return "Quiet, precise, and emotionally held.";
  }

  if (scene === "garden") {
    return "Light, organized, and gently directed.";
  }

  if (scene === "terrace") {
    return "Soft arrival energy with clear guest movement.";
  }

  if (scene === "dance") {
    return "Open, celebratory, and rhythm-led.";
  }

  if (phase.id === "phase-speeches") {
    return "Warm, attentive, and protected from timing drift.";
  }

  return "Elegant, hosted, and operationally calm.";
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
    catering: "Catering Board",
    dj: "DJ / Musician Board",
    officiant: "Officiant Board",
    photographer: "Photographer Board",
    planner: "Planner Board",
    toastmaster: "Toastmaster Board",
    venue: "Venue Board"
  };

  return titles[role] ?? "Director Board";
}
