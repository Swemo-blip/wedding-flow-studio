"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

// A development-only way to get a rendered frame out of a tab nobody is looking at.
//
// The problem it solves, measured repeatedly on 2026-08-03/04: Chrome pauses
// requestAnimationFrame in a hidden tab, R3F's loop rides on rAF, so the scene stops
// rendering and every screenshot and toDataURL returns the un-rendered boot state.
// An agent reviewing this project cannot keep a tab in the foreground — the person it
// is talking to is looking at the conversation — so 3D changes were effectively
// unverifiable, and that is how an aisle stayed 0.30 units out of line long enough
// for the owner to find it himself.
//
// The renderer does not need rAF. Only the loop does. So this drives frames from a
// setTimeout, which keeps running while hidden, and publishes the pieces needed to
// measure a frame: the canvas, the renderer, the scene and the camera.
//
// WHAT IT CANNOT DO, established by measurement on 2026-08-04 so nobody repeats the
// attempt: it cannot bootstrap a scene in a tab that has never been visible. R3F's
// Canvas sizes itself through ResizeObserver, and a background tab is never given a
// measurement, so the canvas sits at its 300x150 default and the scene — including
// this component — never mounts. That was true even in a tab whose document had real
// layout (clientWidth 1470), which is what ruled out the layout explanation.
//
// So the working loop is: the owner opens the view ONCE, which is all R3F needs to
// measure and mount. After that this bridge can draw a fresh frame on demand for the
// rest of the session, from a hidden tab, reflecting whatever state changed since —
// which is the part that was missing before, when only a stale buffer was readable.
//
// STRICTLY development-only, twice over: the whole component returns null unless
// NODE_ENV is "development", and inside that it only starts a loop when the page is
// opened with ?agentrender=1. It can never run for a couple.
export function RenderBridge() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const advance = useThree((state) => state.advance);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const target = window as unknown as { __wfs3d?: unknown };
    // Published unconditionally in development so a one-off measurement does not
    // need the query flag — reading the scene graph is free, drawing is not.
    target.__wfs3d = {
      camera,
      canvas: gl.domElement,
      gl,
      scene,
      // Draw exactly one frame, synchronously, right now. `advance` is R3F's own
      // escape hatch and keeps useFrame work in step; the direct render is the
      // fallback if a future version drops it.
      drawOnce() {
        if (typeof advance === "function") {
          advance(performance.now(), true);
        } else {
          gl.render(scene, camera);
        }
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get("agentrender") !== "1") {
      return;
    }

    // 4 fps is enough to settle a damped camera and stream in textures, and cheap
    // enough that a forgotten tab costs nothing noticeable.
    const timer = window.setInterval(() => {
      if (typeof advance === "function") {
        advance(performance.now(), true);
      } else {
        gl.render(scene, camera);
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [advance, camera, gl, scene]);

  return null;
}
