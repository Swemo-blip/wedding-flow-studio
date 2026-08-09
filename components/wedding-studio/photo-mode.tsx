"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
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
  | { kind: "building"; fraction: number }
  | { kind: "sampling"; fraction: number }
  | { kind: "done" }
  | { kind: "failed" };

const TARGET_SAMPLES = 110;
// An instanced mesh with more members than this is a crowd, not a prop: hidden for
// the trace. The couple's own two-seat instance and the small prop instances stay.
const PHOTO_INSTANCE_LIMIT = 8;

// Reported to the console before the trace so a slow photo can be diagnosed by
// SIZE rather than by guesswork — the first two attempts were debugged blind.
function countTriangles(root: THREE.Object3D) {
  let total = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh & { isInstancedMesh?: boolean; count?: number };
    if (!mesh.isMesh || !object.visible || !mesh.geometry) {
      return;
    }
    const index = mesh.geometry.getIndex();
    const position = mesh.geometry.getAttribute("position");
    const per = index ? index.count / 3 : position ? position.count / 3 : 0;
    total += per * (mesh.isInstancedMesh ? (mesh.count ?? 1) : 1);
  });
  return Math.round(total);
}

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
    let restoreVisibility: (() => void) | null = null;
    restoreRef.current = frameloop === "never" ? "always" : frameloop;
    setFrameloop("never");
    onPhase({ kind: "building", fraction: 0 });

    (async () => {
      try {
        // GenerateMeshBVHWorker, not ParallelMeshBVHWorker: the parallel variant
        // needs SharedArrayBuffer, which needs cross-origin isolation headers this
        // app does not serve (and GitHub Pages cannot). One worker thread is still
        // the whole fix — the build leaves the main thread.
        const [{ WebGLPathTracer }, { GenerateMeshBVHWorker }] = await Promise.all([
          import("three-gpu-pathtracer"),
          import("three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js")
        ]);
        if (cancelled) {
          return;
        }

        const pathTracer = new WebGLPathTracer(gl);
        tracer = pathTracer;
        // Round two moved the BVH build to a worker and the tab STILL froze, because
        // the cost is not the BVH: setSceneAsync's StaticGeometryGenerator expands
        // every InstancedMesh into one flat multi-million-vertex geometry, on the
        // main thread, and no worker in the library moves that part.
        //
        // Round three therefore hands the tracer LESS SCENE. The photo is of the
        // room, the couple and the dressing — a hundred instanced background guests
        // contribute almost nothing to a frame they are barely visible in, and they
        // are the entire cost. Everything skipped is named in PHOTO_SKIP so the
        // exclusion is auditable rather than a mystery.
        pathTracer.setBVHWorker(new GenerateMeshBVHWorker());
        pathTracer.bounces = 4;
        pathTracer.renderScale = 0.85;
        // 3x3 tiles keep each renderSample call short enough that the page stays
        // responsive while the photo develops.
        pathTracer.tiles.set(3, 3);

        // THE ACTUAL BLOCKER, found by reading the error instead of assuming:
        // MaterialsTexture.updateFrom threw "Cannot read properties of undefined
        // (reading 'r')" — the tracer walks every material expecting the physical
        // set (color, emissive, roughness…) and dies on anything that does not have
        // them. Our scene contains three such: the raw ShaderMaterial driving the
        // light shafts, the PointsMaterial on the dust motes, and any sprite.
        // They are all atmosphere, none of them is geometry a photo needs, and
        // hidden objects are skipped by the geometry generator entirely.
        //
        // Size was never the failure here: the console reports 1.5 M triangles and
        // the main thread's worst stall through the whole build was 625 ms.
        const hidden: THREE.Object3D[] = [];
        const hide = (object: THREE.Object3D) => {
          if (object.visible) {
            object.visible = false;
            hidden.push(object);
          }
        };
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh & { isPoints?: boolean; isSprite?: boolean; isInstancedMesh?: boolean; count?: number };
          if (mesh.isPoints || mesh.isSprite) {
            hide(object);
            return;
          }
          const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          // A raw ShaderMaterial carries none of the properties the tracer reads.
          if (materials.some((material) => (material as THREE.Material).type === "ShaderMaterial")) {
            hide(object);
            return;
          }
          // Crowd instances are still skipped, but as a SPEED choice rather than a
          // correctness one — and only when they are genuinely a crowd.
          if (mesh.isInstancedMesh && (mesh.count ?? 0) > PHOTO_INSTANCE_LIMIT) {
            hide(object);
          }
        });
        restoreVisibility = () => {
          for (const object of hidden) {
            object.visible = true;
          }
        };

        // Dump the material CENSUS before tracing. The blocker is a material the
        // tracer cannot read, so the next attempt should start by looking at this
        // line rather than re-deriving it: it names every material type still in
        // the trace and how many meshes carry it.
        const census = new Map<string, number>();
        scene.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh || !object.visible) {
            return;
          }
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const type = (material as THREE.Material | undefined)?.type ?? "none";
            census.set(type, (census.get(type) ?? 0) + 1);
          }
        });
        const counted = countTriangles(scene);
        console.info(
          `Photo mode: tracing ${counted.toLocaleString()} triangles, ${hidden.length} object(s) hidden. Materials: ` +
            [...census.entries()].map(([type, count]) => `${type} x${count}`).join(", ")
        );

        await pathTracer.setSceneAsync(scene, camera, {
          onProgress: (fraction: number) => {
            if (!cancelled) {
              onPhase({ kind: "building", fraction });
            }
          }
        });
        restoreVisibility();
        restoreVisibility = null;
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
      } catch (error) {
        restoreVisibility?.();
        restoreVisibility = null;
        // A scene the tracer cannot ingest must degrade to a message, never to a
        // black canvas: restore the live render immediately. Logged, because a
        // silent catch cost a debugging round on 2026-08-09.
        console.error("Photo mode failed:", error);
        if (!cancelled) {
          onPhase({ kind: "failed" });
          setFrameloop(restoreRef.current);
        }
      }
    })();

    return () => {
      cancelled = true;
      restoreVisibility?.();
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
