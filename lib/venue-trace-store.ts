import { safeSetItem } from "@/lib/persistence-status";
import type { VenueTrace } from "@/lib/venue-trace";

// The traced venue lives in its OWN record, separate from the studio layout.
//
// Two reasons, and both are about the image rather than the geometry. The plan
// image is hundreds of kilobytes where the whole layout record is 633 bytes, so
// folding it in would make every ordinary studio save carry a photograph. And the
// layout record is what the share link packs — an image must never travel in a URL.
//
// So: the geometry is small and shareable, the image is large and stays on the
// device that traced it. A vendor opening the link gets a clean drawing of the
// room, not the couple's phone photo of a printout taped to a wall.

export const venueTraceStorageKey = "wedding-flow-studio.venue.v1";

export type StoredVenueTrace = {
  // The image's pixel size, recorded rather than re-derived. The trace's
  // coordinates ARE these pixels, so the size is part of the record's meaning —
  // and decoding the image again just to measure it would be both slower and a
  // second source of truth for the one number everything else is scaled by.
  height: number;
  // A data URL. Downscaled before it ever reaches here — see MAX_IMAGE_EDGE.
  image: string | null;
  trace: VenueTrace | null;
  updatedAt: string;
  width: number;
};

// Long edge, in pixels, after downscaling. A floor plan is line art: 1600 px holds
// every wall a person needs to click while keeping the encoded string near 300 KB,
// which localStorage can hold alongside everything else. The trace is stored in
// THESE pixels, so the same image must be shown back at the same size.
export const MAX_IMAGE_EDGE = 1600;

export function readStoredVenueTrace(): StoredVenueTrace | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(venueTraceStorageKey);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredVenueTrace>;
    if (!(typeof parsed.width === "number" && parsed.width > 0 && typeof parsed.height === "number" && parsed.height > 0)) {
      return null;
    }
    return {
      height: parsed.height,
      image: typeof parsed.image === "string" ? parsed.image : null,
      trace: parsed.trace && parsed.trace.v === 1 ? parsed.trace : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      width: parsed.width
    };
  } catch {
    return null;
  }
}

export function writeStoredVenueTrace(next: { height: number; image: string | null; trace: VenueTrace | null; width: number }) {
  if (typeof window === "undefined") {
    return null;
  }
  const record: StoredVenueTrace = { ...next, updatedAt: new Date().toISOString() };
  safeSetItem(venueTraceStorageKey, JSON.stringify(record));
  return record;
}

export function clearStoredVenueTrace() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(venueTraceStorageKey);
}

/**
 * Read a chosen file into a downscaled data URL, and report the pixel size the
 * trace will be recorded against.
 *
 * Downscaling here rather than at draw time is deliberate: the trace's coordinates
 * ARE these pixels, so the image must never be resampled again afterwards or every
 * wall the couple clicked would drift.
 */
export function loadPlanImage(file: File): Promise<{ height: number; image: string; width: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("could not read the file"));
    reader.onload = () => {
      const source = new Image();
      source.onerror = () => reject(new Error("that file is not an image"));
      source.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
        const width = Math.round(source.width * scale);
        const height = Math.round(source.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("no canvas"));
          return;
        }
        // White underneath: floor plans arrive as transparent PNGs often enough,
        // and black-on-transparent becomes black-on-black in a dark viewer.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(source, 0, 0, width, height);
        resolve({ height, image: canvas.toDataURL("image/jpeg", 0.82), width });
      };
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
