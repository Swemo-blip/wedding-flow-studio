"use client";

// Single choke point for every localStorage write in the app. Two jobs:
// 1) never let a failed write (quota exceeded, Safari private mode, disabled
//    storage) throw — a thrown setItem inside a React state updater crashes the
//    whole route mid-edit.
// 2) report success/failure so the header can tell the truth about whether the
//    couple's work is actually saved, instead of always claiming "saved".

export type PersistenceState = {
  ok: boolean;
  reason: "quota" | "unavailable" | null;
};

let state: PersistenceState = { ok: true, reason: null };
const listeners = new Set<(next: PersistenceState) => void>();

function emit(next: PersistenceState) {
  if (next.ok === state.ok && next.reason === state.reason) {
    return;
  }
  state = next;
  for (const listener of listeners) {
    listener(state);
  }
}

export function getPersistenceState(): PersistenceState {
  return state;
}

export function subscribePersistence(listener: (next: PersistenceState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Write a value, catching any failure. Returns true only if the value was
// actually committed to storage. Callers keep their in-memory state either way.
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    emit({ ok: true, reason: null });
    return true;
  } catch (error) {
    const reason =
      error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ? "quota"
        : "unavailable";
    emit({ ok: false, reason });
    return false;
  }
}
