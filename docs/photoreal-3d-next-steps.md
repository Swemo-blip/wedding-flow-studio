# Photoreal 3D — next steps & gotchas

Notes for continuing the "world-class 3D" push on the ceremony/reception scenes.
Written after a session that shipped the safe wins and hit the wall on the heavy
ones. Read this before touching `components/wedding-studio/church-scene.tsx`.

## What already shipped (stable, verified)
- **HDRI image-based lighting** — real CC0 interior HDRI (`public/hdr/lythwood_room_1k.hdr`,
  Poly Haven, CC0). Loaded by the `HdrEnvironment` component via `RGBELoader` +
  `PMREMGenerator` and set on `scene.environment`. Day/dusk drive its intensity.
- **Candlelit aisle** — `CandleStand`s line the aisle every other pew row
  (emissive + bloom only, no extra lights).
- **Polished stone floor** — low roughness + slight metalness + `envMapIntensity`
  so the floor reflects the HDRI/candlelight.

These lift the *mood* toward the reference. The geometry stays stylized
(low-poly CC0 congregation + procedural shell) — that's the real-time ceiling.

## Hard-won gotchas (don't repeat these)
1. **Never use drei `<Environment files=...>` here.** It *suspends* while the HDR
   loads, which unmounts/remounts the `@react-three/postprocessing`
   `EffectComposer` and throws `TypeError: Cannot read properties of null
   (reading 'alpha')` in `addPass` → the whole scene falls back to the skeleton.
   Use the imperative `HdrEnvironment` (PMREM, no Suspense) instead.
2. **The `EffectComposer` is fragile.** Anything that re-mounts it mid-load tends
   to crash it. Add passes carefully, one at a time, each verified.
3. **`react-hooks/immutability` lint** flags direct `scene.x = …` assignment in an
   effect *body*. Put scene mutations inside a callback/cleanup (see
   `HdrEnvironment`) — those don't trip the rule.
4. **HMR is unreliable for structural 3D changes.** When you add a new component
   or change the composer, do a full server restart (stop + start), not just a
   reload — stale chunks throw e.g. `ReferenceError: HdrEnvironment is not defined`.
5. **This sandbox's preview is too throttled to render the heavy 3D.** Even the
   base scene blanks intermittently; adding a NormalPass blanked it for 26s+.
   **Verify the heavy levers on real local hardware**, not the sandbox preview.

## Lever 1 — SSAO (ambient occlusion) — highest grounding win
- `@react-three/postprocessing` `SSAO` **requires the normal pass**: set
  `<EffectComposer enableNormalPass multisampling={4}>`. Without it you get the
  console error "Please enable the NormalPass in the EffectComposer".
- Starting params that compiled cleanly (tune `radius`/`intensity` against the
  scene scale ≈ 13 units, on screen):
  ```tsx
  <SSAO samples={24} radius={0.1} intensity={22} luminanceInfluence={0.6}
    distanceThreshold={0.5} distanceFalloff={0.02}
    rangeThreshold={0.5} rangeFalloff={0.1} />
  ```
- Status: reverted this session **only** because the NormalPass wouldn't paint in
  the throttled sandbox — not a code defect. Re-apply on real hardware and tune.
- Cheaper alternative worth trying: the `n8ao` package (`N8AO`) — single pass,
  no separate NormalPass, usually faster + better looking. Adds a dependency
  (currently the project has none beyond three/R3F/drei/postprocessing).

## Lever 2 — God-rays / light shafts through the windows
- `@react-three/postprocessing` `GodRays` needs a `sun` mesh ref (a bright
  emissive plane/sphere placed behind/at each tall window). Another composer pass —
  same fragility + perf caution as SSAO. Verify on real hardware.
- Cheaper fake: additive, soft, semi-transparent light-cone meshes from the
  windows toward the floor (no composer pass) — lower risk, decent effect.

## Lever 3 — Higher-poly / photoscanned guests (closes the most realism distance)
- Today: `CongregationVariant` renders baked low-poly Quaternius people as
  `InstancedMesh` (~100 seated guests in 3 draw calls; see
  `public/models/cg_*.glb` + `CREDITS.md`). The low-poly people are the biggest
  "not photoreal" tell.
- Options: source higher-fidelity CC0 seated people (hard — most photoscanned
  humans aren't CC0/seated/low-tri enough for ~100 instances), or keep instancing
  but add normal/roughness maps + a couple of LODs (drei `<Detailed>`). Watch
  mobile triangle budget — instancing keeps draw calls low but not triangles.

## Where things live
- Scene + all of the above: `components/wedding-studio/church-scene.tsx`
  (`HdrEnvironment`, `EffectComposer`, `CongregationVariant`, `CandleStand`,
  `CameraSetup`, `Processional`).
- Reception per-guest 3D (photo billboards, drag-to-reseat):
  `components/reception/reception-seating-3d.tsx`.
- Verify after each lever: `npm run lint && npm run typecheck && npm run build`,
  then load `/ceremony` on real hardware and screenshot before/after at day + dusk.
