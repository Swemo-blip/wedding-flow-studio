import { assetPath } from "@/lib/asset-path";
import type { Guest, TimelineItem, Wedding } from "@/lib/wedding-types";

// A shareable read-only snapshot of a plan, encoded into the URL hash so a
// recipient sees the SENDER's plan — not their own localStorage. Everything is
// client-side and survives static hosting (the hash never reaches a server), so
// no backend is needed. Kept lean (facts + run of show + guest counts, no
// photos) to stay within URL-length limits.

export const SHARE_HASH_KEY = "plan";

export type ShareSnapshot = {
  v: 1;
  wedding: Pick<Wedding, "coupleNames" | "date" | "ceremonyLocation" | "receptionLocation" | "guestCount" | "style">;
  timeline: Array<Pick<TimelineItem, "time" | "title" | "location" | "phase">>;
  guests: { attending: number; invited: number };
};

export function buildShareSnapshot(input: { guests: Guest[]; timelineItems: TimelineItem[]; wedding: Wedding }): ShareSnapshot {
  return {
    v: 1,
    wedding: {
      coupleNames: input.wedding.coupleNames,
      date: input.wedding.date,
      ceremonyLocation: input.wedding.ceremonyLocation,
      receptionLocation: input.wedding.receptionLocation,
      guestCount: input.wedding.guestCount,
      style: input.wedding.style
    },
    timeline: input.timelineItems.map((item) => ({
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
