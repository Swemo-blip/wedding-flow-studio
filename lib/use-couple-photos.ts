"use client";

import { useEffect, useState } from "react";
import { safeSetItem } from "@/lib/persistence-status";

// The couple's uploaded face photos, shown as portraits on the shareable
// summary sheet and in the guest studio. Stored per-role in localStorage
// (browser-only, no backend) under the app prefix, so they ride along in the
// backup file too.
export type CoupleRole = "groom" | "bride";

const key = (role: CoupleRole) => `wedding-flow-studio.couple-photo.${role}`;

function read(role: CoupleRole): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key(role));
  } catch {
    return null;
  }
}

export function useCouplePhotos() {
  const [groom, setGroom] = useState<string | null>(null);
  const [bride, setBride] = useState<string | null>(null);

  // Read after mount (hydration-safe): server + first paint render no photo.
  useEffect(() => {
    queueMicrotask(() => {
      setGroom(read("groom"));
      setBride(read("bride"));
    });
  }, []);

  function setPhoto(role: CoupleRole, dataUrl: string | null) {
    if (role === "groom") {
      setGroom(dataUrl);
    } else {
      setBride(dataUrl);
    }

    if (dataUrl === null) {
      try {
        window.localStorage.removeItem(key(role));
      } catch {
        // ignore
      }
    } else {
      safeSetItem(key(role), dataUrl);
    }
  }

  return { groom, bride, setPhoto };
}
