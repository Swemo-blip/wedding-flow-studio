// Render probe for the 3D scene. Paste the whole file into the browser
// (javascript_tool / devtools console) while the view you care about is open:
//
//   Read scripts/scene-probe.js  →  javascript_tool with its contents
//
// It answers ONE question — is this view actually rendering? — and it answers it
// from pixels, not from a counter read at a moment of its own choosing.
//
// Why this file exists. On 2026-08-01 the same mistake was made twice in one
// session, and both times a wrong conclusion was reported to the owner:
//
//   * `gl.info.render.frame` was read once, at 23, and the render loop was
//     declared frozen. It was mid-load. It climbed to 50 338.
//   * `gl.info.render.calls` was read as 1 with 12 triangles and the scene was
//     declared entirely frustum-culled. `info` is RESET at the start of every
//     renderer.render(), so that sample was one composer pass. The real numbers
//     were 777 calls and 311 819 triangles.
//
// Both are avoided below: the frame counter is polled until it stops changing
// shape, and the draw count is taken with autoReset disabled around a single
// explicit render. Never hand-roll either check again.
(async () => {
  const SAMPLE_W = 160;
  const SAMPLE_H = 90;
  // A flat fill quantises to a handful of buckets; the church interior measured
  // well into the hundreds. 12 keeps a legitimately dim or foggy frame from being
  // called blank while still catching "background only".
  const BLANK_BUCKET_LIMIT = 12;
  const MOUNT_TIMEOUT_MS = 45000;
  const SETTLE_TIMEOUT_MS = 60000;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Wait for the scene to mount at all. Absent hook is its own verdict: the
  //    scene is not there yet, which is NOT the same as rendering nothing.
  let waitedForMount = 0;
  while (!window.__wfsScene && waitedForMount < MOUNT_TIMEOUT_MS) {
    await sleep(1000);
    waitedForMount += 1000;
  }
  if (!window.__wfsScene) {
    return {
      verdict: "NOT_MOUNTED",
      detail: `window.__wfsScene absent after ${waitedForMount} ms — the scene never mounted. Check the console for a compile error before concluding anything about the render.`,
      waitedForMountMs: waitedForMount
    };
  }

  const { gl, scene, camera } = window.__wfsScene;
  const canvas = gl.domElement;

  // 2. Poll the frame counter until it stops climbing (loaded and steady) or
  //    stops moving entirely (genuinely stalled). One sample proves nothing.
  let waitedForSettle = 0;
  let previous = -1;
  let climbing = 0;
  let stalledReads = 0;
  while (waitedForSettle < SETTLE_TIMEOUT_MS) {
    await sleep(1000);
    waitedForSettle += 1000;
    const current = gl.info.render.frame;
    if (current > previous) {
      climbing += 1;
      stalledReads = 0;
    } else {
      stalledReads += 1;
      climbing = 0;
    }
    previous = current;
    // Three consecutive climbs past a warm-up threshold means the loop is live.
    if (climbing >= 3 && current > 300) break;
    // Four consecutive flat reads means it really is not advancing.
    if (stalledReads >= 4) break;
  }

  const frameStart = gl.info.render.frame;
  await sleep(600);
  const frameEnd = gl.info.render.frame;
  const loopLive = frameEnd > frameStart;

  // 3. True draw counts. info is reset per render(), so disable autoReset,
  //    reset once, render once, read, and always restore.
  const autoResetWas = gl.info.autoReset;
  let drawCalls = null;
  let triangles = null;
  try {
    gl.info.autoReset = false;
    gl.info.reset();
    gl.render(scene, camera);
    drawCalls = gl.info.render.calls;
    triangles = gl.info.render.triangles;
  } finally {
    gl.info.reset();
    gl.info.autoReset = autoResetWas;
  }

  // 4. Pixels are the ground truth. The canvas is created with
  //    preserveDrawingBuffer, so it can be drawn into a 2D context directly.
  const sample = document.createElement("canvas");
  sample.width = SAMPLE_W;
  sample.height = SAMPLE_H;
  const context = sample.getContext("2d");
  context.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H);
  const pixels = context.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

  const buckets = new Set();
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let luminanceMin = 255;
  let luminanceMax = 0;
  const pixelCount = pixels.length / 4;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    redSum += red;
    greenSum += green;
    blueSum += blue;
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    if (luminance < luminanceMin) luminanceMin = luminance;
    if (luminance > luminanceMax) luminanceMax = luminance;
    buckets.add(`${red >> 4},${green >> 4},${blue >> 4}`);
  }

  let meshes = 0;
  scene.traverse((object) => {
    if (object.isMesh || object.isInstancedMesh) meshes += 1;
  });

  const blank = buckets.size < BLANK_BUCKET_LIMIT;
  const verdict = blank ? (loopLive ? "BLANK_BUT_LOOPING" : "BLANK_AND_STALLED") : "RENDERING";

  return {
    verdict,
    detail:
      verdict === "RENDERING"
        ? "Pixels vary across the frame — this view is drawing its scene."
        : verdict === "BLANK_BUT_LOOPING"
          ? "The loop advances but the frame is near-uniform: the scene is drawing nothing into it. Look for a camera outside the geometry, or a scene still loading."
          : "The frame is near-uniform AND the loop is not advancing. Check the console for errors and confirm the WebGL context is not lost.",
    loopLive,
    frameStart,
    frameEnd,
    drawCalls,
    triangles,
    meshes,
    distinctColourBuckets: buckets.size,
    meanRGB: [Math.round(redSum / pixelCount), Math.round(greenSum / pixelCount), Math.round(blueSum / pixelCount)],
    luminanceSpread: Math.round(luminanceMax - luminanceMin),
    cameraPosition: camera.position.toArray().map((value) => Number(value.toFixed(2))),
    contextLost: gl.getContext().isContextLost(),
    canvasSize: [canvas.width, canvas.height],
    waitedForMountMs: waitedForMount,
    waitedForSettleMs: waitedForSettle
  };
})();
