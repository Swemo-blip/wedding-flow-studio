import { createResolutionHref, getRiskResolutionRecipeForRisk } from "@/lib/risk-resolution";
import type { Guest, MusicCue, PreviewPhase, RiskItem, Speech, TimelineItem } from "@/lib/wedding-types";

export type ProductionActionScope = "timeline" | "music" | "guest" | "speech" | "navigation" | "compound";
export type ProductionActionExecution = "inline" | "navigate";

export type ProductionAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  scope: ProductionActionScope;
  execution: ProductionActionExecution;
  successLabel: string;
  riskId?: string;
  timelineItemId?: string;
  timelineUpdates?: Partial<TimelineItem>;
  timelineNoteToAppend?: string;
  musicCueId?: string;
  musicCueUpdates?: Partial<MusicCue>;
  musicCueNoteToAppend?: string;
  guestId?: string;
  guestTagToAdd?: string;
  guestTableId?: string;
  speechId?: string;
  speechNoteToAppend?: string;
};

type MomentActionInput = {
  affectedRoleId?: string;
  affectedRoleLabel?: string;
  linkedCue: MusicCue | null;
  linkedSpeeches: Speech[];
  phase: PreviewPhase;
  phaseIndex: number;
  phaseRisks: RiskItem[];
  totalPhases: number;
};

export function buildProductionActionForRisk(risk: RiskItem): ProductionAction {
  const recipe = getRiskResolutionRecipeForRisk(risk);
  const timelineItemId = recipe?.timelineItemId;
  const baseAction = {
    detail: risk.description,
    href: createResolutionHref(risk),
    riskId: risk.id,
    successLabel: recipe?.resolvedLabel ?? "Action applied",
    timelineItemId,
    timelineNoteToAppend: recipe?.noteToAppend,
    timelineUpdates: recipe?.timelineUpdates
  };

  if (risk.id === "risk-group-photo-time") {
    return {
      ...baseAction,
      id: "action-extend-group-photos",
      label: "Apply Photo Buffer",
      scope: "timeline",
      execution: "inline",
      successLabel: "Photo buffer added",
      timelineItemId: "group-photos",
      timelineUpdates: { durationMinutes: 35, riskLevel: undefined },
      timelineNoteToAppend: "Action Engine: Extended group photos to 35 minutes and assigned the family photo list to the photographer."
    };
  }

  if (risk.id === "risk-music-backup") {
    return {
      ...baseAction,
      id: "action-add-recessional-backup",
      label: "Add Music Backup",
      scope: "compound",
      execution: "inline",
      successLabel: "Music backup added",
      musicCueId: risk.relatedEntityType === "musicCue" ? risk.relatedEntityId : "music-recessional",
      musicCueUpdates: {
        backupPlan: "DJ local file and offline ceremony playlist",
        status: "confirmed"
      },
      timelineItemId: timelineItemId ?? "recessional",
      timelineNoteToAppend: "Action Engine: DJ local recessional backup added to the cue sheet before rehearsal."
    };
  }

  if (risk.id === "risk-music-start-cue") {
    return {
      ...baseAction,
      id: "action-confirm-first-dance-cue",
      label: "Set First Dance Cue",
      scope: "compound",
      execution: "inline",
      successLabel: "First dance cue set",
      musicCueId: risk.relatedEntityType === "musicCue" ? risk.relatedEntityId : "music-first-dance",
      musicCueUpdates: {
        startCue: "Start at 0:00 on Toastmaster's nod; fade after final chorus",
        status: "confirmed"
      },
      timelineItemId: timelineItemId ?? "first-dance",
      timelineNoteToAppend: "Action Engine: First dance timestamp, fade plan, and start signal marked for DJ."
    };
  }

  if (risk.id === "risk-couple-entrance-confirmation") {
    return {
      ...baseAction,
      id: "action-confirm-couple-entrance",
      label: "Confirm Entrance Cue",
      scope: "compound",
      execution: "inline",
      successLabel: "Entrance cue confirmed",
      musicCueId: risk.relatedEntityType === "musicCue" ? risk.relatedEntityId : "music-couple-entrance",
      musicCueUpdates: { status: "confirmed" },
      musicCueNoteToAppend: "Action Engine: Confirmed arrangement length and cue point for rehearsal.",
      timelineItemId: timelineItemId ?? "couple-entrance",
      timelineNoteToAppend: "Action Engine: Couple entrance arrangement and cue point marked confirmed for rehearsal."
    };
  }

  if (risk.id === "risk-catering-allergy") {
    return {
      ...baseAction,
      id: "action-send-allergy-brief",
      label: "Send Allergy Brief",
      scope: "compound",
      execution: "inline",
      successLabel: "Allergy brief marked",
      guestId: risk.relatedEntityType === "guest" ? risk.relatedEntityId : "anna-carter",
      guestTagToAdd: "allergy brief sent",
      timelineItemId: timelineItemId ?? "first-course",
      timelineNoteToAppend: "Action Engine: Final allergy details marked for Sophia Grant and catering service."
    };
  }

  if (risk.id === "risk-vegan-meal") {
    return {
      ...baseAction,
      id: "action-confirm-vegan-meal",
      label: "Confirm Vegan Meal",
      scope: "guest",
      execution: "inline",
      successLabel: "Vegan meal confirmed",
      guestId: risk.relatedEntityType === "guest" ? risk.relatedEntityId : undefined,
      guestTagToAdd: "meal confirmed",
      timelineItemId: timelineItemId ?? "first-course",
      timelineNoteToAppend: "Action Engine: Vegan meal marker confirmed for catering."
    };
  }

  if (risk.id === "risk-child-meal") {
    return {
      ...baseAction,
      id: "action-confirm-child-setup",
      label: "Confirm Child Setup",
      scope: "guest",
      execution: "inline",
      successLabel: "Child setup confirmed",
      guestId: risk.relatedEntityType === "guest" ? risk.relatedEntityId : undefined,
      guestTagToAdd: "child setup confirmed",
      timelineItemId: timelineItemId ?? "first-course",
      timelineNoteToAppend: "Action Engine: Child meal and seat setup confirmed for reception service."
    };
  }

  if (risk.id === "risk-accessibility") {
    return {
      ...baseAction,
      id: "action-confirm-accessibility-flow",
      label: "Confirm Guest Flow",
      scope: "compound",
      execution: "inline",
      successLabel: "Accessible flow confirmed",
      guestId: risk.relatedEntityType === "guest" ? risk.relatedEntityId : "anna-carter",
      guestTagToAdd: "accessibility route confirmed",
      timelineItemId: timelineItemId ?? "guest-arrival",
      timelineNoteToAppend: "Action Engine: Accessible entrance route and seating handoff confirmed with ushers."
    };
  }

  if (risk.id === "risk-seating-conflict") {
    return {
      ...baseAction,
      id: "action-resolve-seating-conflict",
      label: "Resolve Seating Conflict",
      scope: "compound",
      execution: "inline",
      successLabel: "Seating conflict resolved",
      guestId: "lisa-ek",
      guestTableId: "table-4",
      guestTagToAdd: "seating conflict resolved",
      timelineItemId: timelineItemId ?? "reception-doors",
      timelineNoteToAppend: "Action Engine: Lisa Ek moved away from the conflict table and marked for planner review."
    };
  }

  if (risk.id === "risk-speech-length") {
    return {
      ...baseAction,
      id: "action-protect-speech-timing",
      label: "Add Speech Buffer",
      scope: "timeline",
      execution: "inline",
      successLabel: "Speech buffer added",
      timelineItemId: timelineItemId ?? "welcome-toast",
      timelineNoteToAppend: "Action Engine: Toastmaster to group speeches, protect dinner service pauses, and keep the pre-cake program moving."
    };
  }

  if (risk.id === "risk-secret-technical") {
    return {
      ...baseAction,
      id: "action-coordinate-secret-audio",
      label: "Coordinate Secret Audio",
      scope: "compound",
      execution: "inline",
      successLabel: "Secret audio coordinated",
      speechId: risk.relatedEntityType === "speech" ? risk.relatedEntityId : "speech-friends-song",
      speechNoteToAppend: "Action Engine: Audio support confirmed discreetly with DJ and Toastmaster.",
      timelineItemId: timelineItemId ?? "friends-song",
      timelineNoteToAppend: "Action Engine: Secret performance technical needs confirmed while keeping the surprise protected."
    };
  }

  if (risk.id === "risk-balcony-approval") {
    return {
      ...baseAction,
      id: "action-request-balcony-approval",
      label: "Request Balcony Approval",
      scope: "timeline",
      execution: "inline",
      successLabel: "Balcony approval requested",
      timelineItemId: timelineItemId ?? "ceremony-begins",
      timelineNoteToAppend: "Action Engine: Venue manager to confirm balcony access for photographer before rehearsal."
    };
  }

  if (risk.id === "risk-service-path") {
    return {
      ...baseAction,
      id: "action-protect-service-path",
      label: "Protect Service Path",
      scope: "timeline",
      execution: "inline",
      successLabel: "Service path protected",
      timelineItemId: timelineItemId ?? "main-course",
      timelineNoteToAppend: "Action Engine: East wall service path spacing marked for venue and catering before guest arrival."
    };
  }

  return {
    ...baseAction,
    id: `action-${risk.id}`,
    label: recipe?.primaryActionLabel ?? "Add Production Note",
    scope: "timeline",
    execution: "inline",
    successLabel: recipe?.resolvedLabel ?? "Production note added"
  };
}

export function buildProductionActionForMoment({
  affectedRoleId,
  affectedRoleLabel,
  linkedCue,
  linkedSpeeches,
  phase,
  phaseIndex,
  phaseRisks,
  totalPhases
}: MomentActionInput): ProductionAction {
  const primaryRisk = phase.riskId
    ? phaseRisks.find((risk) => risk.id === phase.riskId) ?? phaseRisks[0]
    : phaseRisks[0];

  if (primaryRisk) {
    return buildProductionActionForRisk(primaryRisk);
  }

  if (linkedCue && linkedCue.status !== "confirmed") {
    return {
      id: `action-tighten-${linkedCue.id}`,
      label: "Tighten Music Cue",
      detail: `${linkedCue.moment} needs cue confidence before rehearsal.`,
      href: "/music",
      scope: "music",
      execution: "inline",
      successLabel: "Music cue tightened",
      musicCueId: linkedCue.id,
      musicCueUpdates: {
        status: "confirmed"
      },
      musicCueNoteToAppend: "Action Engine: Cue confidence confirmed from Moment Intelligence."
    };
  }

  if (linkedSpeeches.length > 0) {
    return {
      id: `action-review-program-${phase.id}`,
      label: "Review Program Layer",
      detail: "Confirm introductions, timing, technical needs, and secret visibility.",
      href: "/speeches",
      scope: "navigation",
      execution: "navigate",
      successLabel: "Program layer opened"
    };
  }

  if (phaseIndex >= totalPhases - 2) {
    return {
      id: `action-prepare-briefs-${phase.id}`,
      label: "Prepare Final Briefs",
      detail: "Turn the previewed plan into role-ready handoffs.",
      href: "/exports",
      scope: "navigation",
      execution: "navigate",
      successLabel: "Brief builder opened"
    };
  }

  return {
    id: `action-open-role-${affectedRoleId ?? "planner"}`,
    label: affectedRoleLabel ? `Open ${affectedRoleLabel}` : "Open Director Mode",
    detail: affectedRoleLabel
      ? `${phase.responsiblePerson} owns this moment. Review the focused production board.`
      : "Review role-specific timing, handoffs, and checklist items.",
    href: affectedRoleId ? `/director?role=${affectedRoleId}` : "/director",
    scope: "navigation",
    execution: "navigate",
    successLabel: "Director board opened"
  };
}

export function applyProductionActionToTimeline(items: TimelineItem[], action: ProductionAction) {
  if (!action.timelineItemId && !action.timelineNoteToAppend && !action.timelineUpdates) {
    return items;
  }

  return items.map((item) => {
    if (item.id !== action.timelineItemId) {
      return item;
    }

    return {
      ...item,
      ...action.timelineUpdates,
      notes: action.timelineNoteToAppend ? appendNote(item.notes, action.timelineNoteToAppend) : item.notes
    };
  });
}

export function getMusicCueActionUpdates(cue: MusicCue, action: ProductionAction): Partial<MusicCue> {
  const updates: Partial<MusicCue> = { ...action.musicCueUpdates };

  if (action.musicCueNoteToAppend) {
    updates.notes = appendNote(cue.notes, action.musicCueNoteToAppend);
  }

  return updates;
}

export function getGuestActionUpdates(guest: Guest, action: ProductionAction): Partial<Guest> {
  if (!action.guestTagToAdd) {
    return {};
  }

  return {
    tags: addUnique(guest.tags, action.guestTagToAdd)
  };
}

export function getSpeechActionUpdates(speech: Speech, action: ProductionAction): Partial<Speech> {
  if (!action.speechNoteToAppend) {
    return {};
  }

  return {
    notes: appendNote(speech.notes, action.speechNoteToAppend)
  };
}

export function canApplyProductionAction(action: ProductionAction) {
  return action.execution === "inline";
}

function appendNote(notes: string, note: string) {
  if (notes.includes(note)) {
    return notes;
  }

  return `${notes}\n\n${note}`;
}

function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}
