import type { Wedding } from "@/lib/wedding-types";

export type StudioVenueType = "church" | "garden" | "beach" | "hall";
export type StudioStyle = "classic" | "romantic" | "modern" | "rustic";
export type StudioBudgetLevel = "essential" | "elevated" | "signature";
export type StudioDecorLevel = "simple" | "balanced" | "elevated" | "statement";
export type StudioColorDirection = "neutral" | "blush" | "green" | "warm" | "blue" | "bold";
export type StudioPlanningStepId =
  | "vision"
  | "venue"
  | "guests"
  | "ceremony"
  | "reception"
  | "timeline"
  | "budget"
  | "preview"
  | "share";
export type StudioViewMode = "3d" | "top" | "guest" | "walkthrough";
export type CapacityStatus = "intimate" | "balanced" | "full" | "over_capacity";
export type StudioSceneObjectId = "bar" | "ceremonyPath" | "danceFloor" | "dinnerTables" | "focalPoint" | "guestSeating" | "lighting";

export type StudioSceneOffset = {
  x: number;
  z: number;
};

export type StudioSceneEdits = Record<StudioSceneObjectId, StudioSceneOffset>;

export type WeddingStudioPlan = {
  accessibilitySeats: number;
  aisleWidthFeet: number;
  colorDirection: StudioColorDirection;
  decorLevel: StudioDecorLevel;
  guestCount: number;
  seatingLayout: string;
  venueType: StudioVenueType;
  style: StudioStyle;
  budgetLevel: StudioBudgetLevel;
};

export type WeddingStudioCapacity = {
  aisleSeatsPerRow: number;
  capacityStatus: CapacityStatus;
  capacityLabel: string;
  comfortLabel: string;
  maxComfortableRows: number;
  overflowGuests: number;
  recommendedRows: number;
  renderedRows: number;
  seatsPerRow: number;
  totalCapacity: number;
  usedCapacityPercent: number;
  visibleGuestMarkers: number;
};

export const defaultWeddingStudioPlan: WeddingStudioPlan = {
  accessibilitySeats: 2,
  aisleWidthFeet: 5,
  budgetLevel: "elevated",
  colorDirection: "neutral",
  decorLevel: "balanced",
  guestCount: 112,
  seatingLayout: "Traditional",
  style: "classic",
  venueType: "church"
};

export const seatingLayoutOptions = ["Traditional", "Semi-circle", "Curved rows", "Spaced rows"];
export const MIN_AISLE_WIDTH_FEET = 3;
export const MAX_AISLE_WIDTH_FEET = 10;

// The product has exactly two scenes — the church ceremony and the indoor
// dinner hall. The ceremony venue is always the church, so this list holds one
// entry; legacy stored plans on removed venues coerce to it via the storage
// whitelist.
export const venueOptions: Array<{
  description: string;
  label: string;
  value: StudioVenueType;
}> = [
  {
    description: "A refined aisle, chapel rows, altar, and warm production lighting.",
    label: "Church",
    value: "church"
  }
];

export const styleOptions: Array<{
  label: string;
  value: StudioStyle;
}> = [
  { label: "Classic", value: "classic" },
  { label: "Romantic", value: "romantic" },
  { label: "Modern", value: "modern" },
  { label: "Rustic", value: "rustic" }
];

export const decorLevelOptions: Array<{
  label: string;
  value: StudioDecorLevel;
}> = [
  { label: "Simple", value: "simple" },
  { label: "Balanced", value: "balanced" },
  { label: "Elevated", value: "elevated" },
  { label: "Statement", value: "statement" }
];

export const colorDirectionOptions: Array<{
  label: string;
  value: StudioColorDirection;
}> = [
  { label: "Neutral", value: "neutral" },
  { label: "Blush", value: "blush" },
  { label: "Green", value: "green" },
  { label: "Warm", value: "warm" },
  { label: "Blue", value: "blue" },
  { label: "Bold", value: "bold" }
];

export const budgetLevelOptions: Array<{
  label: string;
  value: StudioBudgetLevel;
}> = [
  { label: "Essential", value: "essential" },
  { label: "Elevated", value: "elevated" },
  { label: "Signature", value: "signature" }
];

export const planningSteps: Array<{
  description: string;
  id: StudioPlanningStepId;
  label: string;
  state: "complete" | "current" | "needs_attention" | "optional";
}> = [
  {
    description: "Mood, priorities, formality, and first direction.",
    id: "vision",
    label: "Vision",
    state: "complete"
  },
  {
    description: "Choose the venue model that shapes the plan.",
    id: "venue",
    label: "Venue",
    state: "complete"
  },
  {
    description: "Guest count, comfort, and accessibility needs.",
    id: "guests",
    label: "Guests",
    state: "complete"
  },
  {
    description: "Aisle, focal area, seating zones, and flow.",
    id: "ceremony",
    label: "Ceremony",
    state: "current"
  },
  {
    description: "Dinner layout, tables, dance floor, and service path.",
    id: "reception",
    label: "Reception",
    state: "needs_attention"
  },
  {
    description: "Moments, gaps, and vendor handoffs.",
    id: "timeline",
    label: "Timeline",
    state: "needs_attention"
  },
  {
    description: "Priority level, tradeoffs, and spend direction.",
    id: "budget",
    label: "Budget",
    state: "optional"
  },
  {
    description: "See the day from 3D, top, guest, or walkthrough view.",
    id: "preview",
    label: "Preview",
    state: "optional"
  },
  {
    description: "Shareable summary, vendor briefs, and exports.",
    id: "share",
    label: "Share",
    state: "optional"
  }
];

export const studioStepCopy: Record<
  StudioPlanningStepId,
  {
    caption: string;
    sceneTitle: string;
    summaryTitle: string;
  }
> = {
  ceremony: {
    caption: "Aisle, focal area, rows, and guests stay connected.",
    sceneTitle: "Ceremony Layout",
    summaryTitle: "Ceremony plan"
  },
  budget: {
    caption: "Priority level changes the plan without adding clutter.",
    sceneTitle: "Budget Impact",
    summaryTitle: "Budget plan"
  },
  guests: {
    caption: "Guest markers show how full the space feels.",
    sceneTitle: "Guest Density",
    summaryTitle: "Guest plan"
  },
  reception: {
    caption: "Tables, dance floor, bar, and service flow are staged in 3D.",
    sceneTitle: "Reception Preview",
    summaryTitle: "Reception plan"
  },
  preview: {
    caption: "Switch perspective and preview how the day feels.",
    sceneTitle: "Preview Mode",
    summaryTitle: "Preview plan"
  },
  share: {
    caption: "Turn the visual plan into a clear planning summary.",
    sceneTitle: "Share Plan",
    summaryTitle: "Share plan"
  },
  timeline: {
    caption: "Moments and handoffs connect back to the visual plan.",
    sceneTitle: "Day Flow",
    summaryTitle: "Timeline plan"
  },
  venue: {
    caption: "The room frame sets the planning envelope before details are added.",
    sceneTitle: "Venue Shell",
    summaryTitle: "Venue plan"
  },
  vision: {
    caption: "Start with style, mood, and a useful first plan.",
    sceneTitle: "First Visual Plan",
    summaryTitle: "Vision plan"
  }
};

export const defaultStudioSceneEdits: StudioSceneEdits = {
  bar: { x: 0, z: 0 },
  ceremonyPath: { x: 0, z: 0 },
  danceFloor: { x: 0, z: 0 },
  dinnerTables: { x: 0, z: 0 },
  focalPoint: { x: 0, z: 0 },
  guestSeating: { x: 0, z: 0 },
  lighting: { x: 0, z: 0 }
};

export const studioEditableObjects: Record<
  StudioSceneObjectId,
  {
    label: string;
    shortLabel: string;
  }
> = {
  bar: {
    label: "Bar",
    shortLabel: "Bar"
  },
  ceremonyPath: {
    label: "Aisle",
    shortLabel: "Aisle"
  },
  danceFloor: {
    label: "Dance floor",
    shortLabel: "Dance"
  },
  dinnerTables: {
    label: "Dinner tables",
    shortLabel: "Tables"
  },
  focalPoint: {
    label: "Focal point",
    shortLabel: "Focus"
  },
  guestSeating: {
    label: "Guest seating",
    shortLabel: "Seats"
  },
  lighting: {
    label: "Lighting",
    shortLabel: "Light"
  }
};

export function getEditableObjectsForStep(activeStep: StudioPlanningStepId): StudioSceneObjectId[] {
  const objects: Record<StudioPlanningStepId, StudioSceneObjectId[]> = {
    ceremony: ["focalPoint", "ceremonyPath", "guestSeating"],
    budget: ["guestSeating", "ceremonyPath", "focalPoint"],
    guests: ["guestSeating", "ceremonyPath", "focalPoint"],
    preview: ["guestSeating", "ceremonyPath", "focalPoint"],
    reception: ["dinnerTables", "danceFloor", "bar"],
    share: ["guestSeating", "ceremonyPath", "focalPoint"],
    timeline: ["ceremonyPath", "guestSeating", "focalPoint"],
    venue: ["focalPoint", "ceremonyPath", "guestSeating"],
    vision: ["focalPoint", "ceremonyPath", "guestSeating"]
  };

  return objects[activeStep];
}

export function clampSceneOffset(value: number) {
  return Math.max(-1.8, Math.min(1.8, Number(value.toFixed(2))));
}

export function calculateWeddingStudioCapacity(plan: WeddingStudioPlan): WeddingStudioCapacity {
  const venueCapacity = getVenueCapacityModel(plan.venueType);
  const seatsPerRow = venueCapacity.seatsPerRow;
  const aisleSeatsPerRow = Math.floor(seatsPerRow / 2);
  const maxComfortableRows = venueCapacity.maxComfortableRows;
  const totalCapacity = seatsPerRow * maxComfortableRows;
  const recommendedRows = Math.max(4, Math.ceil(plan.guestCount / seatsPerRow));
  const renderedRows = Math.min(maxComfortableRows, recommendedRows);
  const visibleGuestMarkers = Math.min(plan.guestCount, renderedRows * seatsPerRow);
  const overflowGuests = Math.max(0, plan.guestCount - totalCapacity);
  const usedCapacityPercent = Math.min(140, Math.round((plan.guestCount / totalCapacity) * 100));
  const capacityStatus = getCapacityStatus(plan.guestCount);

  return {
    aisleSeatsPerRow,
    capacityStatus,
    capacityLabel: getCapacityLabel(capacityStatus),
    comfortLabel: getComfortLabel(capacityStatus, plan.venueType),
    maxComfortableRows,
    overflowGuests,
    recommendedRows,
    renderedRows,
    seatsPerRow,
    totalCapacity,
    usedCapacityPercent,
    visibleGuestMarkers
  };
}

export function clampGuestCount(value: number) {
  return Math.min(180, Math.max(10, Math.round(value)));
}

export function clampAccessibilitySeats(value: number) {
  return Math.min(24, Math.max(0, Math.round(value)));
}

export function mapDecorLevelToBudget(decorLevel: StudioDecorLevel): StudioBudgetLevel {
  const levels: Record<StudioDecorLevel, StudioBudgetLevel> = {
    balanced: "elevated",
    elevated: "signature",
    simple: "essential",
    statement: "signature"
  };

  return levels[decorLevel];
}

export function createWeddingStudioPlanFromWedding(wedding: Wedding, basePlan: WeddingStudioPlan = defaultWeddingStudioPlan): WeddingStudioPlan {
  return {
    ...basePlan,
    budgetLevel: getBudgetLevelFromWedding(wedding, basePlan.budgetLevel),
    colorDirection: getColorDirectionFromWedding(wedding, basePlan.colorDirection),
    decorLevel: getDecorLevelFromWedding(wedding, basePlan.decorLevel),
    guestCount: clampGuestCount(wedding.guestCount),
    style: getStyleFromWedding(wedding, basePlan.style),
    venueType: getVenueTypeFromWedding(wedding, basePlan.venueType)
  };
}

function getVenueTypeFromWedding(wedding: Wedding, fallback: StudioVenueType): StudioVenueType {
  // The product renders exactly two scenes — the church ceremony and the
  // indoor dinner hall — so the ceremony venue is always the church. (Signature
  // kept so callers and the fallback contract stay unchanged.)
  void wedding;
  void fallback;
  return "church";
}

function getStyleFromWedding(wedding: Wedding, fallback: StudioStyle): StudioStyle {
  const source = wedding.style.toLowerCase();

  if (source.includes("modern") || source.includes("city")) {
    return "modern";
  }

  if (source.includes("rustic") || source.includes("barn")) {
    return "rustic";
  }

  if (source.includes("garden") || source.includes("romantic") || source.includes("coastal")) {
    return "romantic";
  }

  if (source.includes("classic") || source.includes("ballroom") || source.includes("chapel")) {
    return "classic";
  }

  return fallback;
}

function getColorDirectionFromWedding(wedding: Wedding, fallback: StudioColorDirection): StudioColorDirection {
  const source = wedding.style.toLowerCase();

  if (source.includes("coastal")) {
    return "blue";
  }

  if (source.includes("garden")) {
    return "green";
  }

  if (source.includes("romantic")) {
    return "blush";
  }

  if (source.includes("ballroom") || source.includes("classic")) {
    return "warm";
  }

  if (source.includes("modern")) {
    return "neutral";
  }

  return fallback;
}

function getDecorLevelFromWedding(wedding: Wedding, fallback: StudioDecorLevel): StudioDecorLevel {
  const source = wedding.style.toLowerCase();

  if (source.includes("high-touch") || source.includes("signature") || source.includes("luxury")) {
    return "statement";
  }

  if (source.includes("editorial") || source.includes("ballroom") || source.includes("weekend")) {
    return "elevated";
  }

  if (source.includes("calm") || source.includes("simple")) {
    return "simple";
  }

  return fallback;
}

function getBudgetLevelFromWedding(wedding: Wedding, fallback: StudioBudgetLevel): StudioBudgetLevel {
  const source = wedding.style.toLowerCase();

  if (source.includes("high-touch") || source.includes("signature") || source.includes("luxury")) {
    return "signature";
  }

  if (source.includes("calm") || source.includes("simple")) {
    return "essential";
  }

  return fallback;
}

function getCapacityStatus(guestCount: number): CapacityStatus {
  if (guestCount <= 40) {
    return "intimate";
  }

  if (guestCount <= 100) {
    return "balanced";
  }

  if (guestCount <= 140) {
    return "full";
  }

  return "over_capacity";
}

function getCapacityLabel(status: CapacityStatus) {
  const labels: Record<CapacityStatus, string> = {
    balanced: "Balanced layout",
    full: "Full ceremony",
    intimate: "Intimate ceremony",
    over_capacity: "Over capacity"
  };

  return labels[status];
}

function getVenueCapacityModel(venueType: StudioVenueType) {
  const models: Record<
    StudioVenueType,
    {
      maxComfortableRows: number;
      seatsPerRow: number;
    }
  > = {
    beach: {
      maxComfortableRows: 12,
      seatsPerRow: 8
    },
    church: {
      maxComfortableRows: 14,
      seatsPerRow: 10
    },
    garden: {
      maxComfortableRows: 13,
      seatsPerRow: 8
    },
    hall: {
      maxComfortableRows: 12,
      seatsPerRow: 12
    }
  };

  return models[venueType];
}

function getComfortLabel(status: CapacityStatus, venueType: StudioVenueType) {
  // Local labels — venueOptions only lists the choosable venue (church), but
  // capacity copy must name every engine venue, including the dinner hall.
  const venueLabels: Record<StudioVenueType, string> = {
    beach: "beach",
    church: "church",
    garden: "garden",
    hall: "dinner room"
  };
  const venueLabel = venueLabels[venueType] ?? "venue";
  const labels: Record<CapacityStatus, string> = {
    balanced: `The ${venueLabel.toLowerCase()} model feels comfortably filled while keeping a clear aisle and guest flow.`,
    full: `The ${venueLabel.toLowerCase()} model is close to its comfortable limit. Keep arrival flow and reserved rows precise.`,
    intimate: `The ${venueLabel.toLowerCase()} model feels spacious and personal. Consider tightening the seating plan for a warmer atmosphere.`,
    over_capacity: `The guest count exceeds this ${venueLabel.toLowerCase()} model. Reduce guests or choose a larger venue layer.`
  };

  return labels[status];
}
