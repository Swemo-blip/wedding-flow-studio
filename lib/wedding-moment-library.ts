import { formatMinutesAsTime, parseTimeToMinutes } from "@/lib/utils";
import type { TimelineItem } from "@/lib/wedding-types";

// The moments almost every wedding actually has, so a couple can assemble a day
// from known pieces instead of typing "New moment" fifteen times and inventing
// their own durations.
//
// The durations here are conventions, not claims about THIS wedding — a first
// dance runs about four minutes everywhere. Every value lands in a normal
// editable row, so the couple overrides anything that does not fit them. Nothing
// is inserted without them choosing it.
export type MomentPreset = {
  id: string;
  title: string;
  phase: TimelineItem["phase"];
  durationMinutes: number;
  responsibleRole: string;
};

export const momentLibrary: MomentPreset[] = [
  { durationMinutes: 90, id: "getting-ready", phase: "Ceremony Setup", responsibleRole: "Hair and make-up", title: "Getting ready" },
  { durationMinutes: 20, id: "first-look", phase: "Photography", responsibleRole: "Photographer", title: "First look" },
  { durationMinutes: 30, id: "guests-arrive", phase: "Guest Arrival", responsibleRole: "Ushers", title: "Guests arrive" },
  { durationMinutes: 5, id: "processional", phase: "Processional", responsibleRole: "Officiant", title: "Processional" },
  { durationMinutes: 10, id: "readings", phase: "Ceremony", responsibleRole: "Readers", title: "Readings" },
  { durationMinutes: 10, id: "vows", phase: "Ceremony", responsibleRole: "Officiant", title: "Vows" },
  { durationMinutes: 5, id: "rings", phase: "Ceremony", responsibleRole: "Best man", title: "Exchange of rings" },
  { durationMinutes: 5, id: "recessional", phase: "Recessional", responsibleRole: "Officiant", title: "Recessional" },
  { durationMinutes: 30, id: "group-photos", phase: "Photography", responsibleRole: "Photographer", title: "Group photographs" },
  { durationMinutes: 60, id: "welcome-drinks", phase: "Cocktail Hour", responsibleRole: "Catering", title: "Welcome drinks" },
  { durationMinutes: 15, id: "seating", phase: "Reception", responsibleRole: "Toastmaster", title: "Guests take their seats" },
  { durationMinutes: 40, id: "starter", phase: "Dinner Service", responsibleRole: "Catering", title: "Starter served" },
  { durationMinutes: 55, id: "main", phase: "Dinner Service", responsibleRole: "Catering", title: "Main course served" },
  { durationMinutes: 25, id: "speeches", phase: "Speeches", responsibleRole: "Toastmaster", title: "Speeches" },
  { durationMinutes: 15, id: "cake", phase: "Cake", responsibleRole: "Catering", title: "Cutting the cake" },
  { durationMinutes: 30, id: "dessert", phase: "Dinner Service", responsibleRole: "Catering", title: "Dessert served" },
  { durationMinutes: 5, id: "first-dance", phase: "First Dance", responsibleRole: "DJ", title: "First dance" },
  { durationMinutes: 120, id: "dancing", phase: "Party", responsibleRole: "DJ", title: "Dancing" },
  { durationMinutes: 20, id: "late-food", phase: "Party", responsibleRole: "Catering", title: "Late-night food" },
  { durationMinutes: 15, id: "send-off", phase: "Party", responsibleRole: "Toastmaster", title: "Send-off" }
];

// Groups in the order the day runs, using the SAME phase vocabulary the rest of
// the app already keys on (preview movements, reception detection, role briefs).
// An invented phase name here would silently drop a moment out of the Preview.
const LIBRARY_PHASE_ORDER = [
  "Ceremony Setup",
  "Photography",
  "Guest Arrival",
  "Processional",
  "Ceremony",
  "Recessional",
  "Cocktail Hour",
  "Reception",
  "Dinner Service",
  "Speeches",
  "Cake",
  "First Dance",
  "Party"
];

export function momentLibraryByPhase() {
  return LIBRARY_PHASE_ORDER.map((phase) => ({
    phase,
    presets: momentLibrary.filter((preset) => preset.phase === phase)
  })).filter((group) => group.presets.length > 0);
}

// The library in running order, timed as one continuous day. Adding presets one
// at a time gave every moment the same clock time, so a couple had to retype
// twenty times — which is why real timelines stayed at three entries and the
// Preview collapsed to three movements instead of walking the whole day.
//
// `ceremonyStart` anchors the day: everything before the processional is timed
// BACKWARD from it so getting ready and guest arrival land before the vows, and
// everything after runs forward. Times are conventions the couple then edits;
// nothing here claims to be a decision they made.
export function buildClassicDayTimeline(ceremonyStart: string): TimelineItem[] {
  const anchorIndex = momentLibrary.findIndex((preset) => preset.id === "processional");
  const anchorMinutes = parseTimeToMinutes(ceremonyStart) ?? 13 * 60 + 45;

  // Walk backward from the processional to place the run-up.
  const startMinutes: number[] = new Array(momentLibrary.length);
  let cursor = anchorMinutes;
  for (let index = anchorIndex; index >= 0; index -= 1) {
    if (index < anchorIndex) {
      cursor -= momentLibrary[index].durationMinutes;
    }
    startMinutes[index] = cursor;
  }

  // Then forward from the processional through the rest of the day.
  cursor = anchorMinutes;
  for (let index = anchorIndex + 1; index < momentLibrary.length; index += 1) {
    cursor += momentLibrary[index - 1].durationMinutes;
    startMinutes[index] = cursor;
  }

  return momentLibrary.map((preset, index) => ({
    durationMinutes: preset.durationMinutes,
    id: `moment-classic-${preset.id}`,
    location: "",
    notes: "",
    phase: preset.phase,
    responsiblePerson: "",
    responsibleRole: preset.responsibleRole,
    time: formatMinutesAsTime(startMinutes[index]),
    title: preset.title,
    visibility: "everyone"
  }));
}
