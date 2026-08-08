"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

// Photo mode: hand the live canvas to a path tracer and let a real global-
// illumination render accumulate — soft bounced shadows, true light transport —
// of the couple's ACTUAL plan, from the camera they are looking through.
//
// This is the honest route to the word "photorealistic" in this product: not a
// stock picture pretending to be their wedding, but their own scene, lit the way
// an offline renderer lights it. The library (three-gpu-pathtracer, MIT) is
// imported lazily so the ~300KB chunk never loads until the first photo.
//
// The R3F frame loop must STOP while this runs — its rasterized frame would
// overwrite every accumulated sample — so the loop is set to "never" on entry
// and restored on exit. Sampling is driven by setTimeout, not rAF, so a photo
// keeps developing even if the tab is backgrounded mid-render.
export type PhotoPhase =
  | { kind: "building" }
  | { kind: "sampling"; fraction: number }
  | { kind: "done" }
  | { kind: "failed" };

const TARGET_SAMPLES = 140;

export function PhotoMode({ active, onPhase }: { active: boolean; onPhase: (phase: PhotoPhase) => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const setFrameloop = useThree((state) => state.setFrameloop);
  const frameloop = useThree((state) => state.frameloop);
  // The loop mode to restore is captured when the photo STARTS, not at cleanup
  // time — by cleanup the stored value would already be our own "never".
  const restoreRef = useRef(frameloop);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    let tracer: { dispose: () => void } | null = null;
    restoreRef.current = frameloop === "never" ? "always" : frameloop;
    setFrameloop("never");
    onPhase({ kind: "building" });

    (async () => {
      try {
        const { WebGLPathTracer } = await import("three-gpu-pathtracer");
        if (cancelled) {
          return;
        }

        const pathTracer = new WebGLPathTracer(gl);
        tracer = pathTracer;
        pathTracer.bounces = 5;
        pathTracer.renderScale = 1;
        // 3x3 tiles keep each renderSample call short enough that the page stays
        // responsive while the photo develops.
        pathTracer.tiles.set(3, 3);
        await pathTracer.setSceneAsync(scene, camera);
        if (cancelled) {
          return;
        }

        const step = () => {
          if (cancelled) {
            return;
          }
          pathTracer.renderSample();
          if (pathTracer.samples < TARGET_SAMPLES) {
            onPhase({ kind: "sampling", fraction: pathTracer.samples / TARGET_SAMPLES });
            timer = window.setTimeout(step, 0);
          } else {
            onPhase({ kind: "done" });
          }
        };
        step();
      } catch {
        // A scene the tracer cannot ingest must degrade to a message, never to a
        // black canvas: restore the live render immediately.
        if (!cancelled) {
          onPhase({ kind: "failed" });
          setFrameloop(restoreRef.current);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      tracer?.dispose();
      setFrameloop(restoreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when toggled
  }, [active]);

  return null;
}
