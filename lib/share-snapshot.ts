import { assetPath } from "@/lib/asset-path";
import type { CeremonyStaging, StudioSceneEdits, WeddingStudioPlan } from "@/lib/wedding-studio-plan";
import type { Guest, TimelineItem, Wedding } from "@/lib/wedding-types";

// A shareable read-only snapshot of a plan, encoded into the URL hash so a
// recipient sees the SENDER's plan — not their own localStorage. Everything is
// client-side and survives static hosting (the hash never reaches a server), so
// no backend is needed. Kept lean (facts + run of show + guest counts + the room,
// no photos) to stay within URL-length limits.
//
// THE ROOM IS THE POINT, and it was missing until 2026-08-18. This snapshot
// carried names, dates, locations and a timeline — a text itinerary. Meanwhile the
// product's one differentiated answer (who can actually see the ceremony) existed
// only inside the couple's own studio, on the surface nobody else opens. A venue,
// a photographer and a planner all need the ROOM: where the seats are, where the
// couple stand, how far the back row is. That is what `room` adds.
//
// MEASURED, because the first version of this comment guessed and was wrong: the
// room as written costs 773 characters of hash, taking a typical link from 1950 to
// 2723. Well inside what a browser accepts, but long to paste into a message — and
// most of it was zeroes, since eleven of those fields are offsets that only move if
// the couple drags something. Packing drops every offset that is still (0, 0), so a
// plain plan costs about a third of that and the link only lengthens for a couple
// who actually rearranged the room. See packRoom below.

export const SHARE_HASH_KEY = "plan";

// The room, as the studio's three persisted slices. Deliberately the same shapes
// the studio already stores, so there is no third definition of "the plan" to
// drift: the sender writes what it has and the recipient rebuilds the same seats
// from the same arithmetic (lib/church-seating.ts).
export type ShareRoom = {
  plan: WeddingStudioPlan;
  sceneEdits: StudioSceneEdits;
  staging: CeremonyStaging;
};

// What actually travels: the same room with every untouched offset left out. It is
// a wire format, not a second model — packRoom/unpackRoom are the only code that
// ever sees it, and unpackRoom fills the gaps from the studio's own defaults so a
// recipient always holds a complete ShareRoom.
type PackedOffset = { x?: number; z?: number };
type PackedRoom = {
  plan: WeddingStudioPlan;
  sceneEdits?: Record<string, PackedOffset>;
  staging?: {
    groomStart?: CeremonyStaging["groomStart"];
    marks?: Record<string, PackedOffset>;
    showSinger?: boolean;
  };
};

function packOffsets(offsets: Record<string, { x: number; z: number }>) {
  const packed: Record<string, PackedOffset> = {};
  for (const [key, offset] of Object.entries(offsets)) {
    const entry: PackedOffset = {};
    if (offset.x !== 0) {
      entry.x = offset.x;
    }
    if (offset.z !== 0) {
      entry.z = offset.z;
    }
    if (entry.x !== undefined || entry.z !== undefined) {
      packed[key] = entry;
    }
  }
  return packed;
}

function unpackOffsets<T extends Record<string, { x: number; z: number }>>(defaults: T, packed?: Record<string, PackedOffset>): T {
  const result = {} as Record<string, { x: number; z: number }>;
  for (const [key, fallback] of Object.entries(defaults)) {
    const offset = packed?.[key];
    result[key] = { x: offset?.x ?? fallback.x, z: offset?.z ?? fallback.z };
  }
  return result as T;
}

export function packRoom(room: ShareRoom): PackedRoom {
  const sceneEdits = packOffsets(room.sceneEdits);
  const marks = packOffsets(room.staging.marks);
  const staging: PackedRoom["staging"] = {};
  // Only the non-default half of staging travels, for the same reason: a couple who
  // never opened the staging panel should not pay URL for it.
  if (room.staging.groomStart !== "aisle") {
    staging.groomStart = room.staging.groomStart;
  }
  if (room.staging.showSinger) {
    staging.showSinger = true;
  }
  if (Object.keys(marks).length > 0) {
    staging.marks = marks;
  }
  return {
    plan: room.plan,
    ...(Object.keys(sceneEdits).length > 0 ? { sceneEdits } : {}),
    ...(Object.keys(staging).length > 0 ? { staging } : {})
  };
}

export function unpackRoom(packed: PackedRoom, defaults: { sceneEdits: StudioSceneEdits; staging: CeremonyStaging }): ShareRoom {
  return {
    plan: packed.plan,
    sceneEdits: unpackOffsets(defaults.sceneEdits, packed.sceneEdits),
    staging: {
      groomStart: packed.staging?.groomStart ?? "aisle",
      marks: unpackOffsets(defaults.staging.marks, packed.staging?.marks),
      showSinger: packed.staging?.showSinger === true
    }
  };
}

export type ShareSnapshot = {
  v: 1;
  wedding: Pick<Wedding, "coupleNames" | "date" | "ceremonyLocation" | "receptionLocation" | "guestCount" | "style">;
  timeline: Array<Pick<TimelineItem, "time" | "title" | "location" | "phase">>;
  guests: { attending: number; invited: number };
  // Optional on purpose: every link shared before this existed must keep opening.
  // The shared page renders the room only when it is present, rather than
  // inventing a default church — a plan shown to a vendor has to be the couple's
  // own or absent, never a plausible stand-in.
  room?: PackedRoom;
};

export function buildShareSnapshot(input: {
  guests: Guest[];
  room?: ShareRoom;
  timelineItems: TimelineItem[];
  wedding: Wedding;
}): ShareSnapshot {
  return {
    v: 1,
    // No guest names, notes or RSVP detail travel with the room: church seats are
    // anonymous in the model (`church-guest-<row>-<x>-<seat>`), so the plan a
    // vendor opens says where a body sits and never who it is.
    ...(input.room ? { room: packRoom(input.room) } : {}),
    wedding: {
      coupleNames: input.wedding.coupleNames,
      date: input.wedding.date,
      ceremonyLocation: input.wedding.ceremonyLocation,
      receptionLocation: input.wedding.receptionLocation,
      guestCount: input.wedding.guestCount,
      style: input.wedding.style
    },
    // ONLY moments marked for everyone. The share link is opened by guests, and
    // this used to publish the whole timeline verbatim — so a moment the couple
    // deliberately marked "secret" (a surprise speech, a surprise send-off) was
    // handed straight to the people it was meant to surprise. Every other
    // visibility (couple, partnerOne/Two, toastmaster, planner, vendor, secret)
    // is internal by definition, so the guest-safe rule is a strict allow-list:
    // a new visibility value can never leak by being forgotten here.
    timeline: input.timelineItems
      .filter((item) => item.visibility === "everyone")
      .map((item) => ({
        time: item.time,
        title: item.title,
        location: item.location,
        phase: item.phase
      })),
    guests: {
      invited: input.guests.length,
      attending: input.guests.filter((guest) => guest.rsvpStatus === "attending").length
    }
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// The payload is small (facts + a ~20-line run of show, no photos), so we skip
// compression and encode synchronously as base64url of the utf-8 JSON. Sync
// keeps the clipboard write inside the user gesture and avoids async state.
export function encodeSnapshot(snapshot: ShareSnapshot): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(snapshot)));
}

export function decodeSnapshot(payload: string): ShareSnapshot | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(json) as ShareSnapshot;
    return parsed && parsed.v === 1 && parsed.wedding ? parsed : null;
  } catch {
    return null;
  }
}

export function buildShareUrl(payload: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${assetPath("/shared/")}#${SHARE_HASH_KEY}=${payload}`;
}

export function readShareHash(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.hash.match(new RegExp(`${SHARE_HASH_KEY}=(.+)$`));
  return match ? match[1] : null;
}
