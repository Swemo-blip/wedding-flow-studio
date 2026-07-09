"use client";

import { useEffect, useState } from "react";
import { safeSetItem } from "@/lib/persistence-status";

export type ChecklistTask = {
  id: string;
  title: string;
  phase: string;
  done: boolean;
};

const STORAGE_KEY = "wedding-flow-studio.checklist.v1";

// Ordered planning phases, counting down to the day. Source strings stay English
// and are translated for display via t().
export const CHECKLIST_PHASES = ["12+ months", "9 months", "6 months", "3 months", "1 month", "Final week", "Day of"];

// Maps a vendor sourcing category id (see lib/vendor-sourcing) to the seeded
// checklist task that booking such a vendor completes. Forward-only: booking
// marks the task done, un-booking never un-checks it. Categories without a
// matching seeded task are intentionally absent.
export const VENDOR_CATEGORY_TO_CHECKLIST_TASK: Record<string, string> = {
  catering: "c-cater",
  dj: "c-music",
  "live-singer": "c-music",
  "music-equipment": "c-music",
  cake: "c-cake"
};

const DEFAULT_CHECKLIST: ChecklistTask[] = [
  { id: "c-date", title: "Set the date", phase: "12+ months", done: true },
  { id: "c-budget", title: "Agree a budget", phase: "12+ months", done: true },
  { id: "c-venue", title: "Book the venue", phase: "12+ months", done: true },
  { id: "c-guests", title: "Draft the guest list", phase: "12+ months", done: false },
  { id: "c-photo", title: "Book photographer & videographer", phase: "9 months", done: true },
  { id: "c-cater", title: "Book the caterer", phase: "9 months", done: false },
  { id: "c-party", title: "Choose the wedding party", phase: "9 months", done: false },
  { id: "c-save", title: "Send save-the-dates", phase: "6 months", done: false },
  { id: "c-music", title: "Book music & band", phase: "6 months", done: false },
  { id: "c-florist", title: "Book the florist", phase: "6 months", done: false },
  { id: "c-invites", title: "Order invitations", phase: "3 months", done: false },
  { id: "c-tasting", title: "Menu tasting", phase: "3 months", done: false },
  { id: "c-cake", title: "Order the cake", phase: "3 months", done: false },
  { id: "c-send", title: "Send invitations", phase: "1 month", done: false },
  { id: "c-seating", title: "Finalize the seating chart", phase: "1 month", done: false },
  { id: "c-vows", title: "Write the vows", phase: "1 month", done: false },
  { id: "c-headcount", title: "Confirm headcount to caterer", phase: "Final week", done: false },
  { id: "c-fitting", title: "Final dress & suit fitting", phase: "Final week", done: false },
  { id: "c-rehearsal", title: "Rehearsal & rehearsal dinner", phase: "Final week", done: false },
  { id: "c-rings", title: "Hand rings to the best man", phase: "Day of", done: false },
  { id: "c-timeline", title: "Give the timeline to the coordinator", phase: "Day of", done: false }
];

function readStoredChecklist(): ChecklistTask[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ChecklistTask[]) : null;
  } catch {
    return null;
  }
}

function writeStoredChecklist(tasks: ChecklistTask[]) {
  safeSetItem(STORAGE_KEY, JSON.stringify(tasks));
}

// Checklist progress lives outside the project blob, so a full "Start over"
// must clear it too or the new couple inherits the old checked-off tasks.
export function clearStoredChecklist() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function useChecklist() {
  const [tasks, setTasks] = useState<ChecklistTask[]>(DEFAULT_CHECKLIST);

  useEffect(() => {
    const stored = readStoredChecklist();
    if (stored) {
      queueMicrotask(() => setTasks(stored));
    }
  }, []);

  function persist(next: ChecklistTask[]) {
    setTasks(next);
    writeStoredChecklist(next);
  }

  function toggleTask(id: string) {
    persist(tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  // Idempotent set-done, used by cross-module links (e.g. booking a vendor
  // completes its checklist task) where a toggle would be unsafe.
  function markTaskDone(id: string) {
    persist(tasks.map((task) => (task.id === id ? { ...task, done: true } : task)));
  }

  function updateTask(id: string, title: string) {
    persist(tasks.map((task) => (task.id === id ? { ...task, title } : task)));
  }

  function addTask(phase: string) {
    persist([...tasks, { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: "New task", phase, done: false }]);
  }

  function removeTask(id: string) {
    persist(tasks.filter((task) => task.id !== id));
  }

  return { tasks, toggleTask, markTaskDone, updateTask, addTask, removeTask };
}
