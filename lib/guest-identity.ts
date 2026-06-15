import type { DinnerTable, Guest, Speech } from "@/lib/wedding-types";

/**
 * A single source of truth for "who this person is across the whole wedding day".
 * Joins a guest to their seat, tablemates, meal/allergies, accessibility, and
 * speaking role so the same identity can be surfaced consistently everywhere
 * (seating, speeches, exports) instead of each surface re-deriving it.
 */
export type GuestProfile = {
  guest: Guest;
  relationToCouple: string;
  rsvpStatus: Guest["rsvpStatus"];
  table: DinnerTable | null;
  seatLabel: string;
  tablemates: Guest[];
  mealChoice: string;
  allergies: string[];
  hasAllergies: boolean;
  accessibilityNotes: string;
  needsClearRoute: boolean;
  speech: Speech | null;
  isSpeaker: boolean;
  tags: string[];
  language: string;
  household: string;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

/** The speech this guest delivers, if any (speeches reference speakers by name). */
export function findGuestSpeech(guest: Guest, speeches: Speech[]): Speech | null {
  const name = normalizeName(guest.name);
  return speeches.find((speech) => normalizeName(speech.speakerName) === name) ?? null;
}

/** The guest behind a speech, if the speaker maps to a tracked individual. */
export function findSpeechGuest(speech: Speech, guests: Guest[]): Guest | null {
  const name = normalizeName(speech.speakerName);
  return guests.find((guest) => normalizeName(guest.name) === name) ?? null;
}

export function buildGuestProfile(
  guest: Guest,
  context: { guests: Guest[]; tables: DinnerTable[]; speeches: Speech[] }
): GuestProfile {
  const table = context.tables.find((candidate) => candidate.id === guest.tableId) ?? null;
  const tablemates = table
    ? context.guests
        .filter((candidate) => candidate.tableId === table.id && candidate.id !== guest.id)
        .sort((a, b) => a.seatIndex - b.seatIndex)
    : [];
  const speech = findGuestSpeech(guest, context.speeches);

  return {
    guest,
    relationToCouple: guest.relationship,
    rsvpStatus: guest.rsvpStatus,
    table,
    seatLabel: table ? `${table.name} · ${guest.seatIndex + 1}` : "Unassigned",
    tablemates,
    mealChoice: guest.mealChoice,
    allergies: guest.allergies,
    hasAllergies: guest.allergies.length > 0,
    accessibilityNotes: guest.accessibilityNotes,
    needsClearRoute: Boolean(guest.accessibilityNotes),
    speech,
    isSpeaker: Boolean(speech),
    tags: guest.tags,
    language: guest.language,
    household: guest.household
  };
}
