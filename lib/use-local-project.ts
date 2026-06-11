"use client";

import { useEffect, useState } from "react";
import {
  createMusicCueDraft,
  createSpeechDraft,
  createDinnerTableDraft,
  createGuestDraft,
  createVendorCandidateDraft,
  clearStoredProject,
  createStoredProjectDraft,
  createTimelineDraft,
  readStoredProject,
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

export function useLocalProject() {
  const [state, setState] = useState<LocalProjectState>(() => ({
    hasLocalProject: false,
    wedding: sampleWedding,
    timelineItems: createTimelineDraft(timelineItems),
    musicCues: createMusicCueDraft(musicCues),
    speeches: createSpeechDraft(speeches),
    guests: createGuestDraft(guests),
    dinnerTables: createDinnerTableDraft(dinnerTables),
    vendorCandidates: [],
    updatedAt: undefined
  }));

  useEffect(() => {
    queueMicrotask(() => {
      const storedProject = readStoredProject();

      if (storedProject) {
        setState({
          hasLocalProject: true,
          wedding: storedProject.wedding,
          timelineItems: storedProject.timelineItems,
          musicCues: storedProject.musicCues,
          speeches: storedProject.speeches,
          guests: storedProject.guests,
          dinnerTables: storedProject.dinnerTables,
          vendorCandidates: storedProject.vendorCandidates,
          updatedAt: storedProject.updatedAt
        });
      }
    });
  }, []);

  function updateTimelineItems(updater: TimelineItem[] | ((items: TimelineItem[]) => TimelineItem[])) {
    setState((currentState) => {
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
    setState((currentState) => {
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
    setState((currentState) => {
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
    setState((currentState) => {
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
    setState((currentState) => {
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
    setState((currentState) => {
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

  function updateDinnerTable(tableId: string, updates: Partial<DinnerTable>) {
    setState((currentState) => {
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
    setState((currentState) => {
      const targetTable = currentState.dinnerTables.find((table) => table.id === tableId);
      const nextSeatIndex = targetTable?.assignedGuestIds.length ?? 0;
      const nextGuests = currentState.guests.map((guest) =>
        guest.id === guestId ? { ...guest, tableId, seatIndex: nextSeatIndex } : guest
      );
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
    setState((currentState) => {
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
    setState((currentState) => {
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
    setState((currentState) => {
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
    setState({
      hasLocalProject: false,
      wedding: sampleWedding,
      timelineItems: createTimelineDraft(timelineItems),
      musicCues: createMusicCueDraft(musicCues),
      speeches: createSpeechDraft(speeches),
      guests: createGuestDraft(guests),
      dinnerTables: createDinnerTableDraft(dinnerTables),
      vendorCandidates: [],
      updatedAt: undefined
    });
  }

  return {
    ...state,
    updateTimelineItems,
    updateMusicCue,
    resetMusicCues,
    updateSpeech,
    resetSpeeches,
    updateGuest,
    updateDinnerTable,
    assignGuestToTable,
    resetReception,
    addVendorCandidate,
    updateVendorCandidate,
    resetLocalProject
  };
}
