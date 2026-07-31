# Baked-GI venue shells (the Blender step)

The single biggest remaining jump for the 3D — from "honest stylized planning
twin" to **archviz-grade room** — is to replace the two analytically-lit venue
shells (the church nave and the dinner hall) with **Blender-baked global
illumination**: model the room once, bake the bounced light into lightmap
textures with Cycles, export a glTF whose textures already contain the lighting,
and render it *unlit* in the browser. Runtime cost is ~zero (no real-time GI),
and the result looks like Shapespark / Matterport-grade interior lighting.

**Honest ceiling:** this reaches convincing baked-archviz, **not** path-traced
photoreal — the couple, decor and candles stay dynamically lit on top, and they
read as clean stylised figures, not photographs. That's the right target: the
live 3D is a planning twin, and true photorealism was decided to live in
uploaded reference images, not the realtime scene (see the memory notes).

**Cost & who does it:** Blender is free (fits the no-paid-services rule; use only
CC0/CC-BY base geometry). But modelling + UV-unwrapping + baking + tuning a good
church and hall is real, skilled 3D-artist work — hours to a couple of days per
room — and it **cannot be produced inside the coding agent** (no Blender, no
modelling). This runbook exists so that work has a precise spec and drops
straight into the existing R3F scene with no guesswork.

---

## Pipeline (per venue: `church`, then `hall`)

1. **Base geometry (CC0 only).** Start from a CC0 church-interior / hall model
   (Poly Haven, Sketchfab-CC0, or model from scratch). Keep it low-to-mid poly —
   the lighting does the heavy lifting, not the mesh. Strip anything dynamic
   (people, movable furniture, candles, flowers): the shell is walls, floor,
   ceiling, columns, windows, altar/stage backdrop only.
2. **Lay it out to match the app's coordinate contract** (see below) so it lands
   registered with the congregation, dais and camera rig already in the scene.
3. **Light it in Cycles** for the intended mood — church: warm golden-hour side
   light through the stained glass windows; hall: warm dusk through the side
   windows + ceiling pendants. Use area lights / an HDRI as the light source.
4. **UV: add a second UV channel** dedicated to the lightmap (non-overlapping,
   the whole shell packed into 0–1). Channel 0 stays the material/albedo UVs.
5. **Bake** `Combined` (or `Diffuse` → Direct+Indirect+Color) to a single
   lightmap texture per shell (2k is plenty; 4k for the church if the aisle
   reads soft). Denoise the bake.
6. **Compose the shown texture** = albedo × lightmap (bake into one "beauty"
   texture, or multiply in a trivial shader). Simpler and most robust: bake the
   full combined result into one texture so the browser material is a plain
   unlit texture.
7. **Export glTF** (`.glb`, +Y up, meters) with the baked texture as the base
   color and material set to **Unlit** (`KHR_materials_unlit`) — or plain
   `meshBasicMaterial` on the R3F side. No normal maps / metalness needed; the
   light is already in the pixels.

### Coordinate contract (must match, or it won't register)

The app's venue geometry is centred on the aisle/room origin with these anchors
(see `components/wedding-studio/church-scene.tsx`):

- **Up axis** +Y, **units** meters, glb, scene origin at the **centre of the
  floor**, aisle running along **−Z (altar/head table) → +Z (entrance)**.
- Church: nave interior roughly **±4.9 m in X**, back/altar wall at **z ≈ −5.75**,
  entrance open toward +Z, floor at **y = 0**, ceiling ~**3.8 m**. The altar
  focal area sits around **z = −4.5**.
- Hall: same footprint (`RoomFrame` uses ±4.9 X, back wall z ≈ −5.75, walls
  3.8 m, ceiling gated out of the top-down Plan View). Dinner tables occupy the
  band **z ∈ [−2.4, 2.1]**, head table **z ≈ −4.3**, dance floor **z ≈ 4.3**.
- Leave the floor as a *separate* mesh (or omit it) so the app's PBR
  `TexturedGround` / textured floor can stay — or bake the floor too and drop the
  app floor for that venue. Decide per venue; the loader below supports both.

Export as `public/models/venues/church-baked.glb` and `hall-baked.glb`. Add the
source + licence to `public/models/CREDITS.md`.

---

## R3F integration (ready to paste)

The seam is `VenueBoundary` (church-scene.tsx ~953), which currently branches to
`ChurchNave` / `RoomFrame`. Add a baked-shell branch that only engages when the
asset is present, so today's analytic shells stay the fallback and nothing
changes until a `.glb` is dropped in.

```tsx
// Known baked shells — only listed venues attempt to load, so a missing asset
// never suspends/throws. Remove a line to fall back to the analytic shell.
const BAKED_VENUE_URLS: Partial<Record<StudioVenueType, string>> = {
  // church: assetPath("/models/venues/church-baked.glb"),
  // hall: assetPath("/models/venues/hall-baked.glb"),
};
Object.values(BAKED_VENUE_URLS).forEach((u) => u && useGLTF.preload(u));

function BakedVenueShell({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const shell = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // The lighting is baked into the texture -> render unlit so the analytic
      // lights don't double-light it. Keep the baked map as the basic map.
      const src = mesh.material as THREE.MeshStandardMaterial;
      mesh.material = new THREE.MeshBasicMaterial({ map: src.map ?? null, toneMapped: true });
      mesh.castShadow = false;
      mesh.receiveShadow = true; // let dynamic figures still drop contact shadows onto it
    });
    return clone;
  }, [scene]);
  return <primitive object={shell} />;
}
```

Then in `VenueBoundary`:

```tsx
function VenueBoundary({ palette, venueType, viewMode }: …) {
  const bakedUrl = BAKED_VENUE_URLS[venueType];
  if (bakedUrl) {
    return (
      <Suspense fallback={venueType === "church"
        ? <ChurchNave palette={palette} viewMode={viewMode} />
        : <RoomFrame palette={palette} venueType={venueType} viewMode={viewMode} />}>
        <BakedVenueShell url={bakedUrl} />
      </Suspense>
    );
  }
  // …existing analytic branches unchanged…
}
```

**When a baked shell is used, also dial the analytic lighting down** (the HDRI +
key/fill exist to light the *dynamic* layers, not the shell). Start by dropping
`HdrEnvironment` intensity ~40% and the key/fill for that venue, then tune on the
LIVE deploy (the HD composer is blank in the local sandbox — see the memory note;
verify look on GitHub Pages, not locally).

Ceiling in Plan View: bake the shell without a ceiling, or split the ceiling into
a separate node and hide it when `viewMode === "top"` (mirror `RoomFrame`'s
`showCeiling`).

---

## Acceptance criteria

- Church + hall each load a baked `.glb`; the congregation, dais, candles, tables
  and couple still render on top, correctly registered (feet on the floor, aisle
  aligned, altar/head table where the props are).
- The camera rig (`getCameraPosition/Target/Fov`) still frames the room — the
  baked shell must match the coordinate contract so no camera changes are needed.
- Plan View (top-down) still shows the room without the ceiling occluding it.
- No double-lighting (shell is unlit); no z-fighting between the baked floor and
  the app floor (use one or the other per venue).
- Mobile: one 2k texture per shell is cheap; confirm frame rate on a real phone.
- Verified on the LIVE deploy (HD path), not just the local forward render.

## Sequencing (from the 3d-upgrade-route plan)

This is the **XL** step. The cheaper ~60–70% of the visual jump — better analytic
key/fill, camera, and PBR textures on the current shells — comes first and is
lower-risk; the baked shell is the finisher. Do church first (highest-value, most
seen), prove the pipeline end-to-end on the live deploy, then repeat for the hall.

## West portal and doors — measured spec for the next attempt

Attempted 2026-07-31 and reverted: the doors rendered at 2.4x the right size
because they were written with real-world dimensions (3.1 m leaf) against figures
that measure ~1.1 m in this world. Fourth instance of the same mistake in one day.

The numbers, all derived from measured heights (see the MEASURED block in
church-scene.tsx):

- Standing figure: **1.1 m** (bone heights read from figure_suit.glb: neck 0.951,
  head 0.997 at FIGURE_SCALE 0.235).
- A real 2.05 m door against a 1.75 m person is a ratio of **1.17**.
- So a door leaf here is **1.29 m tall**, and a double door **1.1 m wide total**
  (0.55 m per leaf).
- Portal opening: **1.2 x 1.4 m**, not the 2.2 x 3.2 that was tried.
- West wall belongs at **z = +6.3** (the side walls run z -6.1 to +6.3 — they are
  12.4 long, centred at 0.1). Same form as the altar wall: 10.1 wide,
  wallHeight + 1.9 tall, 0.22 thick.
- Piers either side of a 1.2 opening: 4.45 wide each, centred at x = ∓2.825.
- Lintel above: 1.2 wide, from y 1.4 to 7.5.
- Hinge each leaf in a group at the pier edge with the panel offset half its width,
  so it swings about its edge. Verified working — only the scale was wrong.

Verify by pointing the camera from inside the nave back at the west end
(position [0, 1.9, 1.5], lookAt [0, 1.8, 8]) and checking the door height against
the couple standing in frame.
