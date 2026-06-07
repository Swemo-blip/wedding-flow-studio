export type StudioVenueType = "church" | "garden" | "beach" | "hall";
export type StudioStyle = "classic" | "romantic" | "modern" | "rustic";
export type StudioBudgetLevel = "essential" | "elevated" | "signature";
export type StudioPlanningStepId = "venue" | "guests" | "ceremony" | "reception" | "details";
export type CapacityStatus = "intimate" | "balanced" | "full" | "over_capacity";
export type StudioSceneObjectId = "bar" | "ceremonyPath" | "danceFloor" | "dinnerTables" | "focalPoint" | "guestSeating" | "lighting";

export type StudioSceneOffset = {
  x: number;
  z: number;
};

export type StudioSceneEdits = Record<StudioSceneObjectId, StudioSceneOffset>;

export type WeddingStudioPlan = {
  guestCount: number;
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
  budgetLevel: "elevated",
  guestCount: 112,
  style: "classic",
  venueType: "church"
};

export const venueOptions: Array<{
  description: string;
  label: string;
  value: StudioVenueType;
}> = [
  {
    description: "A refined aisle, chapel rows, altar, and warm production lighting.",
    label: "Church",
    value: "church"
  },
  {
    description: "A refined outdoor ceremony with lawn, aisle, arch, and garden boundaries.",
    label: "Garden",
    value: "garden"
  },
  {
    description: "A coastal ceremony model with sand, waterline, aisle, and wind-aware spacing.",
    label: "Beach",
    value: "beach"
  },
  {
    description: "An indoor hall model for ceremony, reception, stage, and service flow.",
    label: "Hall",
    value: "hall"
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

export const budgetLevelOptions: Array<{
  label: string;
  value: StudioBudgetLevel;
}> = [
  { label: "Essential", value: "essential" },
  { label: "Elevated", value: "elevated" },
  { label: "Signature", value: "signature" }
];

export const planningSteps: Array<{
  id: StudioPlanningStepId;
  label: string;
}> = [
  {
    id: "venue",
    label: "Venue"
  },
  {
    id: "guests",
    label: "Guests"
  },
  {
    id: "ceremony",
    label: "Ceremony"
  },
  {
    id: "reception",
    label: "Reception"
  },
  {
    id: "details",
    label: "Details"
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
    caption: "Aisle, altar, rows, and guests are connected.",
    sceneTitle: "Ceremony Layout",
    summaryTitle: "Ceremony plan"
  },
  details: {
    caption: "Lighting and decor intensity follow the selected style level.",
    sceneTitle: "Details Layer",
    summaryTitle: "Detail plan"
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
  venue: {
    caption: "The room frame sets the planning envelope before details are added.",
    sceneTitle: "Venue Shell",
    summaryTitle: "Venue plan"
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
    details: ["lighting", "focalPoint", "guestSeating"],
    guests: ["guestSeating", "ceremonyPath", "focalPoint"],
    reception: ["dinnerTables", "danceFloor", "bar"],
    venue: ["focalPoint", "ceremonyPath", "guestSeating"]
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
  const venueLabel = venueOptions.find((option) => option.value === venueType)?.label ?? "venue";
  const labels: Record<CapacityStatus, string> = {
    balanced: `The ${venueLabel.toLowerCase()} model feels comfortably filled while keeping a clear aisle and guest flow.`,
    full: `The ${venueLabel.toLowerCase()} model is close to its comfortable limit. Keep arrival flow and reserved rows precise.`,
    intimate: `The ${venueLabel.toLowerCase()} model feels spacious and personal. Consider tightening the seating plan for a warmer atmosphere.`,
    over_capacity: `The guest count exceeds this ${venueLabel.toLowerCase()} model. Reduce guests or choose a larger venue layer.`
  };

  return labels[status];
}
