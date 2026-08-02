# Working notes — 2026-08-02

In-flight state. Durable project rules live in `CLAUDE.md`; this file is the
session hand-off and can be deleted once the work below lands.

## Where the three tasks stand

### 1. Groom-start choice in the home studio — DONE (`f1e3545`)
The rail gained a Staging tool (ceremony scene only) carrying the groom's
entrance and the singer. Writes through the shared layout record with the live
hydrated plan and sceneEdits. Verified: the choice persists, the sibling slices
survive it, and at the processional the altar holds the groom on "altar" and
only the officiant on "aisle".

### 2. Intake simplified — DONE (`cd332bb`)
Five questions became three: names and date, guest count, optional portraits.
Ceremony/reception format, style, complexity and the role list moved into the
Advanced fold — nothing was deleted. Portraits are held in component state and
written only on create, after the reset, and unconditionally (null clears), so
no couple inherits the previous couple's face.

### 3. Arrival sequence — PARTLY DONE, rest blocked
Music shipped (`b7c2ff1`): Preview used to mount the audio element and never
play it, because the effect keyed off the editor's local `processionalPlaying`
while Preview drives the walk through `autoProcessional`. It now follows the
walk, and the mute follows the music into Preview.

**Still to build, and the four gaps that must close together:**

| Gap | Where | Note |
|---|---|---|
| The doors are dead geometry | `church-scene.tsx:2963` `<ChurchDoors open={0} />` | Only call site in the repo. No prop, state, phase or `useFrame` touches `open`. There is no `DOOR_MAX_SWING` — the max is a bare `1.6` rad at `:1732`. |
| No exterior exists | west wall outer face at world z 6.66; floor ends at 6.90 | Beyond that the only geometry in the scene is the SkyDome. A camera at z 9 frames a flat limestone slab over a 2.1 m strip of nothing. Two shipped presets already do this: `ceremony-studio.tsx:40-41`. |
| The couple start inside | `PROCESSION_START_Z = 4.4` (local) = world 4.65 | 1.9 m inside the west wall. "Walk in through the doors" needs this moved. |
| The processional cannot be re-cued | reset is a React remount via `key={processionalKey}` (`church-scene.tsx:1013`) | The only incrementer is the Restart button, hidden whenever `cameraOverride` is set. |

**The coordinate trap.** The whole interior — floor, walls, portal, doors,
couple — renders inside `<group position={[0, 0, 0.25]}>` at
`church-scene.tsx:842`. The camera does not. Every `WEST_WALL_Z` /
`PROCESSION_*_Z` figure is LOCAL; world z = local + 0.25. The comment at
`church-scene.tsx:4066-4069` compares a world camera z against a local wall z
and is off by that 0.25. Any hand-computed arrival coordinate that ignores this
lands 0.25 m wrong.

**The rig will fight a scripted path.** `CameraSetup` (`church-scene.tsx:3950`)
is the sole writer of `camera.position`. With an override active it forces
`drifting = true` (`:4019`, adds ±0.1 m of `Math.sin(time*0.045)` to z) and
`lambda = 1.5` (`:4024`, a deliberately slow glide). A path carrying its own
easing double-eases and wobbles. Cheapest fix: extend `SceneCameraOverride`
(`:147-150`) with optional `lambda`, `drift` and `doorsOpen`; the three existing
call sites keep today's behaviour by omission.

**Also:** the portal is 1.2 × 1.4 LOCAL units, proportioned against the measured
1.10-unit standing figure — a camera at eye height 1.7–1.85 is taller than the
portal head and would dolly through the lintel, not the doorway.

**Agreed staging:** do the camera move from inside the portal opening first. The
true facade waits for the Blender shell (`docs/blender-baked-venue.md`).

## The live question: the whole visual language

2026-08-02, the owner: "Colours, boxes, columns, typography — almost everything
on the site signals that it looks like a MAGAZINE. Not a premium exclusive
planning site." He asked for the best possible thinking on colour combinations,
and the same for structure, boxes, columns and typography, and chose **mockups
first** as the way to decide.

This is the fifth direction. Four are already rejected: warm cream/bronze/green
(first execution), near-monochrome editorial ("too sterile"), the
lavender→peach gradient ("busy"), and plum. A dark luxe theme was built and
abandoned back to light. **Do not guess a sixth time** — every recommendation
needs a mechanism, and he judges against a concrete image.

The diagnosis given to him: 3rem Cormorant headlines per surface (magazine
ingress), white rounded cards with soft shadows floating on tinted cream (a
spread, not an instrument), literal three-column layouts, uniform generous
padding, and warm cream + serif being editorial by birth regardless of how
disciplined the green above it is.

The palette is LOCKED in `CLAUDE.md` because it came from his own reference
image. If the new direction changes it, update `CLAUDE.md` in the same commit —
the lock is only useful while it is true.

## Remaining audit findings

1. **Guest allergies, accessibility notes and tags are read everywhere and
   writable nowhere** — `components/guests/guests-view.tsx:230`. This is why
   `/menu`'s allergy-conflict feature is permanently dead. Size M.
2. Scene drag — `EditableSceneObject` (`church-scene.tsx:1034`) accepts
   `onMoveObject`/`onSelectObject`/`selectedObjectId` and uses none of them.
3. Hymn selection with playback. Public-domain **recordings** only; the melodies
   are old enough but the recordings usually are not.
4. Toastmaster live-run mode. `/director` and `lib/risk-analysis.ts` are half of
   it. **A struck moment must be marked struck, never deleted** — he has to be
   able to change his mind at 19:00, and the exports must show the planned day.
5. Pre-existing: `Processional` writes `coupleHeadsRef` in local space
   (`church-scene.tsx:2596`) but `CameraSetup` reads it as world (`:3999`), so
   the first-person eye sits 0.25 m behind the head.

## Measurement discipline that earned its keep

Read `.claude/skills/verify-3d/SKILL.md` before touching the 3D.

- **Never conclude from one `gl.info.render.frame` read.** It sat at 23 mid-load
  and was reported as a frozen loop; it later climbed past 50 000.
- **Never read `calls`/`triangles` without `gl.info.autoReset = false` first.**
  A read of `calls: 1` was reported as "everything is culled"; the truth was 777.
- **Pixels outrank counters.** `scripts/scene-probe.js` decides from colour
  variance. A settled static scene legitimately reports `loopLive: false`.
- **Measure the pew region, never the full frame** — the pale wall dominates any
  full-frame mean and will lie about saturation. Pews target ~`[95,60,32]`.
- `history.pushState` does NOT drive the Next.js router. A "route sweep" written
  that way measures one page repeatedly and reports identical numbers for all.
- The browser pane resizes itself between calls. `coordinate` clicks go stale;
  re-`read_page` and click by `ref`, or drive the DOM directly.

## Verification owed

`d55187f` and `4af6ca9` touched type, shadows and radii across the whole app
(41 + 154 declarations), verified on `/`, `/menu` and `/budget` only. That debt
is moot if the redesign lands — re-verify against whatever direction wins.
