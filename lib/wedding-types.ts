export type Visibility =
  | "everyone"
  | "couple"
  | "partnerOne"
  | "partnerTwo"
  | "toastmaster"
  | "planner"
  | "vendor"
  | "secret";

export type RiskSeverity = "low" | "medium" | "high";

export type MusicCueStatus = "confirmed" | "needs-confirmation" | "needs-backup" | "needs-cue";

export type Wedding = {
  id: string;
  coupleNames: string;
  partnerOneName: string;
  partnerTwoName: string;
  date: string;
  ceremonyLocation: string;
  receptionLocation: string;
  guestCount: number;
  style: string;
  plannerName: string;
  status: string;
};

export type Guest = {
  id: string;
  name: string;
  household: string;
  rsvpStatus: "attending" | "declined" | "pending";
  mealChoice: string;
  allergies: string[];
  tags: string[];
  relationship: string;
  accessibilityNotes: string;
  conflictGuestIds: string[];
  preferredGuestIds: string[];
  language: string;
  tableId: string;
  seatIndex: number;
};

export type TimelineItem = {
  id: string;
  time: string;
  title: string;
  phase: string;
  location: string;
  responsibleRole: string;
  responsiblePerson: string;
  notes: string;
  musicCueId?: string;
  speechId?: string;
  visibility: Visibility;
  riskLevel?: RiskSeverity;
  durationMinutes?: number;
};

export type VenueObject = {
  id: string;
  label: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  notes?: string;
};

export type VenueLayout = {
  id: string;
  type: string;
  name: string;
  capacity: number;
  objects: VenueObject[];
};

export type CeremonyLayout = {
  id: string;
  name: string;
  rows: number;
  seatsPerSidePerRow: number;
  reservedFrontRows: number;
  aisleType: string;
  guestCount: number;
  musicians: string[];
  photographerPositions: string[];
  officiantName: string;
};

export type DinnerTable = {
  id: string;
  name: string;
  type: string;
  shape: "round" | "rectangle" | "sweetheart";
  capacity: number;
  position: {
    x: number;
    y: number;
  };
  assignedGuestIds: string[];
};

export type SeatAssignment = {
  guestId: string;
  tableId: string;
  seatIndex: number;
};

export type MusicCue = {
  id: string;
  moment: string;
  songTitle: string;
  artist: string;
  responsiblePerson: string;
  link: string;
  startCue: string;
  backupPlan: string;
  status: MusicCueStatus;
  notes: string;
  timelineItemId: string;
};

export type Speech = {
  id: string;
  title: string;
  speakerName: string;
  relation: string;
  durationMinutes: number;
  timing: string;
  visibility: Visibility;
  isSecret: boolean;
  technicalNeeds: string[];
  introPerson: string;
  notes: string;
  timelineItemId: string;
};

export type RoleBrief = {
  role: string;
  title: string;
  description: string;
  relevantTimelineItemIds: string[];
  relevantWarningIds: string[];
  checklistItems: string[];
  contactPerson: string;
  currentPriority?: string;
  nextUp?: string;
  keyContacts?: string[];
};

export type RoleReadiness = "ready" | "attention" | "critical";

export type RoleProductionItem = {
  id: string;
  time: string;
  title: string;
  phase: string;
  location: string;
  owner: string;
  cue: string;
  note: string;
  isSecret: boolean;
  hasWarning: boolean;
};

export type RoleHandoff = {
  id: string;
  label: string;
  from: string;
  to: string;
  timing: string;
  detail: string;
  severity: RiskSeverity | "clear";
};

export type RoleProductionBoard = {
  role: string;
  title: string;
  description: string;
  readiness: RoleReadiness;
  readinessLabel: string;
  currentPhase: string;
  nextUp: string;
  readyToBrief: boolean;
  timeline: RoleProductionItem[];
  handoffs: RoleHandoff[];
  warnings: RiskItem[];
  checklistItems: string[];
  contacts: string[];
  copyText: string;
};

export type RiskItem = {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  // Optional localizable form of `description`: a template with {placeholders}
  // plus its params. `description` stays the resolved English string so every
  // other consumer keeps working; display surfaces translate via the template.
  descriptionKey?: string;
  descriptionParams?: Record<string, string | number>;
  relatedEntityType: string;
  relatedEntityId: string;
  suggestedFix: string;
};

export type PreviewPhase = {
  id: string;
  title: string;
  timeRange: string;
  location: string;
  summary: string;
  involvedPeople: string[];
  responsibleRole: string;
  responsiblePerson: string;
  musicCueId?: string;
  riskId?: string;
  relatedTimelineItemIds: string[];
};

export type ExportType = {
  id: string;
  title: string;
  description: string;
  contactPerson: string;
  timelineItemIds: string[];
  warningIds: string[];
};

export type SourcingPriority = "required" | "recommended" | "optional";

export type SourcingLocationType = "ceremony" | "reception" | "either";

export type VendorCandidateStatus = "shortlisted" | "contacted" | "quote-requested" | "booked" | "rejected";

export type VendorPriceTier = "unknown" | "budget" | "standard" | "premium" | "luxury";

export type VendorSourcingCategory = {
  id: string;
  label: string;
  role: string;
  description: string;
  priority: SourcingPriority;
  locationType: SourcingLocationType;
  searchTerms: string[];
  neededFor: string[];
  checklist: string[];
  timelineItemIds: string[];
};

export type VendorSearchSuggestion = {
  id: string;
  categoryId: string;
  label: string;
  query: string;
  locationLabel: string;
  mapsUrl: string;
  webUrl: string;
  reason: string;
  priority: SourcingPriority;
  checklist: string[];
  timelineItemIds: string[];
};

export type VendorCandidate = {
  id: string;
  categoryId: string;
  name: string;
  locationLabel: string;
  sourceQuery: string;
  mapsUrl: string;
  webUrl: string;
  status: VendorCandidateStatus;
  priceTier: VendorPriceTier;
  fitScore: number;
  contactPerson: string;
  contactUrl: string;
  notes: string;
  connectedTimelineItemIds: string[];
  createdAt: string;
  updatedAt: string;
};
