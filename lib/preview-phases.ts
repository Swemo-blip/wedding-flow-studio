import type { PreviewPhase, TimelineItem } from "@/lib/wedding-types";

// Poetic feeling-lines keyed by phase TYPE (lowercased phase name). These are
// flavour only — a custom phase with no match falls back to a line synthesised
// from the couple's own moments, so the Preview always narrates THEIR day.
const PHASE_SUMMARIES: Record<string, string> = {
  "guest arrival": "Guests are welcomed, seated, and guided to their places.",
  "ceremony setup": "The last details are set and the space is readied.",
  prelude: "The room settles as the musicians begin.",
  processional: "The wedding party makes its way in.",
  ceremony: "Vows, rings, and the moment it becomes official.",
  vows: "The words that make it official.",
  recessional: "Hand in hand, back up the aisle — newly married.",
  photography: "A few quiet frames before the celebration.",
  "group photos": "Everyone gathers for the photos to keep.",
  "cocktail hour": "Drinks, first hellos, and the evening easing in.",
  reception: "The doors open on the celebration.",
  "reception entrance": "The couple make their entrance to the party.",
  "dinner service": "Everyone is seated as the meal is served.",
  dinner: "Everyone is seated as the meal is served.",
  speeches: "Words from the people who know you best.",
  "first dance": "The floor clears for the first dance.",
  cake: "The cake is cut and shared.",
  party: "The lights drop and the night belongs to the dancefloor."
};

// Reception-side keywords, for classifying a phase whose name we don't recognise
// so the 3D walkthrough still shows the right room. Exported so the home studio
// can sort timeline moments and warnings into the scene they belong to.
const RECEPTION_HINTS = ["reception", "cocktail", "dinner", "meal", "speech", "toast", "cake", "dance", "party", "evening"];

export function isReceptionPhase(phaseName: string): boolean {
  const key = phaseName.toLowerCase();
  return RECEPTION_HINTS.some((hint) => key.includes(hint));
}

// Groups the couple's own timeline into one Preview movement per phase, in the
// order the phases first appear. Every field is synthesised from real items, so
// editing the timeline (add/remove/retitle a moment) changes the Preview.
export function derivePreviewPhases(items: TimelineItem[]): PreviewPhase[] {
  if (!items.length) {
    return [];
  }

  // Break the (already chronological) timeline into CONTIGUOUS runs of the same
  // phase. Grouping every same-named item together assumed each phase occupied
  // one unbroken stretch, but real days interleave them (the Processional splits
  // the Ceremony; Dinner splits the Speeches). That made one movement absorb a
  // later item and play before the phase that interrupted it, with a time range
  // running backward. Contiguous runs keep movements chronological and their
  // ranges correct, even when a phase recurs.
  const runs: Array<{ phaseName: string; items: TimelineItem[] }> = [];
  for (const item of items) {
    const phaseName = item.phase?.trim() || "The day";
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.phaseName === phaseName) {
      lastRun.items.push(item);
    } else {
      runs.push({ phaseName, items: [item] });
    }
  }

  return runs.map(({ phaseName, items: group }, phaseIndex) => {
    const first = group[0];
    const last = group[group.length - 1];
    const people = Array.from(new Set(group.map((item) => item.responsiblePerson).filter((name): name is string => Boolean(name))));
    const musicItem = group.find((item) => item.musicCueId);
    const fallbackSummary = group
      .map((item) => item.title)
      .slice(0, 2)
      .join(" · ");

    return {
      id: `derived-phase-${phaseIndex}-${phaseName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: phaseName,
      timeRange: first?.time && last?.time && first.time !== last.time ? `${first.time} - ${last.time}` : first?.time ?? "",
      location: first?.location ?? "",
      summary: PHASE_SUMMARIES[phaseName.toLowerCase()] ?? (fallbackSummary || "A moment in the day."),
      involvedPeople: people,
      responsibleRole: first?.responsibleRole ?? "",
      responsiblePerson: first?.responsiblePerson ?? "",
      musicCueId: musicItem?.musicCueId,
      relatedTimelineItemIds: group.map((item) => item.id)
    };
  });
}

// Maps a derived phase to one of the proven 13 camera waypoints by name, so we
// reuse camera positions that are known to render cleanly (never inventing a new
// position that could clip into geometry). Unknown phases fall back to a sensible
// ceremony/reception camera so the correct room always shows.
const PHASE_WAYPOINT: Record<string, number> = {
  "guest arrival": 0,
  "ceremony setup": 0,
  prelude: 1,
  processional: 2,
  ceremony: 3,
  vows: 3,
  recessional: 4,
  photography: 5,
  "group photos": 5,
  "cocktail hour": 6,
  reception: 7,
  "reception entrance": 7,
  "dinner service": 8,
  dinner: 8,
  speeches: 9,
  cake: 10,
  "first dance": 11,
  party: 12
};

export function waypointIndexForPhase(phaseTitle: string): number {
  const key = phaseTitle.toLowerCase();
  const mapped = PHASE_WAYPOINT[key];
  if (mapped !== undefined) {
    return mapped;
  }
  return isReceptionPhase(phaseTitle) ? 7 : 3;
}
