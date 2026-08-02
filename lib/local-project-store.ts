import { dinnerTables, guests, musicCues, sampleWedding, speeches, timelineItems } from "@/lib/wedding-data";
import { safeSetItem } from "@/lib/persistence-status";
import { sortTimelineByTime } from "@/lib/utils";
import { MENU_COURSE_KINDS } from "@/lib/wedding-menu";
import type { DinnerTable, Guest, MenuCourse, PhotoShot, MusicCue, Speech, TimelineItem, VendorCandidate, Wedding } from "@/lib/wedding-types";

export const projectStorageKey = "wedding-flow-studio.project.v1";
export const timelineStorageKey = "wedding-flow-studio.timeline.v1";
export const riskResolutionStorageKey = "wedding-flow-studio.risk-resolutions.v1";
export const corruptProjectStorageKey = "wedding-flow-studio.project.corrupt.v1";

// The stored project is the single source of truth on disk, but it is written
// from many places (the useLocalProject mutators, the intake flow's direct
// writeStoredProject, resets). This pub/sub lets the shared in-memory store
// refresh whenever the blob changes — so, e.g., creating a plan in the intake
// and navigating home updates the header, not just the page that wrote it.
type StoredProjectChangeListener = () => void;
const storedProjectChangeListeners = new Set<StoredProjectChangeListener>();

export function subscribeStoredProjectChange(listener: StoredProjectChangeListener) {
  storedProjectChangeListeners.add(listener);

  return () => {
    storedProjectChangeListeners.delete(listener);
  };
}

function notifyStoredProjectChange() {
  if (typeof window === "undefined" || storedProjectChangeListeners.size === 0) {
    return;
  }

  // Defer so a caller that also updates the shared in-memory store settles
  // first; the store then skips re-reading its own write (updatedAt matches)
  // and only external writers trigger a refresh.
  queueMicrotask(() => {
    for (const listener of storedProjectChangeListeners) {
      listener();
    }
  });
}

export type StoredTimelineProject = {
  updatedAt: string;
  timelineItems: TimelineItem[];
};

export type StoredWeddingProject = {
  updatedAt: string;
  wedding: Wedding;
  timelineItems: TimelineItem[];
  menuCourses: MenuCourse[];
  photoShots: PhotoShot[];
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

// Every read and write path for the timeline funnels through here, which makes it
// the one place to guarantee chronological order. New moments used to be appended
// to the END of the array, and `preview-phases.ts` states outright that it assumes
// a chronological timeline — so a 9:00 AM moment added late rendered below "Party
// begins", and Preview, the exports and the .ics all inherited that order.
export function createTimelineDraft(items: TimelineItem[]) {
  return sortTimelineByTime(items.map((item) => ({ ...item })));
}

export function createPhotoShotDraft(items: PhotoShot[]) {
  // No sample fallback: a shot list the couple did not write is worse than none,
  // because someone would try to shoot it.
  return items
    .filter((item): item is PhotoShot => Boolean(item) && typeof item === "object")
    .map((item) => ({
      captured: item.captured === true,
      guestIds: Array.isArray(item.guestIds) ? item.guestIds.filter((entry) => typeof entry === "string") : [],
      id: typeof item.id === "string" && item.id ? item.id : `shot-${Math.random().toString(36).slice(2, 9)}`,
      moment: typeof item.moment === "string" ? item.moment : "",
      notes: typeof item.notes === "string" ? item.notes : "",
      title: typeof item.title === "string" ? item.title : ""
    }));
}

export function writeStoredPhotoShots(items: PhotoShot[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  return writeStoredProject({ ...currentProject, photoShots: createPhotoShotDraft(items) });
}

export function createMenuCourseDraft(items: MenuCourse[]) {
  // Menus arrive empty for every existing project, so this must never fall back
  // to sample dishes — a menu the couple did not write is the worst possible
  // thing to print on a card and hand to a guest.
  return items
    .filter((item): item is MenuCourse => Boolean(item) && typeof item === "object")
    .map((item) => ({
      alternative: typeof item.alternative === "string" ? item.alternative : "",
      conflictsWith: Array.isArray(item.conflictsWith) ? item.conflictsWith.filter((entry) => typeof entry === "string") : [],
      description: typeof item.description === "string" ? item.description : "",
      id: typeof item.id === "string" && item.id ? item.id : `course-${Math.random().toString(36).slice(2, 9)}`,
      kind: MENU_COURSE_KINDS.includes(item.kind) ? item.kind : "main",
      name: typeof item.name === "string" ? item.name : "",
      notes: typeof item.notes === "string" ? item.notes : "",
      pairing: typeof item.pairing === "string" ? item.pairing : ""
    }));
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
    menuCourses: createMenuCourseDraft(source.menuCourses ?? []),
    photoShots: createPhotoShotDraft(source.photoShots ?? []),
    musicCues: createMusicCueDraft(source.musicCues ?? musicCues),
    speeches: createSpeechDraft(source.speeches ?? speeches),
    guests: createGuestDraft(source.guests ?? guests),
    dinnerTables: createDinnerTableDraft(source.dinnerTables ?? dinnerTables),
    vendorCandidates: createVendorCandidateDraft(source.vendorCandidates ?? []),
    riskResolutions: [...(source.riskResolutions ?? [])]
  };
}

// The recovery shape for a stored wedding that no longer validates. Deliberately
// blank rather than the sample: the couple sees empty fields to fill in (and the
// /account details form can repair them) instead of a stranger's names and venues
// being presented as theirs — and then persisted on their next edit.
function blankWedding(): Wedding {
  return {
    id: "recovered-wedding",
    coupleNames: "",
    partnerOneName: "",
    partnerTwoName: "",
    date: "",
    ceremonyLocation: "",
    receptionLocation: "",
    guestCount: 0,
    style: "",
    plannerName: "",
    playlistUrl: "",
    status: ""
  };
}

// One-shot data migration, ordered by the owner on 2026-08-02: his stored plan
// was created with the test name "Klara", and he wants the couple to be Sanne &
// Johan. The data lives only in localStorage on his machines, so a UI edit in
// one browser cannot reach the others — this rewrites the name at read time
// wherever the app runs. Keyed on the exact first name "Klara" so it is
// idempotent and touches nothing else; remove once his plans all say Sanne.
function renameKlaraToSanne(wedding: Wedding): Wedding {
  const firstName = (value: string) => value.trim().split(/\s+/)[0] ?? "";
  const swap = (value: string) => (firstName(value) === "Klara" ? value.replace(/^\s*Klara/, "Sanne") : value);
  const partnerOneName = swap(wedding.partnerOneName);
  const partnerTwoName = swap(wedding.partnerTwoName);
  if (partnerOneName === wedding.partnerOneName && partnerTwoName === wedding.partnerTwoName) {
    return wedding;
  }
  const coupleNames = [firstName(partnerOneName), firstName(partnerTwoName)].filter(Boolean).join(" & ");
  return { ...wedding, coupleNames, partnerOneName, partnerTwoName };
}

// The guest list the owner ordered alongside the rename: "Johan och Sanne med
// 50 gäster, auto-fyll med random-namn". Seeded ONLY while the Klara migration
// is firing (i.e. exactly once per browser), and only into an EMPTY list — so a
// list he later empties on purpose stays empty. Plain names without diacritics
// keep the language scan clean; every field matches what addGuest writes.
const SEEDED_GUEST_NAMES = [
  "Anna Lindberg", "Erik Nilsson", "Maria Holm", "Johan Berg", "Elin Sandell",
  "Oskar Lund", "Karin Ekstrom", "Anders Vik", "Sofia Dahl", "Henrik Strand",
  "Emma Rosen", "Magnus Falk", "Lisa Norberg", "Fredrik Palm", "Ida Bergstrom",
  "Per Sundin", "Hanna Ek", "Mikael Torn", "Julia Ros", "Daniel Hedin",
  "Amanda Sjo", "Niklas Ohman", "Sara Wall", "Jonas Alm", "Vera Vinter",
  "Viktor Rehn", "Linnea Falkman", "Gustav Norr", "Alice Brandt", "Filip Sten",
  "Ebba Lundqvist", "Axel Hammar", "Wilma Ceder", "Leo Bjork", "Alma Kvist",
  "Hugo Malm", "Elsa Rydell", "Adam Skog", "Astrid Voss", "Isak Berggren",
  "Maja Ekman", "Anton Frisk", "Nora Hellman", "Emil Stark", "Signe Aberg",
  "Ludvig Sand", "Freja Holmgren", "Casper Nyman", "Tuva Lindell", "Arvid Storm"
];

function seedGuestsForMigratedPlan(): Guest[] {
  return SEEDED_GUEST_NAMES.map((name, index) => ({
    accessibilityNotes: "",
    allergies: [],
    conflictGuestIds: [],
    household: "",
    id: `guest-seeded-${index + 1}`,
    language: "",
    mealChoice: "",
    name,
    preferredGuestIds: [],
    seatIndex: index,
    relationship: "",
    rsvpStatus: "pending",
    tableId: "",
    tags: []
  }));
}

export function readStoredProject() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(projectStorageKey);
  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredWeddingProject>;
      // This gate used to demand that EVERY timeline item and EVERY music cue
      // validate before the project could be read at all. One malformed moment
      // therefore discarded the whole record — wedding, guests, tables, budget —
      // and sent it down the unreadable-value path. It only needs them to be
      // arrays; the individual records are filtered below like everything else.
      if (Array.isArray(parsed.timelineItems) && Array.isArray(parsed.musicCues)) {
        const parsedWedding = isWedding(parsed.wedding) ? parsed.wedding : blankWedding();
        const migratedWedding = renameKlaraToSanne(parsedWedding);
        // The rename firing marks this as the owner's pre-migration plan — the
        // only case where an empty guest list gets his ordered 50 seeded names.
        const renameFired = migratedWedding !== parsedWedding;
        const storedGuests = readGuests(parsed.guests);
        return createStoredProjectDraft({
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
          // A slice that fails validation falls back to EMPTY, never to the sample.
          // This is the same reasoning the catch block below already states: sample
          // data substituted here gets persisted over the couple's real blob on
          // their next edit. It was also visibly wrong — a couple whose guest array
          // was even slightly malformed saw the sample's 27 guests, complete with
          // meal choices, presented as their own on the summary, the exports and in
          // the 3D room. An empty list says "nothing here yet", which is true.
          wedding: migratedWedding,
          timelineItems: keepValid<TimelineItem>(parsed.timelineItems, isTimelineArray).items,
          musicCues: keepValid<MusicCue>(parsed.musicCues, isMusicCueArray).items,
          speeches: keepValid<Speech>(parsed.speeches, isSpeechArray).items,
          guests: storedGuests.length === 0 && renameFired ? seedGuestsForMigratedPlan() : storedGuests,
          dinnerTables: keepValid<DinnerTable>(parsed.dinnerTables, isDinnerTableArray).items,
          vendorCandidates: keepValid<VendorCandidate>(parsed.vendorCandidates, isVendorCandidateArray).items,
          riskResolutions: keepValid<StoredRiskResolution>(parsed.riskResolutions, isRiskResolutionArray).items
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

  notifyStoredProjectChange();

  return nextProject;
}

export function clearStoredProject() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(projectStorageKey);
  window.localStorage.removeItem(timelineStorageKey);
  window.localStorage.removeItem(riskResolutionStorageKey);
  notifyStoredProjectChange();
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

// The couple's own facts — names, date, venues, guest count — were writable ONLY
// by the intake, which replaces the whole project. So changing a date meant
// destroying the plan and starting over. This writes just the wedding slice and
// leaves guests, seating, timeline, speeches, budget and checklist untouched.
export function writeStoredWedding(wedding: Wedding) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();
  const project = writeStoredProject({
    ...currentProject,
    wedding
  });

  if (!project) {
    return null;
  }

  return {
    updatedAt: project.updatedAt,
    wedding: project.wedding
  };
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

export function writeStoredMenuCourses(items: MenuCourse[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const currentProject = readStoredProject() ?? createStoredProjectDraft();

  return writeStoredProject({
    ...currentProject,
    menuCourses: createMenuCourseDraft(items)
  });
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
      Boolean(item) &&
      typeof item === "object" &&
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
    (typeof wedding.playlistUrl === "string" || typeof wedding.playlistUrl === "undefined") &&
    typeof wedding.status === "string"
  );
}

function isMusicCueArray(value: unknown): value is MusicCue[] {
  return Array.isArray(value) && value.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
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
      Boolean(item) &&
      typeof item === "object" &&
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

// One guest at a time. This used to be an all-or-nothing array check, and the read
// site turned a false into an empty list — so a SINGLE malformed record from an
// import, an older backup, or a future field change silently erased the ENTIRE
// guest list, and the couple got a fully furnished, completely empty church with no
// explanation anywhere. That is the most damaging kind of quiet failure this file
// can have: the data is gone and nothing says so. Proven on 2026-07-31 by writing
// fifty hand-made guests and watching all fifty vanish while the wedding name in
// the same record was accepted.
function isGuest(value: unknown): value is Guest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  const strings = ["id", "name", "household", "rsvpStatus", "mealChoice", "relationship", "accessibilityNotes", "language", "tableId"];
  const stringArrays = ["allergies", "tags", "conflictGuestIds", "preferredGuestIds"];

  return (
    strings.every((key) => typeof item[key] === "string") &&
    stringArrays.every((key) => Array.isArray(item[key]) && (item[key] as unknown[]).every((entry) => typeof entry === "string")) &&
    typeof item.seatIndex === "number"
  );
}

// A count the UI can show. Returning the number from partitionGuests was not
// enough on its own: the read happens deep in the store, far from any component,
// so without somewhere to put it the number was computed and thrown away — a
// quieter version of the same bug.
let lastRejectedGuestCount = 0;

// The same all-or-nothing trap the guest list fell into is written three more
// times in this file: tables, vendors, risk resolutions and the timeline pair all
// validate the whole array and the read sites turn a false into an empty list. One
// bad record from an import or an older backup takes the lot.
//
// Rather than rewrite four validators, each existing array predicate is applied to
// a one-element array — same rules, one record at a time — so a single malformed
// entry costs that entry and nothing else.
function keepValid<T>(value: unknown, isArrayOf: (candidate: unknown) => boolean) {
  if (!Array.isArray(value)) {
    return { items: [] as T[], rejected: 0 };
  }
  const items = value.filter((item) => isArrayOf([item])) as T[];
  return { items, rejected: value.length - items.length };
}

function readGuests(value: unknown) {
  const { guests, rejected } = partitionGuests(value);
  lastRejectedGuestCount = rejected;
  return guests;
}

export function getRejectedGuestCount() {
  return lastRejectedGuestCount;
}

// Keeps every guest that survives validation and reports how many did not, so a
// partial loss is visible instead of total and silent.
export function partitionGuests(value: unknown): { guests: Guest[]; rejected: number } {
  if (!Array.isArray(value)) {
    return { guests: [], rejected: 0 };
  }
  const guests = value.filter(isGuest);
  return { guests, rejected: value.length - guests.length };
}

function isDinnerTableArray(value: unknown): value is DinnerTable[] {
  return Array.isArray(value) && value.every(
    (item) =>
      Boolean(item) &&
      typeof item === "object" &&
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
