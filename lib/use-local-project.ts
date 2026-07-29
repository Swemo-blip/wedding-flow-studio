"use client";

import { useSyncExternalStore } from "react";
import {
  createMusicCueDraft,
  createSpeechDraft,
  createDinnerTableDraft,
  createGuestDraft,
  createVendorCandidateDraft,
  clearStoredProject,
  createStoredProjectDraft,
  createTimelineDraft,
  projectStorageKey,
  readStoredProject,
  subscribeStoredProjectChange,
  writeStoredMenuCourses,
  writeStoredMusicCues,
  writeStoredProject,
  writeStoredReception,
  writeStoredSpeeches,
  writeStoredTimeline,
  writeStoredWedding,
  writeStoredVendorCandidates
} from "@/lib/local-project-store";
import { clearStoredBudget } from "@/lib/use-budget";
import { clearStoredChecklist } from "@/lib/use-checklist";
import { dinnerTables, guests, musicCues, sampleWedding, speeches, timelineItems } from "@/lib/wedding-data";
import type { DinnerTable, Guest, MenuCourse, MusicCue, Speech, TimelineItem, VendorCandidate, Wedding } from "@/lib/wedding-types";

type LocalProjectState = {
  hasLocalProject: boolean;
  wedding: Wedding;
  timelineItems: TimelineItem[];
  menuCourses: MenuCourse[];
  musicCues: MusicCue[];
  speeches: Speech[];
  guests: Guest[];
  dinnerTables: DinnerTable[];
  vendorCandidates: VendorCandidate[];
  updatedAt?: string;
};

function createInitialState(): LocalProjectState {
  return {
    hasLocalProject: false,
    wedding: sampleWedding,
    timelineItems: createTimelineDraft(timelineItems),
    menuCourses: [],
    musicCues: createMusicCueDraft(musicCues),
    speeches: createSpeechDraft(speeches),
    guests: createGuestDraft(guests),
    dinnerTables: createDinnerTableDraft(dinnerTables),
    vendorCandidates: [],
    updatedAt: undefined
  };
}

// A single shared source of truth for the project. Previously every
// useLocalProject() call kept its own useState copy, so the always-mounted
// header (root layout) never learned about a plan created on another route —
// it kept showing the sample wedding while the page showed the real couple.
// One module-level store + a listener set fixes that: all consumers render the
// same state and react to create/reset/edit live.
let state: LocalProjectState = createInitialState();
// Stable reference for SSR / first client paint (never recreate — a fresh
// object each call would loop useSyncExternalStore).
const SERVER_SNAPSHOT: LocalProjectState = state;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setStoreState(updater: (current: LocalProjectState) => LocalProjectState) {
  state = updater(state);
  emit();
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

// Pull the latest blob into the store. Skips its own writes (updatedAt already
// matches) so per-keystroke edits don't re-parse the whole project; only
// external writers (intake, a reset elsewhere, another tab) trigger a refresh.
function hydrateFromStorage() {
  const stored = readStoredProject();

  if (stored) {
    if (state.hasLocalProject && stored.updatedAt === state.updatedAt) {
      return;
    }

    setStoreState(() => ({
      hasLocalProject: true,
      wedding: stored.wedding,
      timelineItems: stored.timelineItems,
      menuCourses: stored.menuCourses,
      musicCues: stored.musicCues,
      speeches: stored.speeches,
      guests: stored.guests,
      dinnerTables: stored.dinnerTables,
      vendorCandidates: stored.vendorCandidates,
      updatedAt: stored.updatedAt
    }));

    return;
  }

  // No stored project (e.g. cleared elsewhere) — fall back to the sample.
  if (!state.hasLocalProject) {
    return;
  }

  setStoreState(() => createInitialState());
}

let storeWired = false;
function ensureStoreWiring() {
  if (storeWired || typeof window === "undefined") {
    return;
  }

  storeWired = true;
  subscribeStoredProjectChange(hydrateFromStorage);
  window.addEventListener("storage", (event) => {
    if (event.key === projectStorageKey || event.key === null) {
      hydrateFromStorage();
    }
  });
}

let hydratedOnce = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureStoreWiring();

  if (!hydratedOnce) {
    hydratedOnce = true;
    // After commit, so the first client paint matches the server snapshot.
    queueMicrotask(hydrateFromStorage);
  }

  return () => {
    listeners.delete(listener);
  };
}

function updateTimelineItems(updater: TimelineItem[] | ((items: TimelineItem[]) => TimelineItem[])) {
  setStoreState((currentState) => {
    const nextTimelineItems = typeof updater === "function" ? updater(currentState.timelineItems) : updater;
    const storedProject = writeStoredTimeline(nextTimelineItems);

    return {
      ...currentState,
      hasLocalProject: true,
      timelineItems: storedProject?.timelineItems ?? createTimelineDraft(nextTimelineItems),
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

// Lets the couple correct their own facts — names, date, venues, guest count —
// without the destructive "Start over" that wipes guests, seating, timeline,
// speeches, budget and checklist. Merges into the CURRENT wedding so a partial
// edit can never blank the fields it didn't touch.
function updateWedding(updates: Partial<Wedding>) {
  setStoreState((currentState) => {
    const nextWedding = { ...currentState.wedding, ...updates };
    const storedProject = writeStoredWedding(nextWedding);

    return {
      ...currentState,
      hasLocalProject: true,
      wedding: storedProject?.wedding ?? nextWedding,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

// The menu is new data with a full lifecycle from the start: a couple writes their
// own courses, so add/update/remove all have to exist or the surface is a
// read-only decoration.
function addMenuCourse(partial: Partial<MenuCourse> = {}) {
  setStoreState((currentState) => {
    const newCourse: MenuCourse = {
      alternative: "",
      conflictsWith: [],
      description: "",
      id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: "main",
      name: "",
      notes: "",
      pairing: "",
      ...partial
    };
    const nextCourses = [...currentState.menuCourses, newCourse];
    const storedProject = writeStoredMenuCourses(nextCourses);

    return {
      ...currentState,
      hasLocalProject: true,
      menuCourses: storedProject?.menuCourses ?? nextCourses,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function updateMenuCourse(courseId: string, updates: Partial<MenuCourse>) {
  setStoreState((currentState) => {
    const nextCourses = currentState.menuCourses.map((course) => (course.id === courseId ? { ...course, ...updates } : course));
    const storedProject = writeStoredMenuCourses(nextCourses);

    return {
      ...currentState,
      hasLocalProject: true,
      menuCourses: storedProject?.menuCourses ?? nextCourses,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function removeMenuCourse(courseId: string) {
  setStoreState((currentState) => {
    const nextCourses = currentState.menuCourses.filter((course) => course.id !== courseId);
    const storedProject = writeStoredMenuCourses(nextCourses);

    return {
      ...currentState,
      hasLocalProject: true,
      menuCourses: storedProject?.menuCourses ?? nextCourses,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function updateMusicCue(cueId: string, updates: Partial<MusicCue>) {
  setStoreState((currentState) => {
    const nextMusicCues = currentState.musicCues.map((cue) => (cue.id === cueId ? { ...cue, ...updates } : cue));
    const storedProject = writeStoredMusicCues(nextMusicCues);

    return {
      ...currentState,
      hasLocalProject: true,
      musicCues: storedProject?.musicCues ?? nextMusicCues,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

// Music cues, speeches and dinner tables could only ever be EDITED — the store
// had no add or remove for any of them. So a couple could not give their own
// "Father-daughter dance" a song, could not delete a generated speech placeholder
// they didn't want, and could not add a table when their guest list grew past what
// the intake sized for. Seating in particular was impossible to finish.
function addMusicCue(partial: Partial<MusicCue> = {}) {
  setStoreState((currentState) => {
    const newCue: MusicCue = {
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      moment: "",
      songTitle: "",
      artist: "",
      responsiblePerson: "",
      link: "",
      startCue: "",
      backupPlan: "",
      status: "needs-confirmation",
      notes: "",
      timelineItemId: "",
      ...partial
    };
    const nextMusicCues = [...currentState.musicCues, newCue];
    const storedProject = writeStoredMusicCues(nextMusicCues);

    return {
      ...currentState,
      hasLocalProject: true,
      musicCues: storedProject?.musicCues ?? nextMusicCues,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function removeMusicCue(cueId: string) {
  setStoreState((currentState) => {
    const nextMusicCues = currentState.musicCues.filter((cue) => cue.id !== cueId);
    const storedProject = writeStoredMusicCues(nextMusicCues);

    return {
      ...currentState,
      hasLocalProject: true,
      musicCues: storedProject?.musicCues ?? nextMusicCues,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function addSpeech(partial: Partial<Speech> = {}) {
  setStoreState((currentState) => {
    const newSpeech: Speech = {
      id: `speech-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: "",
      speakerName: "",
      relation: "",
      durationMinutes: 4,
      timing: "",
      visibility: "everyone",
      isSecret: false,
      technicalNeeds: [],
      introPerson: "",
      notes: "",
      timelineItemId: "",
      ...partial
    };
    const nextSpeeches = [...currentState.speeches, newSpeech];
    const storedProject = writeStoredSpeeches(nextSpeeches);

    return {
      ...currentState,
      hasLocalProject: true,
      speeches: storedProject?.speeches ?? nextSpeeches,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function removeSpeech(speechId: string) {
  setStoreState((currentState) => {
    const nextSpeeches = currentState.speeches.filter((speech) => speech.id !== speechId);
    const storedProject = writeStoredSpeeches(nextSpeeches);

    return {
      ...currentState,
      hasLocalProject: true,
      speeches: storedProject?.speeches ?? nextSpeeches,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function addDinnerTable(partial: Partial<DinnerTable> = {}) {
  setStoreState((currentState) => {
    const newTable: DinnerTable = {
      id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Table ${currentState.dinnerTables.length + 1}`,
      type: "guest",
      shape: "round",
      capacity: 8,
      // Placed just off-centre so a new table is visible in the room rather than
      // stacked exactly on top of an existing one.
      position: { x: 0.5, y: 0.4 + (currentState.dinnerTables.length % 3) * 0.12 },
      assignedGuestIds: [],
      ...partial
    };
    const nextTables = [...currentState.dinnerTables, newTable];
    const storedProject = writeStoredReception(currentState.guests, nextTables);

    return {
      ...currentState,
      hasLocalProject: true,
      dinnerTables: storedProject?.dinnerTables ?? nextTables,
      guests: storedProject?.guests ?? currentState.guests,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function removeDinnerTable(tableId: string) {
  setStoreState((currentState) => {
    const nextTables = currentState.dinnerTables.filter((table) => table.id !== tableId);
    // Unseat everyone who sat there, or they would keep a tableId pointing at a
    // table that no longer exists — the guest would look seated in the list while
    // vanishing from the room.
    const nextGuests = currentState.guests.map((guest) =>
      guest.tableId === tableId ? { ...guest, tableId: "", seatIndex: 0 } : guest
    );
    const storedProject = writeStoredReception(nextGuests, nextTables);

    return {
      ...currentState,
      hasLocalProject: true,
      dinnerTables: storedProject?.dinnerTables ?? nextTables,
      guests: storedProject?.guests ?? nextGuests,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function resetMusicCues() {
  setStoreState((currentState) => {
    const nextProject = writeStoredProject(
      createStoredProjectDraft({
        timelineItems: currentState.timelineItems,
        wedding: currentState.wedding,
        musicCues,
        speeches: currentState.speeches,
        guests: currentState.guests,
        dinnerTables: currentState.dinnerTables,
        vendorCandidates: currentState.vendorCandidates,
        riskResolutions: readStoredProject()?.riskResolutions ?? []
      })
    );

    return {
      ...currentState,
      hasLocalProject: Boolean(nextProject),
      musicCues: nextProject?.musicCues ?? createMusicCueDraft(musicCues),
      updatedAt: nextProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function updateSpeech(speechId: string, updates: Partial<Speech>) {
  setStoreState((currentState) => {
    const nextSpeeches = currentState.speeches.map((speech) => (speech.id === speechId ? { ...speech, ...updates } : speech));
    const storedProject = writeStoredSpeeches(nextSpeeches);

    return {
      ...currentState,
      hasLocalProject: true,
      speeches: storedProject?.speeches ?? nextSpeeches,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function resetSpeeches() {
  setStoreState((currentState) => {
    const nextProject = writeStoredProject(
      createStoredProjectDraft({
        timelineItems: currentState.timelineItems,
        wedding: currentState.wedding,
        musicCues: currentState.musicCues,
        speeches,
        guests: currentState.guests,
        dinnerTables: currentState.dinnerTables,
        vendorCandidates: currentState.vendorCandidates,
        riskResolutions: readStoredProject()?.riskResolutions ?? []
      })
    );

    return {
      ...currentState,
      hasLocalProject: Boolean(nextProject),
      speeches: nextProject?.speeches ?? createSpeechDraft(speeches),
      updatedAt: nextProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function updateGuest(guestId: string, updates: Partial<Guest>) {
  setStoreState((currentState) => {
    const nextGuests = currentState.guests.map((guest) => (guest.id === guestId ? { ...guest, ...updates } : guest));
    const storedProject = writeStoredReception(nextGuests, currentState.dinnerTables);

    return {
      ...currentState,
      hasLocalProject: true,
      guests: storedProject?.guests ?? nextGuests,
      dinnerTables: storedProject?.dinnerTables ?? currentState.dinnerTables,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function addGuest(partial: Partial<Guest> = {}) {
  setStoreState((currentState) => {
    const newGuest: Guest = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "New guest",
      household: "",
      rsvpStatus: "pending",
      mealChoice: "",
      allergies: [],
      tags: [],
      relationship: "",
      accessibilityNotes: "",
      conflictGuestIds: [],
      preferredGuestIds: [],
      language: "",
      tableId: "",
      seatIndex: 0,
      ...partial
    };
    const nextGuests = [newGuest, ...currentState.guests];
    const storedProject = writeStoredReception(nextGuests, currentState.dinnerTables);

    return {
      ...currentState,
      hasLocalProject: true,
      guests: storedProject?.guests ?? nextGuests,
      dinnerTables: storedProject?.dinnerTables ?? currentState.dinnerTables,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function removeGuest(guestId: string) {
  setStoreState((currentState) => {
    const remainingGuests = currentState.guests.filter((guest) => guest.id !== guestId);
    const nextTables = currentState.dinnerTables.map((table) => ({
      ...table,
      assignedGuestIds: table.assignedGuestIds.filter((assignedGuestId) => assignedGuestId !== guestId)
    }));
    const nextGuests = applySeatIndices(remainingGuests, nextTables);
    const storedProject = writeStoredReception(nextGuests, nextTables);

    return {
      ...currentState,
      hasLocalProject: true,
      guests: storedProject?.guests ?? nextGuests,
      dinnerTables: storedProject?.dinnerTables ?? nextTables,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function updateDinnerTable(tableId: string, updates: Partial<DinnerTable>) {
  setStoreState((currentState) => {
    const nextTables = currentState.dinnerTables.map((table) => (table.id === tableId ? { ...table, ...updates } : table));
    const storedProject = writeStoredReception(currentState.guests, nextTables);

    return {
      ...currentState,
      hasLocalProject: true,
      guests: storedProject?.guests ?? currentState.guests,
      dinnerTables: storedProject?.dinnerTables ?? nextTables,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function assignGuestToTable(guestId: string, tableId: string) {
  setStoreState((currentState) => {
    const nextTables = currentState.dinnerTables.map((table) => {
      const withoutGuest = table.assignedGuestIds.filter((assignedGuestId) => assignedGuestId !== guestId);

      if (table.id === tableId) {
        return {
          ...table,
          assignedGuestIds: [...withoutGuest, guestId]
        };
      }

      return {
        ...table,
        assignedGuestIds: withoutGuest
      };
    });
    const nextGuests = applySeatIndices(
      currentState.guests.map((guest) => (guest.id === guestId ? { ...guest, tableId } : guest)),
      nextTables
    );
    const storedProject = writeStoredReception(nextGuests, nextTables);

    return {
      ...currentState,
      hasLocalProject: true,
      guests: storedProject?.guests ?? nextGuests,
      dinnerTables: storedProject?.dinnerTables ?? nextTables,
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function resetReception() {
  setStoreState((currentState) => {
    const nextProject = writeStoredProject(
      createStoredProjectDraft({
        timelineItems: currentState.timelineItems,
        wedding: currentState.wedding,
        musicCues: currentState.musicCues,
        speeches: currentState.speeches,
        guests,
        dinnerTables,
        vendorCandidates: currentState.vendorCandidates,
        riskResolutions: readStoredProject()?.riskResolutions ?? []
      })
    );

    return {
      ...currentState,
      hasLocalProject: Boolean(nextProject),
      guests: nextProject?.guests ?? createGuestDraft(guests),
      dinnerTables: nextProject?.dinnerTables ?? createDinnerTableDraft(dinnerTables),
      updatedAt: nextProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function addVendorCandidate(candidate: VendorCandidate) {
  setStoreState((currentState) => {
    const existingCandidate = currentState.vendorCandidates.find((item) => item.id === candidate.id);
    const nextCandidates = existingCandidate
      ? currentState.vendorCandidates.map((item) => (item.id === candidate.id ? candidate : item))
      : [candidate, ...currentState.vendorCandidates];
    const storedProject = writeStoredVendorCandidates(nextCandidates);

    return {
      ...currentState,
      hasLocalProject: true,
      vendorCandidates: storedProject?.vendorCandidates ?? createVendorCandidateDraft(nextCandidates),
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function updateVendorCandidate(candidateId: string, updates: Partial<VendorCandidate>) {
  setStoreState((currentState) => {
    const nextCandidates = currentState.vendorCandidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, ...updates, updatedAt: new Date().toISOString() } : candidate
    );
    const storedProject = writeStoredVendorCandidates(nextCandidates);

    return {
      ...currentState,
      hasLocalProject: true,
      vendorCandidates: storedProject?.vendorCandidates ?? createVendorCandidateDraft(nextCandidates),
      updatedAt: storedProject?.updatedAt ?? currentState.updatedAt
    };
  });
}

function resetLocalProject() {
  clearStoredProject();
  clearStoredBudget();
  clearStoredChecklist();
  setStoreState(() => createInitialState());
}

// Recompute each seated guest's seatIndex from its position in the table's
// assignedGuestIds so labels ("Table · 3") never show stale/duplicate numbers
// after a move or removal.
function applySeatIndices(guestList: Guest[], tables: DinnerTable[]): Guest[] {
  const seatByGuest = new Map<string, number>();
  for (const table of tables) {
    table.assignedGuestIds.forEach((assignedGuestId, index) => {
      seatByGuest.set(assignedGuestId, index);
    });
  }

  return guestList.map((guest) => {
    const seatIndex = seatByGuest.get(guest.id);
    return seatIndex === undefined || guest.seatIndex === seatIndex ? guest : { ...guest, seatIndex };
  });
}

export function useLocalProject() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    ...snapshot,
    updateTimelineItems,
    updateWedding,
    updateMusicCue,
    addMenuCourse,
    addMusicCue,
    removeMenuCourse,
    removeMusicCue,
    updateMenuCourse,
    resetMusicCues,
    updateSpeech,
    addSpeech,
    removeSpeech,
    resetSpeeches,
    updateGuest,
    addGuest,
    removeGuest,
    updateDinnerTable,
    addDinnerTable,
    removeDinnerTable,
    assignGuestToTable,
    resetReception,
    addVendorCandidate,
    updateVendorCandidate,
    resetLocalProject
  };
}
