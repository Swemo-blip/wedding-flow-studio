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
  writeStoredMusicCues,
  writeStoredProject,
  writeStoredReception,
  writeStoredSpeeches,
  writeStoredTimeline,
  writeStoredVendorCandidates
} from "@/lib/local-project-store";
import { dinnerTables, guests, musicCues, sampleWedding, speeches, timelineItems } from "@/lib/wedding-data";
import type { DinnerTable, Guest, MusicCue, Speech, TimelineItem, VendorCandidate, Wedding } from "@/lib/wedding-types";

type LocalProjectState = {
  hasLocalProject: boolean;
  wedding: Wedding;
  timelineItems: TimelineItem[];
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: nextProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: nextProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: nextProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
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
      updatedAt: storedProject?.updatedAt ?? new Date().toISOString()
    };
  });
}

function resetLocalProject() {
  clearStoredProject();
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
    updateMusicCue,
    resetMusicCues,
    updateSpeech,
    resetSpeeches,
    updateGuest,
    addGuest,
    removeGuest,
    updateDinnerTable,
    assignGuestToTable,
    resetReception,
    addVendorCandidate,
    updateVendorCandidate,
    resetLocalProject
  };
}
