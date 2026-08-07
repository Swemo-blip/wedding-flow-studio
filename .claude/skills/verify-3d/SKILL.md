---
name: verify-3d
description: Verify a change to the Wedding Flow Studio 3D scene before committing it. Use whenever adding, resizing or repositioning geometry in church-scene.tsx or dinner-props.tsx, when a figure or prop looks wrong, or when a numeric constant appears to have no effect. Measures the real scale, confirms which server is serving, and frames the exact view that was changed.
---

# Verify a 3D change

Five separate defects shipped in one day because geometry was written from
real-world dimensions and judged from the wrong view. Every one of them was
preventable by the steps below. Work through them in order; do not skip ahead
because a change "looks obviously fine".

## 1. Confirm which server is actually serving

A stale `next start` production build held port 3000 for a whole day. Every reload
returned yesterday's code and every conclusion drawn from it was wrong.

```bash
ps -o lstart=,command= -p $(lsof -ti:3000 | head -1) | cut -c1-70
```

If the start time predates today's edits, or the command is `next-server` rather
than a dev process, kill it and start a fresh dev server before anything else:

```bash
lsof -ti:3000 | xargs -r kill
```

Then start the dev server through the preview tool (never `npm run dev` in Bash).

## 2. Measure the world — never reason from real life

**One scene unit is 1.591 m, and nothing in this world can be sized from
experience.** This section used to say "roughly 0.63 scale" and give the figures in
metres. Both were wrong, and wrong in the direction that costs the most: 0.63 is the
INVERSE of the conversion, so anyone reading this page wrote a metre value into a unit
field. That produced the first-person camera at 2.39 m eye height, 0.64 m above the
crown of the bride it was meant to be, and the couple's photo disc floating clear of
their hair. Corrected 2026-08-06 by measurement; see CLAUDE.md.

The authoritative numbers, in SCENE UNITS with the metric equivalent beside them:

| Thing | Value | Where it comes from |
|---|---|---|
| **One scene unit** | **1.591 m** | 1.10 units measured for a 1.75 m figure |
| Standing figure | **1.10 units** = 1.75 m | bone heights in `figure_suit.glb` |
| Seated guest | **0.82 units** = 1.31 m | geometry 4.001 units x `CONGREGATION_SCALE` 0.205 |
| Hand bone world scale | **23.5** | the armature carries an internal scale of 100 |
| Nave | 10.1 wide, z −6.1 to +6.3 | side walls 12.4 long, centred at z 0.1 |
| Wall height | 5.6 (+1.9 gable at the altar) | `wallHeight` |
| Pew blocks | x ±2.2, rows z −2.4 at 0.62 spacing | `PEW_BLOCK_X` |
| Dinner table | 0.49 units = 0.78 m | `TABLE_HEIGHT` |
| Pew cushion top | 0.2775 units | group y 0.18 + cushion 0.085 + half of 0.025 |
| Dinner chair seat top | 0.308 units | `CHAIR_SEAT_Y` 0.295 + half of 0.026 |

Bone heights can be read **offline**, with no browser, by accumulating node
translations through the parent chain of the GLB — faster and more reliable than
any in-page measurement. Two browser attempts failed where one Python command
worked. There are now three tools for this, and they need no visible tab:

- `npm run check:figures` — `scripts/figure-pose-probe.mjs`. Rebuilds a rig, evaluates
  a pose by forward kinematics, and fails on palm gaps, arm asymmetry, garment
  clearance and any constant that places something above a figure's crown.
  `--fit <pose>` prints body landmarks in scene units; `--solve <pose> <gap>` solves a
  pose numerically instead of by eye.
- `node scripts/seat-contact-probe.mjs --intersect` — counts body vertices inside each
  furniture volume. Use this rather than asking "where does the body rest": that
  question has no stable answer on these meshes (a min() over the seated model's rear
  says 0.194, the lowest hip-wide slice says 0.274, and occupancy is 1-2 of 6 columns
  almost everywhere, so the meshes are too coarse to settle it). Whether mesh is inside
  a box needs no definition.
- `npm run check:colour` — the same discipline for contrast floors.

Scene values that are not in a file come from the dev-only hook:

```js
window.__wfsScene   // { camera, gl, scene, capture(maxWidth, quality) }
```

Traverse for the object, read `getWorldPosition()` / `getWorldScale()`, and derive
the new dimension as a **proportion of the measured figure**. Write the derivation
into a comment next to the constant.

**Beware:** `GLTFLoader` strips dots from node names. A rig authored with
`UpperArm.L` arrives as `UpperArmL`, so a lookup by the authoring name silently
finds nothing. Resolve both spellings.

## 3. Open the exact view that changed

A church screenshot proves nothing about the reception. Changing the dinner means
opening the dinner.

- `/ceremony` — church, with camera presets in the canvas chrome
- `/reception` — the seating editor (its own Canvas and light rig)
- `/preview` — the walkthrough; step to the moment that shows the change
- `/` — the home studio, which passes `activeStep="preview"`

Take a **full-frame** screenshot first. A tight crop once hid arms sticking
straight out sideways; the wide shot showed it instantly.

## 4. Probe the render before judging the frame

**Mandatory.** Whether a view is rendering is decided by the probe — never by
eyeballing a screenshot or reading a counter. Read `scripts/scene-probe.js`, then
pass its contents to `javascript_tool` (the in-app Browser pane) or paste them into
devtools, with the view you changed already open. It returns one verdict:
`RENDERING`, `BLANK_BUT_LOOPING`, `BLANK_AND_STALLED`, or `NOT_MOUNTED`.
`NOT_MOUNTED` means the scene never mounted — go check the console for a compile
error; it is **not** a blank render.

Both counter reads below were hand-rolled on 2026-08-01 and each produced a wrong
conclusion reported to the owner. The probe does them correctly; never redo them by
hand:

- **NEVER conclude anything from a single read of `gl.info.render.frame`.** It sat
  at 23 mid-load and was declared a frozen loop; it later climbed to 50,338. Poll
  until it settles.
- **NEVER read `gl.info.render.calls` or `.triangles` without first setting
  `gl.info.autoReset = false` and calling `gl.info.reset()`.** `info` is reset at
  the start of every `renderer.render()`, so a casual read returns only the last
  pass: `calls: 1, triangles: 12` was declared "every mesh is frustum-culled" when
  the truth was 777 calls and 311,819 triangles. Always restore `autoReset`
  afterwards.

**Pixels outrank counters:** a settled static scene legitimately reports
`loopLive: false` while rendering perfectly, so the verdict must come from colour
variance, not from whether the loop is advancing.

## 5. Judge against a figure in frame

New geometry is only correct relative to the people. Frame the change **with a
guest or the couple visible** and compare heights directly. A chair whose back
reaches a diner's shoulder is right; one taller than the table is not.

To render a specific view for inspection:

```js
window.__wfsScene.camera.position.set(x, y, z);
window.__wfsScene.camera.lookAt(tx, ty, tz);
window.__wfsScene.camera.updateMatrixWorld();
window.__wfsScene.capture(1400, 0.94);   // { dataUrl, distinctColours, width, height }
```

`distinctColours` below ~50 means a blank or single-colour frame — not a result.
The tab must be foregrounded; R3F pauses its render loop when the tab is hidden.

**`gl.render()` does NOT run `useFrame` callbacks.** R3F's frame loop is separate, so
calling render in a loop advances nothing that is animated per frame — an eased door
swing, a walking figure, a pose offset. A capture taken that way shows the scene's
initial state and looks like the animation is broken.

To check anything that moves: foreground the tab, wait real seconds, then capture.
There is no way to fast-forward R3F's loop from the console.

## 6. If a constant appears to have no effect, reload

HMR does not reliably apply changed module constants. Three "no effect" readings in
a row were a stale build, and re-tuning against them produced values that were
wrong in the opposite direction. Reload the page before adjusting a number twice.

## 7. Watch it move, do not judge a still

A pose layer that compounded every frame made the arms rotate without end, and no
frozen frame could show it. For anything animated or per-frame, sample the same
transform twice with frames in between and confirm it is stable:

```js
const read = () => { /* getWorldPosition of the bone */ };
const a = read();
for (let i = 0; i < 60; i++) s.gl.render(s.scene, s.camera);
const b = read();   // a and b must match
```

## 8. Do not commit what you could not see

If the render cannot be checked properly right now, **say so and leave the
geometry uncommitted**. An oversized portal in the scene is worse than no portal.
Reverting and recording the derived numbers for the next attempt is the correct
outcome, not a failure.
