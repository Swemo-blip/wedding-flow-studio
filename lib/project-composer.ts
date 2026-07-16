import { dinnerTables, guests, musicCues, speeches, timelineItems } from "@/lib/wedding-data";
import type { DinnerTable, Guest, MusicCue, Speech, TimelineItem, Wedding } from "@/lib/wedding-types";

export type WeddingStylePreset = "editorial-garden" | "modern-city" | "coastal-weekend" | "classic-ballroom";
export type CeremonyFormat = "chapel" | "garden" | "civil" | "multicultural";
export type ReceptionFormat = "seated-dinner" | "cocktail-forward" | "dinner-and-dancing" | "weekend-estate";
export type ProductionComplexity = "calm" | "balanced" | "high-touch";

export type WeddingProducerIntake = {
  partnerOneName: string;
  partnerTwoName: string;
  date: string;
  ceremonyLocation: string;
  receptionLocation: string;
  guestCount: number;
  stylePreset: WeddingStylePreset;
  ceremonyFormat: CeremonyFormat;
  receptionFormat: ReceptionFormat;
  complexity: ProductionComplexity;
  vendorRoles: string[];
};

export type WeddingProducerPlan = {
  wedding: Wedding;
  timelineItems: TimelineItem[];
  musicCues: MusicCue[];
  speeches: Speech[];
  guests: Guest[];
  dinnerTables: DinnerTable[];
  producerNotes: string[];
  generatedRisks: string[];
};

export const defaultWeddingProducerIntake: WeddingProducerIntake = {
  ceremonyFormat: "chapel",
  ceremonyLocation: "St. James Chapel",
  complexity: "balanced",
  date: "June 14, 2027",
  guestCount: 112,
  partnerOneName: "Emma Carter",
  partnerTwoName: "James Bennett",
  receptionFormat: "dinner-and-dancing",
  receptionLocation: "Rosewood Hall",
  stylePreset: "editorial-garden",
  vendorRoles: ["Wedding Planner", "Toastmaster / MC", "Photographer", "DJ / Musician", "Catering", "Venue", "Officiant"]
};

export const stylePresetLabels: Record<WeddingStylePreset, string> = {
  "classic-ballroom": "Classic ballroom wedding",
  "coastal-weekend": "Coastal weekend wedding",
  "editorial-garden": "Editorial garden wedding",
  "modern-city": "Modern city wedding"
};

export const ceremonyFormatLabels: Record<CeremonyFormat, string> = {
  chapel: "Chapel ceremony",
  civil: "Civil ceremony",
  garden: "Garden ceremony",
  multicultural: "Multicultural ceremony"
};

export const receptionFormatLabels: Record<ReceptionFormat, string> = {
  "cocktail-forward": "Cocktail-forward reception",
  "dinner-and-dancing": "Dinner and dancing",
  "seated-dinner": "Seated dinner",
  "weekend-estate": "Weekend estate celebration"
};

export const complexityLabels: Record<ProductionComplexity, string> = {
  balanced: "Balanced production",
  calm: "Calm and simple",
  "high-touch": "High-touch production"
};

export const availableVendorRoles = [
  "Wedding Planner",
  "Toastmaster / MC",
  "Photographer",
  "DJ / Musician",
  "Catering",
  "Venue",
  "Officiant",
  "Videographer",
  "Florist"
];

export function composeWeddingProducerPlan(input: WeddingProducerIntake): WeddingProducerPlan {
  const partnerOneName = normalizeName(input.partnerOneName, "Partner One");
  const partnerTwoName = normalizeName(input.partnerTwoName, "Partner Two");
  const coupleNames = `${getFirstName(partnerOneName)} & ${getFirstName(partnerTwoName)}`;
  const ceremonyLocation = input.ceremonyLocation.trim() || defaultWeddingProducerIntake.ceremonyLocation;
  const receptionLocation = input.receptionLocation.trim() || defaultWeddingProducerIntake.receptionLocation;
  const guestCount = clampGuestCount(input.guestCount);
  const wedding: Wedding = {
    ceremonyLocation,
    coupleNames,
    date: input.date.trim() || defaultWeddingProducerIntake.date,
    guestCount,
    id: slugify(`${coupleNames}-${input.date || "wedding"}`),
    partnerOneName,
    partnerTwoName,
    plannerName: input.vendorRoles.includes("Wedding Planner") ? "Wedding Planner" : "Planning Lead",
    receptionLocation,
    status: "Digital twin generated from Wedding Producer Intake",
    style: `${stylePresetLabels[input.stylePreset]}, ${ceremonyFormatLabels[input.ceremonyFormat]}, ${receptionFormatLabels[input.receptionFormat]}`
  };
  const timeline = composeTimeline(input, wedding);
  const cues = composeMusicCues(input, timeline);
  const program = composeSpeeches(input, timeline, partnerOneName, partnerTwoName);
  const composedTables = composeDinnerTables(guestCount);
  const composedGuests = composeGuests(partnerOneName, partnerTwoName);
  const assignedTables = assignGuestsToTables(composedTables, composedGuests);

  return {
    dinnerTables: assignedTables,
    generatedRisks: buildGeneratedRisks(input, guestCount),
    guests: composedGuests,
    musicCues: cues,
    producerNotes: buildProducerNotes(input, wedding),
    speeches: program,
    timelineItems: timeline,
    wedding
  };
}

function composeTimeline(input: WeddingProducerIntake, wedding: Wedding): TimelineItem[] {
  const ceremonyDescriptor = ceremonyFormatLabels[input.ceremonyFormat].replace(" ceremony", "");
  const receptionDescriptor = receptionFormatLabels[input.receptionFormat].toLowerCase();

  return timelineItems.map((item) => {
    const isCeremony = item.location.includes("Chapel") || item.phase.includes("Ceremony") || item.phase.includes("Processional") || item.phase.includes("Recessional");
    const isReception = item.location.includes("Hall") || item.location.includes("Ballroom") || item.phase.includes("Reception") || item.phase.includes("Dinner") || item.phase.includes("Cake") || item.phase.includes("Party") || item.phase.includes("First Dance");
    const isPhotos = item.phase.includes("Photography");

    return {
      ...item,
      durationMinutes: item.id === "group-photos" ? getPhotoDuration(input, wedding.guestCount) : item.durationMinutes,
      location: isCeremony
        ? item.location.replace("St. James Chapel", wedding.ceremonyLocation).replace("Ballroom", `${wedding.receptionLocation} ballroom`)
        : isReception
          ? item.location.replace("Rosewood Hall", wedding.receptionLocation).replace("Ballroom", `${wedding.receptionLocation} ballroom`)
          : isPhotos
            ? `${wedding.ceremonyLocation} portrait location`
            : item.location,
      notes: `${item.notes} Producer Intake: ${ceremonyDescriptor} ceremony with ${receptionDescriptor}; ${input.complexity === "high-touch" ? "protect detailed role cues" : "keep handoffs calm and clear"}.`
    };
  });
}

function composeMusicCues(input: WeddingProducerIntake, timeline: TimelineItem[]): MusicCue[] {
  return musicCues.map((cue) => {
    const needsMorePrecision = input.complexity !== "calm" && (cue.id === "music-first-dance" || cue.id === "music-recessional");

    return {
      ...cue,
      backupPlan: cue.backupPlan === "Missing" && input.vendorRoles.includes("DJ / Musician") ? "DJ local file and offline playlist" : cue.backupPlan,
      notes: `${cue.notes} Producer Intake: ${input.vendorRoles.includes("DJ / Musician") ? "Music owner included in generated brief." : "Assign a music owner before final cue sheet."}`,
      status: needsMorePrecision ? cue.status : cue.status === "needs-backup" ? "needs-confirmation" : cue.status,
      timelineItemId: timeline.find((item) => item.id === cue.timelineItemId)?.id ?? cue.timelineItemId
    };
  });
}

function composeSpeeches(
  input: WeddingProducerIntake,
  timeline: TimelineItem[],
  partnerOneName: string,
  partnerTwoName: string
): Speech[] {
  const speechLimit = input.complexity === "calm" ? 4 : input.complexity === "high-touch" ? 6 : 5;

  return speeches.slice(0, speechLimit).map((speech) => ({
    ...speech,
    notes: `${speech.notes} Producer Intake: Keep this program item aligned with ${receptionFormatLabels[input.receptionFormat].toLowerCase()}.`,
    // Keep the program skeleton (title + relation), but never invent a real
    // person: the couple's own toast fills in, everyone else is "TBD" for them
    // to name.
    speakerName:
      speech.speakerName === "Emma & James" ? `${getFirstName(partnerOneName)} & ${getFirstName(partnerTwoName)}` : "TBD",
    introPerson: speech.introPerson && speech.introPerson !== "None" ? "TBD" : speech.introPerson,
    timelineItemId: timeline.find((item) => item.id === speech.timelineItemId)?.id ?? speech.timelineItemId
  }));
}

function composeDinnerTables(guestCount: number): DinnerTable[] {
  const guestTableCount = Math.max(4, Math.min(14, Math.ceil(Math.max(guestCount - 2, 0) / 10)));
  const baseGuestTables = dinnerTables.filter((table) => table.id !== "sweetheart-table");
  const generatedTables = Array.from({ length: guestTableCount }, (_, index) => {
    const base = baseGuestTables[index % baseGuestTables.length];
    const column = index % 4;
    const row = Math.floor(index / 4);

    return {
      ...base,
      assignedGuestIds: [],
      id: `generated-table-${index + 1}`,
      name: `Table ${index + 1} - ${getTableType(index)}`,
      position: {
        x: 20 + column * 22,
        y: 38 + row * 20
      },
      type: getTableType(index)
    };
  });

  return [
    {
      ...dinnerTables[0],
      assignedGuestIds: ["partner-one", "partner-two"]
    },
    ...generatedTables
  ];
}

function composeGuests(partnerOneName: string, partnerTwoName: string): Guest[] {
  // Seed ONLY the couple — never a crowd of fictional guests. A new couple must
  // see their own plan (with an "add your first guest" empty state on /guests),
  // not a stranger's wedding they never entered.
  return [
    {
      ...guests[0],
      id: "partner-one",
      name: partnerOneName,
      relationship: "Couple",
      preferredGuestIds: [],
      conflictGuestIds: [],
      tableId: "sweetheart-table",
      seatIndex: 0
    },
    {
      ...guests[1],
      id: "partner-two",
      name: partnerTwoName,
      relationship: "Couple",
      preferredGuestIds: [],
      conflictGuestIds: [],
      tableId: "sweetheart-table",
      seatIndex: 1
    }
  ];
}

function assignGuestsToTables(tables: DinnerTable[], guestItems: Guest[]) {
  return tables.map((table) => ({
    ...table,
    assignedGuestIds: guestItems
      .filter((guest) => guest.tableId === table.id)
      .sort((left, right) => left.seatIndex - right.seatIndex)
      .map((guest) => guest.id)
  }));
}

function buildProducerNotes(input: WeddingProducerIntake, wedding: Wedding) {
  return [
    `${wedding.coupleNames} starts with a ${stylePresetLabels[input.stylePreset].toLowerCase()} production map.`,
    `${wedding.guestCount} guests means the first digital twin should protect guest flow, meal notes, and photo timing.`,
    `${input.vendorRoles.length} roles are included in the first Director Mode handoff.`
  ];
}

function buildGeneratedRisks(input: WeddingProducerIntake, guestCount: number) {
  const risks = new Set<string>();

  if (guestCount > 90) {
    risks.add("Group photos may need a larger timing buffer.");
  }

  if (!input.vendorRoles.includes("DJ / Musician")) {
    risks.add("Music cues need a named owner.");
  }

  if (!input.vendorRoles.includes("Wedding Planner")) {
    risks.add("Assign one production lead before final rehearsal.");
  }

  if (input.complexity === "high-touch") {
    risks.add("Secret layers and vendor handoffs need rehearsal before export.");
  }

  return Array.from(risks);
}

function getPhotoDuration(input: WeddingProducerIntake, guestCount: number) {
  if (input.complexity === "high-touch" || guestCount > 120) {
    return 40;
  }

  if (guestCount > 80) {
    return 35;
  }

  return 25;
}

function getTableType(index: number) {
  const types = ["Family", "Friends", "Wedding Party", "International Guests", "Children and Family", "Colleagues"];

  return types[index % types.length];
}

function normalizeName(value: string, fallback: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : fallback;
}

function getFirstName(value: string) {
  return value.trim().split(/\s+/)[0] ?? value;
}

function clampGuestCount(value: number) {
  return Math.max(2, Math.min(300, Math.round(value || defaultWeddingProducerIntake.guestCount)));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "generated-wedding";
}
