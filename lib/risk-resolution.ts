import { musicCues, speeches } from "@/lib/wedding-data";
import type { RiskItem, TimelineItem } from "@/lib/wedding-types";

export type RiskResolutionRecipe = {
  riskId: string;
  title: string;
  description: string;
  primaryActionLabel: string;
  resolvedLabel: string;
  timelineItemId: string;
  timelineUpdates?: Partial<TimelineItem>;
  noteToAppend?: string;
};

const resolutionRecipes: RiskResolutionRecipe[] = [
  {
    riskId: "risk-group-photo-time",
    title: "Extend the group photo window.",
    description: "Give the photographer enough time for 112 guests, immediate family, wedding party, and grandparents.",
    primaryActionLabel: "Apply 35-minute photo buffer",
    resolvedLabel: "Photo buffer added",
    timelineItemId: "group-photos",
    timelineUpdates: {
      durationMinutes: 35,
      riskLevel: undefined
    },
    noteToAppend: "Resolve Mode: Extended group photos to 35 minutes and assigned the family photo list to the photographer."
  },
  {
    riskId: "risk-music-backup",
    title: "Add a recessional music backup.",
    description: "Make the handoff safer by documenting a local backup file with the DJ.",
    primaryActionLabel: "Mark backup plan requested",
    resolvedLabel: "Backup plan marked for DJ",
    timelineItemId: "recessional",
    timelineUpdates: {
      riskLevel: undefined
    },
    noteToAppend: "Resolve Mode: DJ to prepare a local recessional backup file before rehearsal."
  },
  {
    riskId: "risk-music-start-cue",
    title: "Confirm the first dance start cue.",
    description: "The DJ needs the exact timestamp, fade plan, and signal before the first dance begins.",
    primaryActionLabel: "Mark first dance cue for confirmation",
    resolvedLabel: "First dance cue marked",
    timelineItemId: "first-dance",
    timelineUpdates: {
      riskLevel: undefined
    },
    noteToAppend: "Resolve Mode: Confirm exact first dance timestamp, fade plan, and start signal with the DJ."
  },
  {
    riskId: "risk-couple-entrance-confirmation",
    title: "Confirm the couple entrance arrangement.",
    description: "The processional needs arrangement length and a clear start cue before rehearsal.",
    primaryActionLabel: "Mark entrance cue confirmed",
    resolvedLabel: "Entrance cue marked",
    timelineItemId: "couple-entrance",
    timelineUpdates: {
      riskLevel: undefined
    },
    noteToAppend: "Resolve Mode: Confirm arrangement length and cue point with the soloist before rehearsal."
  },
  {
    riskId: "risk-speech-length",
    title: "Protect the reception from speech drift.",
    description: "Group speech timing into a clearer run of show and keep dinner service breaks protected.",
    primaryActionLabel: "Add speech buffer note",
    resolvedLabel: "Speech buffer note added",
    timelineItemId: "welcome-toast",
    noteToAppend: "Resolve Mode: Toastmaster to group speeches, protect dinner service breaks, and keep the pre-cake program on time."
  },
  {
    riskId: "risk-catering-allergy",
    title: "Send allergy details to catering.",
    description: "The catering lead needs final allergy details connected to service timing.",
    primaryActionLabel: "Mark allergy brief for catering",
    resolvedLabel: "Catering allergy brief marked",
    timelineItemId: "first-course",
    noteToAppend: "Resolve Mode: Send final allergy details to Sophia Grant and mark Anna Carter's seat before service."
  },
  {
    riskId: "risk-accessibility",
    title: "Confirm accessible guest flow.",
    description: "Accessible seating and the route from entrance to table should be confirmed before doors open.",
    primaryActionLabel: "Add accessibility handoff",
    resolvedLabel: "Accessibility handoff added",
    timelineItemId: "guest-arrival",
    noteToAppend: "Resolve Mode: Confirm accessible entrance route and seating handoff with ushers before guest arrival."
  },
  {
    riskId: "risk-seating-conflict",
    title: "Review the seating conflict.",
    description: "The seating plan needs a human decision before export, so flag it inside the reception handoff.",
    primaryActionLabel: "Mark seating conflict for planner",
    resolvedLabel: "Seating conflict marked",
    timelineItemId: "reception-doors",
    noteToAppend: "Resolve Mode: Planner to review Johan Ek and Lisa Ek seating before exporting the final seating plan."
  },
  {
    riskId: "risk-secret-technical",
    title: "Coordinate the secret technical cue.",
    description: "Keep the surprise protected while giving audio support to the right production roles.",
    primaryActionLabel: "Add secret audio handoff",
    resolvedLabel: "Secret audio handoff added",
    timelineItemId: "friends-song",
    noteToAppend: "Resolve Mode: Keep the surprise hidden from the couple and confirm microphone plus speaker input with the DJ."
  },
  {
    riskId: "risk-balcony-approval",
    title: "Request balcony position approval.",
    description: "The ceremony photographer position needs chapel approval before rehearsal.",
    primaryActionLabel: "Add venue approval note",
    resolvedLabel: "Venue approval note added",
    timelineItemId: "ceremony-begins",
    noteToAppend: "Resolve Mode: Ask Henry Cole to confirm chapel balcony access for Clara Hayes during rehearsal."
  },
  {
    riskId: "risk-service-path",
    title: "Protect the catering service path.",
    description: "Dinner service needs a clear route along the east wall during speeches.",
    primaryActionLabel: "Add service path note",
    resolvedLabel: "Service path note added",
    timelineItemId: "main-course",
    noteToAppend: "Resolve Mode: Confirm east wall service path spacing with the venue manager before guest arrival."
  }
];

export function getRiskResolutionRecipe(riskId: string) {
  const directRecipe = resolutionRecipes.find((recipe) => recipe.riskId === riskId);

  if (directRecipe) {
    return directRecipe;
  }

  return null;
}

export function getRiskResolutionRecipeForRisk(risk: RiskItem) {
  const directRecipe = getRiskResolutionRecipe(risk.id);

  if (directRecipe) {
    return directRecipe;
  }

  const timelineItemId = getTimelineItemIdForRisk(risk);
  if (!timelineItemId) {
    return null;
  }

  return {
    riskId: risk.id,
    title: risk.title,
    description: risk.description,
    primaryActionLabel: "Add production note",
    resolvedLabel: "Production note added",
    timelineItemId,
    noteToAppend: `Resolve Mode: ${risk.suggestedFix}`
  };
}

export function applyRiskResolutionToTimeline(items: TimelineItem[], recipe: RiskResolutionRecipe) {
  return items.map((item) => {
    if (item.id !== recipe.timelineItemId) {
      return item;
    }

    const nextNotes = recipe.noteToAppend ? appendNote(item.notes, recipe.noteToAppend) : item.notes;

    return {
      ...item,
      ...recipe.timelineUpdates,
      notes: nextNotes
    };
  });
}

export function createResolutionHref(risk: RiskItem) {
  const recipe = getRiskResolutionRecipeForRisk(risk);
  const focus = recipe?.timelineItemId ?? getTimelineItemIdForRisk(risk);
  const params = new URLSearchParams({ resolve: risk.id });

  if (focus) {
    params.set("focus", focus);
  }

  return `/day-flow?${params.toString()}`;
}

function getTimelineItemIdForRisk(risk: RiskItem) {
  if (risk.relatedEntityType === "timeline") {
    return risk.relatedEntityId;
  }

  if (risk.relatedEntityType === "musicCue") {
    return musicCues.find((cue) => cue.id === risk.relatedEntityId)?.timelineItemId;
  }

  if (risk.relatedEntityType === "speech") {
    if (risk.relatedEntityId === "all-speeches") {
      return "welcome-toast";
    }

    return speeches.find((speech) => speech.id === risk.relatedEntityId)?.timelineItemId;
  }

  if (risk.relatedEntityType === "guest") {
    return risk.id === "risk-accessibility" ? "guest-arrival" : "first-course";
  }

  if (risk.relatedEntityType === "dinnerTable") {
    return "reception-doors";
  }

  if (risk.relatedEntityType === "ceremonyLayout") {
    return "ceremony-begins";
  }

  if (risk.relatedEntityType === "venueLayout") {
    return "main-course";
  }

  return undefined;
}

function appendNote(notes: string, note: string) {
  if (notes.includes(note)) {
    return notes;
  }

  return `${notes}\n\n${note}`;
}
