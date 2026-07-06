"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { useTranslation } from "@/lib/i18n";

// The R3F Canvas used to mount while its assets were still suspending, which
// (on R3F v9) rethrows to the outer DOM Suspense and remounts the whole Canvas
// — the scene compiled its shaders up to 8 times in a row and the stage sat as
// a blank rectangle for 20s+. The fix is twofold: cache the HDR environment at
// module level (below) and gate the Canvas mount behind this boot gate so the
// scene mounts exactly once, against warm caches, behind a real loading state.

const hdrCache = new Map<string, Promise<THREE.DataTexture>>();

// Loads (and caches) an equirect HDR through the default loading manager so
// drei's useProgress sees it as part of the boot. The texture is shared —
// consumers must never dispose it.
export function preloadHdr(url: string): Promise<THREE.DataTexture> {
  let cached = hdrCache.get(url);

  if (!cached) {
    cached = new RGBELoader().loadAsync(url);
    hdrCache.set(url, cached);
  }

  return cached;
}

type SceneBootGateProps = {
  children: ReactNode;
};

// Renders the branded loading treatment until every tracked asset (GLBs +
// HDR) has finished loading, then mounts the scene once. A hard cap ensures
// we never gate forever if a loader stalls or nothing needed loading.
export function SceneBootGate({ children }: SceneBootGateProps) {
  const { active, progress } = useProgress();
  const { t } = useTranslation();
  const [booted, setBooted] = useState(false);

  // Hard cap, independent of loader-state quirks: the Canvas always mounts —
  // exactly once — within a few seconds, even if the loading manager never
  // reports idle (assets keep streaming in after mount at worst).
  useEffect(() => {
    const cap = window.setTimeout(() => setBooted(true), 6500);
    return () => window.clearTimeout(cap);
  }, []);

  // Fast path: the loading manager went idle (or reported done) — give
  // in-flight work a short beat to register, then mount for good.
  useEffect(() => {
    if (booted) {
      return;
    }

    if (!active || progress >= 100) {
      const settle = window.setTimeout(() => setBooted(true), 300);
      return () => window.clearTimeout(settle);
    }
  }, [active, booted, progress]);

  if (booted) {
    return <>{children}</>;
  }

  return (
    <div aria-live="polite" className="scene-boot" role="status">
      <span className="scene-boot-monogram">WF</span>
      <span className="scene-boot-label">{t("Setting the scene…")}</span>
      <span aria-hidden="true" className="scene-boot-track">
        <span className="scene-boot-bar" style={{ width: `${Math.max(6, Math.round(progress))}%` }} />
      </span>
    </div>
  );
}
