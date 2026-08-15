# How the agent gets eyes on this project

Written down because it transfers. Nothing here is specific to weddings or to
Three.js — it is a way of turning "I think this looks wrong" into a number, on any
project where the agent cannot simply look at the thing it is building.

## The problem it solves

An agent can run code, read files and take screenshots. On a normal web page that
is enough. On anything that renders — a canvas, a game, a chart, a 3D scene — it
is not:

- A screenshot of a WebGL canvas is very often **blank**, because a hidden or
  backgrounded pane pauses `requestAnimationFrame` and the frame is never drawn.
  This project misdiagnosed that as a broken renderer four separate times.
- Even a good screenshot only supports **taste** claims ("the dress looks black"),
  not causes. The cause was that a recolour helper was also painting the normal
  map. No screenshot says that.
- The agent's own conclusions are the least reliable part of the loop. Three times
  in one day this project's notes said a feature was missing when it had already
  shipped.

So the goal is not better screenshots. The goal is to make the running program
**answer questions about itself**, and to make the answers fail loudly when they
are wrong.

## The three techniques

### 1. A development-only bridge from the app to the console

One small component, mounted inside the renderer, publishes the live object graph
on `window` — and nothing else:

```ts
// components/wedding-studio/render-bridge.tsx
if (process.env.NODE_ENV !== "development") return;   // never for a real user
window.__wfs3d = { camera, scene, gl, getState, drawOnce };
```

That single line changed the character of every debugging session. Instead of
"the processional camera seems to point the wrong way", the session produces:

- `camera.position` → `[0, 1.05, 1.78]`
- 658 meshes in the scene, so it is mounted, not broken
- a raycast down the same path the mouse takes → the first three hits are dust-mote
  particles, then a wall at 7.3 units
- four groups carry an `onPointerDown` handler, so the drag really is wired

Every one of those is a fact. Two of them contradicted what I had just written in
a commit message, and the bridge is why the record got corrected instead of
compounding.

**Transferable rule:** expose the live state of whatever you cannot see —
the scene graph, the store, the layout tree, the audio graph — behind a
development-only guard. Read-only access costs nothing and removes guessing.

### 2. Draw-on-demand, because a hidden pane does not render

`drawOnce()` renders exactly one frame synchronously. Without it, a hidden pane
returns the un-rendered boot state forever and every screenshot lies:

```ts
drawOnce() { advance(performance.now(), true); }
```

**Transferable rule:** if the thing only updates on a frame loop, give yourself a
way to force one frame. And **check the pane's visibility before concluding
anything about a blank frame** — that is the single most common false alarm.

### 3. Headless probes that assert relationships, not pixels

The most valuable tools here never open a browser. They read the source and the
asset files and assert things that must be true:

| Command | What it proves |
|---|---|
| `npm run check:figures` | Poses are physically possible — hands meet, nothing sits inside a robe, no constant places an object above a figure's own crown. Reads the GLB's bone hierarchy and evaluates the pose by forward kinematics. |
| `npm run check:seats` | Bodies are not intersecting furniture, and everything stands on the same floor datum. |
| `npm run check:cameras` | Every camera starts inside the room it points at, aims at something inside that room, is not standing on a person, and — for the processional — actually has the couple in frame. |
| `npm run check:colour` | Text and control boundaries clear their contrast floors, measured against every page surface. |

These found defects that had survived every visual pass: an officiant whose stole
was rendering *inside* his robe, a camera 5.25 m outside the dinner hall, a focus
ring at 1.36:1, a couple's palms 71 cm apart.

**Transferable rule:** for anything with a rule you can state in a sentence
("nobody is 4 metres tall", "text must clear 4.5:1"), write the script that
measures it and make it exit non-zero. It runs in a second, it runs in CI, and it
does not get bored.

## The discipline that makes it trustworthy

The tools are the easy half. These three habits are what keep them honest:

1. **Verify the verifier, in both directions.** Every sweep tool in this project
   was wrong on its first run and looked clean while being wrong. So: put the old
   bug back and confirm the check FAILS. `check:cameras` earns its keep because
   restoring the original camera makes it report "bride visible at 1/3 points";
   the same test also proved one of my own bug reports was false.
2. **Measure before concluding, and say which you did.** "The wall is lavender
   because ambient is at hue 248°, fog at 272° and the hemisphere sky is #6c6e90"
   is a fix. "The wall looks purple" is a ticket.
3. **Write the finding where the next reader will trip over it.** Not in a
   changelog — in a comment beside the constant that caused it. This file's
   siblings are full of them, and they are the reason the same mistake is not
   made a fifth time.

## What to ask for on another project

> Before changing anything that renders, give yourself a way to measure it.
> Expose the live state behind a development-only flag so you can query the real
> object graph from the console instead of guessing from screenshots. If it draws
> on a frame loop, add a way to force one frame, and check whether the pane is
> even visible before you believe a blank capture. Then, for every rule you can
> state in one sentence, write a headless script that asserts it and exits
> non-zero — and prove each script fails when you reintroduce the bug it is meant
> to catch. When you report a result, say whether you measured it or looked at it.

That paragraph is the whole method. Everything above it is one project's worth of
evidence that it works.
