import { dinnerTables, guests, musicCues, sampleWedding, speeches, timelineItems } from "@/lib/wedding-data";
import { safeSetItem } from "@/lib/persistence-status";
import type { DinnerTable, Guest, MusicCue, Speech, TimelineItem, VendorCandidate, Wedding } from "@/lib/wedding-types";

export const projectStorageKey = "wedding-flow-studio.project.v1";
export const timelineStorageKey = "wedding-flow-studio.timeline.v1";
export const riskResolutionStorageKey = "wedding-flow-studio.risk-resolutions.v1";
export const corruptProjectStorageKey = "wedding-flow-studio.project.corrupt.v1";

export type StoredTimelineProject = {
  updatedAt: string;
  timelineItems: TimelineItem[];
};

export type StoredWeddingProject = {
  updatedAt: string;
  wedding: Wedding;
  timelineItems: TimelineItem[];
  musicCues: MusicCue[];
  speeches: Speech[];
  guests: Guest[];
  dinnerTables: DinnerTable[];
  vendorCandidates: VendorCandidate[];
  riskResolutions: StoredRiskResolution[];
};

export type StoredRiskResolution = {
  riskId: string;
  resolvedAt: string;
};

export function createTimelineDraft(items: TimelineItem[]) {
  return items.map((item) => ({ ...item }));
}

export function createMusicCueDraft(items: MusicCue[]) {
  return items.map((item) => ({ ...item }));
}

export function createSpeechDraft(items: Speech[]) {
  return items.map((item) => ({
    ...item,
    technicalNeeds: [...item.technicalNeeds]
  }));
}

export function createGuestDraft(items: Guest[]) {
  return items.map((item) => ({
    ...item,
    allergies: [...item.allergies],
    tags: [...item.tags],
    conflictGuestIds: [...item.conflictGuestIds],
    preferredGuestIds: [...item.preferredGuestIds]
  }));
}

export function createDinnerTableDraft(items: DinnerTable[]) {
  return items.map((item) => ({
    ...item,
    position: { ...item.position },
    assignedGuestIds: [...item.assignedGuestIds]
  }));
}

export function createVendorCandidateDraft(items: VendorCandidate[]) {
  return items.map((item) => ({
    ...item,
    quote: typeof item.quote === "number" ? item.quote : 0,
    connectedTimelineItemIds: [...item.connectedTimelineItemIds]
  }));
}

export function createStoredProjectDraft(source: Partial<StoredWeddingProject> = {}): StoredWeddingProject {
  return {
    updatedAt: source.updatedAt ?? new Date().toISOString(),
    wedding: source.wedding ?? sampleWedding,
    timelineItems: createTimelineDraft(source.timelineItems ?? timelineItems),
    musicCues: createMusicCueDraft(source.musicCues ?? musicCues),
    speeches: createSpeechDraft(source.speeches ?? speeches),
    guests: createGuestDraft(source.guests ?? guests),
    dinnerTables: createDinnerTableDraft(source.dinnerTables ?? dinnerTables),
    vendorCandidates: createVendorCandidateDraft(source.vendorCandidates ?? []),
    riskResolutions: [...(source.riskResolutions ?? [])]
  };
}

export function readStoredProject() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(projectStorageKey);
  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredWeddingProject>;
      if (isTimelineArray(parsed.timelineItems) && isMusicCueArray(parsed.musicCues)) {
        return createStoredProjectDraft({
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
          wedding: isWedding(parsed.wedding) ? parsed.wedding : sampleWedding,
          timelineItems: parsed.timelineItems,
          musicCues: parsed.musicCues,
          speeches: isSpeechArray(parsed.speeches) ? parsed.speeches : speeches,
          guests: isGuestArray(parsed.guests) ? parsed.guests : guests,
          dinnerTables: isDinnerTableArray(parsed.dinnerTables) ? parsed.dinnerTables : dinnerTables,
          vendorCandidates: isVendorCandidateArray(parsed.vendorCandidates) ? parsed.vendorCandidates : [],
          riskResolutions: isRiskResolutionArray(parsed.riskResolutions) ? parsed.riskResolutions : []
        });
      }
    } catch {
      // Don't silently fall back to sample data (which the next edit would then
      // persist over the real blob) — stash the unreadable value under a
      // recovery key so it isn't lost, then give up on this read.
      try {
        window.localStorage.setItem(corruptProjectStorageKey, rawValue);
      } catch {
        // best effort — nothing more we can do if storage is also full
      }
      return null;
    }
  }

  const timeline = readStoredTimelineFromLegacyKey()?.timelineItems;
  const resolutions = readStoredRiskResolutionsFromLegacyKey();

  if (timeline || resolutions.length > 0) {
    return createStoredProjectDraft({
      timelineItems: timeline,
      riskResolutions: resolutions
    });
  }

  return null;
}

export function writeStoredProject(project: StoredWeddingProject) {
  if (typeof window === "undefined") {
    return null;
  }

  const nextProject = createStoredProjectDraft({
    ...project,
    updatedAt: new Date().toISOString()
  });

  // Returns null when the write did not land (quota/unavailable) so callers keep
  // their in-memory state and the header can flag "not saved" — never throws.
  if (!safeSetItem(projectStorageKey, JSON.stringify(nextProject))) {
    return null;
  }

  return nextProject;
}

export function clearStoredProject() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(projectStorageKey);
  window.localStorage.removeItem(timelineStorageKey);
  window.localStorage.removeItem(riskResolutionStorageKey);
}

export function readStoredTimeline() {
  if (typeof window === "undefined") {
    return null;
  }

  const project = readStoredProject();
  if (project) {
    return {
      updatedAt: project.updatedAt,
      timelineItems: project.timelineItems
    };
  }

  return readStoredTimelineFromLegacyKey();
}

export function writeStoredTimeline(items: TimelineItem[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();
  const project = writeStoredProject({
    ...currentProject,
    timelineItems: createTimelineDraft(items)
  });

  if (!project) {
    return null;
  }

  // The project blob is the single source of truth for the timeline; the legacy
  // per-timeline key is read-only fallback for pre-project installs, so we no
  // longer dual-write it (that doubled storage on every timeline edit).
  return {
    updatedAt: project.updatedAt,
    timelineItems: project.timelineItems
  } satisfies StoredTimelineProject;
}

export function readStoredMusicCues() {
  const project = readStoredProject();

  return project
    ? {
        updatedAt: project.updatedAt,
        musicCues: project.musicCues
      }
    : null;
}

export function writeStoredMusicCues(items: MusicCue[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  return writeStoredProject({
    ...currentProject,
    musicCues: createMusicCueDraft(items)
  });
}

export function readStoredSpeeches() {
  const project = readStoredProject();

  return project
    ? {
        updatedAt: project.updatedAt,
        speeches: project.speeches
      }
    : null;
}

export function writeStoredSpeeches(items: Speech[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  return writeStoredProject({
    ...currentProject,
    speeches: createSpeechDraft(items)
  });
}

export function writeStoredReception(guestItems: Guest[], tableItems: DinnerTable[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  return writeStoredProject({
    ...currentProject,
    guests: createGuestDraft(guestItems),
    dinnerTables: createDinnerTableDraft(tableItems)
  });
}

export function writeStoredVendorCandidates(items: VendorCandidate[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  return writeStoredProject({
    ...currentProject,
    vendorCandidates: createVendorCandidateDraft(items)
  });
}

export function clearStoredTimeline() {
  if (typeof window === "undefined") {
    return;
  }

  const currentProject = readStoredProject();
  if (currentProject) {
    writeStoredProject({
      ...currentProject,
      timelineItems: createTimelineDraft(timelineItems)
    });
  }

  window.localStorage.removeItem(timelineStorageKey);
}

export function readStoredRiskResolutions() {
  if (typeof window === "undefined") {
    return [];
  }

  const project = readStoredProject();
  if (project) {
    return project.riskResolutions;
  }

  return readStoredRiskResolutionsFromLegacyKey();
}

export function writeStoredRiskResolutions(resolutions: StoredRiskResolution[]) {
  if (typeof window === "undefined") {
    return;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  writeStoredProject({
    ...currentProject,
    riskResolutions: resolutions
  });

  safeSetItem(riskResolutionStorageKey, JSON.stringify(resolutions));
}

export function resolveStoredRisk(riskId: string) {
  const currentResolutions = readStoredRiskResolutions();
  const withoutCurrentRisk = currentResolutions.filter((resolution) => resolution.riskId !== riskId);
  const nextResolutions = [
    ...withoutCurrentRisk,
    {
      riskId,
      resolvedAt: new Date().toISOString()
    }
  ];

  writeStoredRiskResolutions(nextResolutions);

  return nextResolutions;
}

function readStoredTimelineFromLegacyKey() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(timelineStorageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredTimelineProject>;
    if (!Array.isArray(parsed.timelineItems) || parsed.timelineItems.length === 0) {
      return null;
    }

    if (!isTimelineArray(parsed.timelineItems)) {
      return null;
    }

    return parsed as StoredTimelineProject;
  } catch {
    return null;
  }
}

function readStoredRiskResolutionsFromLegacyKey() {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(riskResolutionStorageKey);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return isRiskResolutionArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isTimelineArray(value: unknown): value is TimelineItem[] {
  return Array.isArray(value) && value.every(
    (item) =>
      typeof item.id === "string" &&
      typeof item.time === "string" &&
      typeof item.title === "string" &&
      typeof item.phase === "string" &&
      typeof item.location === "string" &&
      typeof item.responsibleRole === "string" &&
      typeof item.responsiblePerson === "string" &&
      typeof item.notes === "string" &&
      typeof item.visibility === "string"
  );
}

function isWedding(value: unknown): value is Wedding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const wedding = value as Wedding;

  return (
    typeof wedding.id === "string" &&
    typeof wedding.coupleNames === "string" &&
    typeof wedding.partnerOneName === "string" &&
    typeof wedding.partnerTwoName === "string" &&
    typeof wedding.date === "string" &&
    typeof wedding.ceremonyLocation === "string" &&
    typeof wedding.receptionLocation === "string" &&
    typeof wedding.guestCount === "number" &&
    typeof wedding.style === "string" &&
    typeof wedding.plannerName === "string" &&
    typeof wedding.status === "string"
  );
}

function isMusicCueArray(value: unknown): value is MusicCue[] {
  return Array.isArray(value) && value.every(
    (item) =>
      typeof item.id === "string" &&
      typeof item.moment === "string" &&
      typeof item.songTitle === "string" &&
      typeof item.artist === "string" &&
      typeof item.responsiblePerson === "string" &&
      typeof item.link === "string" &&
      typeof item.startCue === "string" &&
      typeof item.backupPlan === "string" &&
      typeof item.status === "string" &&
      typeof item.notes === "string" &&
      typeof item.timelineItemId === "string"
  );
}

function isSpeechArray(value: unknown): value is Speech[] {
  return Array.isArray(value) && value.every(
    (item) =>
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.speakerName === "string" &&
      typeof item.relation === "string" &&
      typeof item.durationMinutes === "number" &&
      typeof item.timing === "string" &&
      typeof item.visibility === "string" &&
      typeof item.isSecret === "boolean" &&
      Array.isArray(item.technicalNeeds) &&
      item.technicalNeeds.every((need: unknown) => typeof need === "string") &&
      typeof item.introPerson === "string" &&
      typeof item.notes === "string" &&
      typeof item.timelineItemId === "string"
  );
}

function isGuestArray(value: unknown): value is Guest[] {
  return Array.isArray(value) && value.every(
    (item) =>
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.household === "string" &&
      typeof item.rsvpStatus === "string" &&
      typeof item.mealChoice === "string" &&
      Array.isArray(item.allergies) &&
      item.allergies.every((allergy: unknown) => typeof allergy === "string") &&
      Array.isArray(item.tags) &&
      item.tags.every((tag: unknown) => typeof tag === "string") &&
      typeof item.relationship === "string" &&
      typeof item.accessibilityNotes === "string" &&
      Array.isArray(item.conflictGuestIds) &&
      item.conflictGuestIds.every((guestId: unknown) => typeof guestId === "string") &&
      Array.isArray(item.preferredGuestIds) &&
      item.preferredGuestIds.every((guestId: unknown) => typeof guestId === "string") &&
      typeof item.language === "string" &&
      typeof item.tableId === "string" &&
      typeof item.seatIndex === "number"
  );
}

function isDinnerTableArray(value: unknown): value is DinnerTable[] {
  return Array.isArray(value) && value.every(
    (item) =>
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.type === "string" &&
      typeof item.shape === "string" &&
      typeof item.capacity === "number" &&
      Boolean(item.position) &&
      typeof item.position === "object" &&
      typeof (item as DinnerTable).position.x === "number" &&
      typeof (item as DinnerTable).position.y === "number" &&
      Array.isArray(item.assignedGuestIds) &&
      item.assignedGuestIds.every((guestId: unknown) => typeof guestId === "string")
  );
}

function isVendorCandidateArray(value: unknown): value is VendorCandidate[] {
  return Array.isArray(value) && value.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as VendorCandidate).id === "string" &&
      typeof (item as VendorCandidate).categoryId === "string" &&
      typeof (item as VendorCandidate).name === "string" &&
      typeof (item as VendorCandidate).locationLabel === "string" &&
      typeof (item as VendorCandidate).sourceQuery === "string" &&
      typeof (item as VendorCandidate).mapsUrl === "string" &&
      typeof (item as VendorCandidate).webUrl === "string" &&
      typeof (item as VendorCandidate).status === "string" &&
      typeof (item as VendorCandidate).priceTier === "string" &&
      typeof (item as VendorCandidate).fitScore === "number" &&
      typeof (item as VendorCandidate).contactPerson === "string" &&
      typeof (item as VendorCandidate).contactUrl === "string" &&
      typeof (item as VendorCandidate).notes === "string" &&
      Array.isArray((item as VendorCandidate).connectedTimelineItemIds) &&
      (item as VendorCandidate).connectedTimelineItemIds.every((timelineItemId) => typeof timelineItemId === "string") &&
      typeof (item as VendorCandidate).createdAt === "string" &&
      typeof (item as VendorCandidate).updatedAt === "string"
  );
}

function isRiskResolutionArray(value: unknown): value is StoredRiskResolution[] {
  return Array.isArray(value) && value.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as StoredRiskResolution).riskId === "string" &&
      typeof (item as StoredRiskResolution).resolvedAt === "string"
  );
}
