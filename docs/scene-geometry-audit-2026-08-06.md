# Scene geometry audit, 2026-08-06

Measured, not looked at. Six independent lenses over the 3D scene, each required to
produce numbers rather than impressions, then an adversarial pass that recomputed
every finding and refuted what it could not reproduce. 43 survived, 19 were killed.

Two of the twelve agents died on network errors: the `+0.25` interior-offset lens
produced nothing at all, and the figures-versus-furniture refuter never ran, so that
lens's thirteen findings carry no verdict. Most of them duplicate findings other
lenses reached and verified independently, which is what running six lenses is for.

## Read this before acting on any line below

**The magnitudes are the agents' own, and some are overstated.** Three checked by hand
so far:

- The altar candle's flame floats **0.22 m**, not the claimed 0.70 m — and the
  mechanism offered for it, a bounding box padded with empty air, is false. The
  candlestick's visible mesh is 100% of its box, measured directly out of the GLB.
  The same claim was made about the vase and is equally false there.
- The vase arrangement's lowest leaf is buried **0.15 m**, not 0.28 m.
- The pendant flame finding was exactly right, and is the most visible of the three:
  `cylinderGeometry` is closed at both ends unless `openEnded` is set, so every
  pendant in the nave was a sealed brass can with an invisible flame inside it.

So: re-measure before changing a number. The pattern is that the *defect* is usually
real and the *quantity and the reason* often are not.

## Already fixed (2026-08-06)

Pendant flames sealed in closed cups; the altar candle's floating flame; the
arrangement sunk into its own vase; `COUPLE_FACE_Y`; `FIRST_PERSON_EYE_Y`. The last
two are now asserted by `npm run check:figures`, which fails if either drifts back
above the figure's own crown.

## The root cause behind the whole unit family

`church-scene.tsx` around line 2549 carries the note "this world's 0.63 scale". That
is the INVERSE of the truth: one scene unit is 1.591 m, not 0.63 m. Anyone reasoning
from that note wrote a metre value into a unit field, which is why the first-person
camera sat at 2.39 m, the aisle is 11.06 m rather than the documented 6.95, and the
processional runs at 0.55 m/s rather than 0.35.

## Survived refutation

### high (12)

- **The couple's photo face disc floats entirely above their heads**
  - `components/wedding-studio/church-scene.tsx:1952` — lens: held-props
  - Disc centre 1.27, radius 0.115, so the disc occupies y 1.155..1.385. Bride: eye centre 1.0054, hair crown 1.0878 — centre is 0.2646 u (0.421 m) above her eyes and the disc's BOTTOM edge is 0.0672 u (0.107 m) above the top of her head. Groom: eye centre 1.0396, crown 1.1346 — centre 0.2304 u (0.367 m) above his eyes, bottom edge 0.0204 u (0.032 m) above his crown. The same file's congregation constant is correct by contrast: CONGREGATION_FACE_Y 0.79 sits 0.031 below the seated crown of 0.8212.

- **Every ceiling pendant's flame is sealed inside its own closed brass cup**
  - `components/wedding-studio/church-scene.tsx:1524` — lens: clearance
  - Cup radius(y) = 0.13 + ((y+0.17)/0.3)*(0.11-0.13), i.e. 0.12 at the sphere's equator and 0.1163 at its top. Sphere radius at height dy from its centre = sqrt(0.075^2 - dy^2). Minimum radial clearance over dy in [-0.075, +0.075] is 0.0448 u (7.1 cm). Vertically: sphere spans local y -0.095..+0.055; the cup's closed caps are at -0.170 and +0.130, so 0.075 u (11.9 cm) of clearance below and 0.075 above. cylinderGeometry's openEnded argument is omitted, so it defaults to false and both caps are solid; the cup material (line 1522, metalness 0.78) has no transparency. To emerge under the cup the sphere's centre would have to drop to -0.245, i.e. 0.225 u (35.8 cm) lower.

- **The pew backrest passes through every seated guest's torso, with 10 cm of back protruding behind the pew**
  - `components/wedding-studio/church-scene.tsx:3646` — lens: clearance
  - Backrest: PewBody group at y 0.18 / z rowZ (lines 988, 991), mesh at local [0, 0.2, 0.14], box [2.55, 0.3, 0.07] -> world z rowZ+0.105..rowZ+0.175, world y 0.23..0.53. Guest: seat position z = rowZ + 0.07, rotationY approximately PI, scale CONGREGATION_SCALE 0.205. The baked seated mesh's rear-most surface is model z -0.170 at model y 0.34-0.38 (cg_man_0; -0.170 for cg_woman_0 and -0.171 for cg_dress_0 within the same y band) -> world z rowZ+0.240 at world y 0.34-0.38, inside the panel's y span. So the whole 0.07-thick panel lies buried in the torso and 0.0650 u (10.3 cm) of back sticks out behind the pew. The per-instance scale jitter 0.945-1.06 (line 1727) makes it 0.056-0.075 u (8.9-11.9 

- **All 8 stained-glass windows' stone reveals are buried inside the wall and never render**
  - `components/wedding-studio/church-scene.tsx:1384` — lens: clearance
  - Side walls: StoneWall args [0.2, 5.6, 12.4] at x +/-4.95 -> inner faces at |x| 4.85. Window group at |x| 4.79 with rotationY -PI/2 (or +PI/2), which maps local (0,0,-0.07) to a world offset of 0.07 outward, so the reveal lands at |x| 4.86 = 0.01 u (1.6 cm) inside the wall. Chancel wall: args [10.1, 7.5, 0.22] at z -5.85 -> front face z -5.74; windows at z -5.70, so the reveal lands at z -5.77 = 0.03 u (4.8 cm) inside the wall. The reveal geometry is lancetGeometry(halfWidth+0.13, rectHeight+0.26) — 0.13 wider and 0.26 taller than the glass — and exists only to frame it, so 6 side windows plus 2 chancel windows all render with no stone surround. The lead came at local z -0.012 does clear (|x|

- **Both altar flower urns stand at y 0 on a dais whose top face is y 0.09, so their entire footed base is inside the platform**
  - `components/wedding-studio/church-scene.tsx:1500` — lens: clearance
  - Dais (3373-3385) is a child of ChurchAltar: group offset [0,0,0.1], cylinder at y 0.045 with height 0.09 -> top face y 0.09, top radius 1.85. The urns sit at (+/-1.28, 0, 0.16), i.e. hypot(1.28, 0.06) = 1.281 from the dais axis, well inside 1.85, so they are over the platform. The urn's footed base (line 1457: cylinder at y 0.04, height 0.08, r 0.15/0.18) spans y 0.000..0.080 — 100% below the dais's top face — and the waisted stem (1461, y 0.07..0.77) is buried for its first 0.02. Burial 0.09 u (14.3 cm). Every other prop on the same dais is placed against it correctly: the mensa block bottom at y 0.08 (0.01 into the dais), the altar candles at y 0.10, the vase arrangements at y 0.655 = the 

- **The altar candle's flame floats 0.70 m above the candlestick because the GLB's bounding box is half empty air**
  - `components/wedding-studio/church-scene.tsx:1886` — lens: clearance
  - altar_candlestick.glb is one mesh in two disconnected pieces: the candlestick from raw y 0.0000 to 0.1280 (max radius 0.0276) and a 0.0076-tall needle of max radius 0.0034 from raw y 0.2667 to 0.2743 — with 0.1387 raw units, 50.6% of the bbox height, of empty space between them. useNormalizedModel scales by targetHeight / size.y = 0.56/0.2743 = 2.0416, so the candlestick renders 0.2613 tall (not 0.56) and the needle sits at 0.544..0.560. The flame sphere (radius 0.022 at y 0.7) is therefore 0.4387 u (0.698 m) above the candlestick's top, and 0.140 u (0.223 m) above even the needle; the pointLight at y 0.72 floats with it. Both altar candles (line 1506, x +/-1.5) are affected, scaled by decor

- **The head table is still the height the guest tables were corrected away from (0.66 vs 0.49), and it cuts the seated couple at the jaw**
  - `components/wedding-studio/church-scene.tsx:3903` — lens: scale
  - Head table: boxGeometry [2.4, 0.66, 0.72] at y 0.33, cloth plane at y 0.662 → top 0.662 u = 1.053 m. Guest table: TABLE_HEIGHT 0.49, cloth at height+0.002 → top 0.492 u = 0.783 m. Seated groom at [-0.34, 0, -4.86] is congregation variant 0 (cg_man_0, raw height 4.0056); his deterministic instance scale is 0.19410, so his crown is 0.7775 u (1.237 m) and his jaw/neck pinch (raw y 3.45) is 0.6697 u (1.065 m). The table top at 0.662 u is 0.008 u BELOW his jaw.

- **FIRST_PERSON_EYE_Y = 1.5 is a metre eye height in a 1.591 m unit — the bride/groom view rides 0.64 m above the top of their own head**
  - `components/wedding-studio/church-scene.tsx:2552` — lens: scale
  - 1.5 u = 2.386 m. figure_woman.glb primitive with material "Eyes" spans scene y 1.0013–1.0198 → eye line 1.0105 u = 1.608 m. "Hair" primitive tops at 1.0975 u = 1.746 m. Discrepancy vs the eye line: 0.490 u = 0.779 m. The camera therefore sits 0.403 u = 0.640 m above the crown of the head it is supposed to be inside. figure_suit.glb agrees: its "Eyes" primitive tops at 1.0598 u, crown 1.1374 u (1.810 m).

- **COUPLE_FACE_Y = 1.27 puts the uploaded couple photo entirely above the figure's head, clear of the hair**
  - `components/wedding-studio/church-scene.tsx:1952` — lens: scale
  - Disc bottom = 1.27 − 0.115 = 1.155 u. Bride crown (figure_woman "Hair" primitive max) 1.0975 u → 0.0575 u = 0.092 m of daylight under the photo. Groom crown (figure_suit "Hair") 1.1374 u → 0.0176 u = 0.028 m. Disc centre vs the bride's measured eye line (1.0105 u): 0.260 u = 0.413 m too high; vs the groom's eye-geometry top (1.0598 u): 0.210 u = 0.334 m.

- **The dinner chair's seat plane is 0.181 m above where the seated mesh's body actually rests, and 0.032 m above its thighs**
  - `components/wedding-studio/dinner-props.tsx:84` — lens: dinner-hall
  - Chair seat slab = boxGeometry [0.295, 0.026, 0.295] at y 0.295, so it occupies y 0.282..0.308. Seated figure at CONGREGATION_SCALE 0.205: crown 0.8211, buttock/thigh underside 0.1941, thigh top surface 0.2877. 0.308 - 0.1941 = 0.1139 u = 0.181 m of daylight under the sitter; 0.308 - 0.2877 = +0.0203 u = 0.032 m, i.e. the opaque plank is ABOVE the lap, drawn across the front of every diner's thighs. Cross-checked on 4 variants: underside 0.1787 (cg_woman_0, cg_dress_0) to 0.1941 (cg_man_0, cg_man_2); lap top 0.2857-0.2892. Per-instance scale jitter is 0.945-1.06 (church-scene.tsx:1727), giving underside 0.169-0.206 and lap top 0.270-0.307 - the slab top 0.308 clears every sitter's lap.

- **Banquet rows are pitched 1.50 apart but each table's seat ring is 1.70 wide, so diners from adjacent rows sit inside each other**
  - `components/wedding-studio/church-scene.tsx:4261` — lens: dinner-hall
  - Deficit 1.70 - 1.50 = 0.20 u = 0.318 m. Reproducing both functions verbatim against the app's real data (lib/wedding-data.ts:489, 7 tables, seat counts [2,6,4,4,4,3,4]) the closest cross-table pair is table 4 seat 1 at (0.000, -0.050) and table 6 seat 3 at (0.000, -0.250): 0.2000 u = 0.318 m apart at identical x. Each figure's z half-depth is 0.1698 (0.8284 model x 0.205), and both face the gap (rotationY pi and 0), so they occupy z [-0.2198, 0.1198] and [-0.4198, -0.0802] - 0.1396 u = 0.222 m of mutual leg interpenetration. Their chairs are 0.295 deep on the same centres: 0.295 - 0.200 = 0.095 u = 0.151 m of chair-box overlap. Capacity-fallback path (10 seats/table, church seatsPerRow = 10)

- **The couple's head table is still 0.66 tall - the exact height TABLE_HEIGHT was lowered from, and it stands at 0.85 of their seated height**
  - `components/wedding-studio/church-scene.tsx:3903` — lens: dinner-hall
  - Two dining tables in one room differing by 0.662 - 0.492 = 0.1700 u = 0.270 m. Against the couple who sit at it: instance scales from the seat-id hash are 0.19410 for "dinner-couple-groom" (crown 0.7775) and 0.20070 for "dinner-couple-bride" (crown 0.8039). 0.662/0.7775 = 0.851 and 0.662/0.8039 = 0.823 of their stature, versus the 0.60 ratio TABLE_HEIGHT is derived to hit. The table top is only 0.1155 u (0.184 m) and 0.1419 u (0.226 m) below the tops of their heads. A 0.60 table for these two would be 0.4665 and 0.4824.

### medium (14)

- **DinnerChair's seat slab passes through the diner's lap; its backrest is buried in the torso**
  - `components/wedding-studio/dinner-props.tsx:84` — lens: held-props
  - Seat slab occupies y 0.282..0.308 (0.295 +/- half of the 0.026 box). The seated figures' lowest supporting surface — the underside of buttocks/thighs — is y 0.1941 (cg_man_0) and 0.1787 (cg_woman_0, cg_dress_0) at CONGREGATION_SCALE 0.205. The slab's underside is therefore 0.0879-0.1033 u (0.140-0.164 m) above the body it is supposed to support, and CHAIR_SEAT_Y itself is 0.1009-0.1163 u (0.161-0.185 m) above it; 1539/5311 body vertices inside the slab footprint lie below the slab's top face. Backrest: the plank spans z -0.1435..-0.1235 while the sitter's rear surface in the plank's own y band (0.30..0.59) reaches z -0.1698 (cg_man_0) / -0.1537 (cg_dress_0), so the whole plank sits 0.0102-0.

- **Pew bench top sits 13-16 cm above the congregation's seat-contact plane, so the guests are sunk into the bench**
  - `components/wedding-studio/church-scene.tsx:3640` — lens: held-props
  - Bench box [2.55, 0.16, 0.34] centred at y 0.18 -> top face 0.26; the carpet cushion on top of it (line 3656, y 0.085, thickness 0.025) tops out at 0.2775. The seated figures' contact plane is 0.1941 (cg_man_0) / 0.1787 (cg_woman_0, cg_dress_0). Bench top is 0.0659-0.0813 u (0.105-0.129 m) above it, cushion top 0.0834-0.0988 u (0.133-0.157 m). The figures' thighs top out near y 0.29 (widest slice y 0.246..0.287), so the pelvis is inside the bench and the knees break out through its top surface.

- **First-person camera rides 0.73-0.79 m above the eyes of the figure it represents, and looks half a metre over the partner's head**
  - `components/wedding-studio/church-scene.tsx:2552` — lens: held-props
  - Camera eye 1.5 vs bride eyes 1.0054 = 0.4946 u (0.787 m) too high; vs groom eyes 1.0396 = 0.4604 u (0.733 m). Look target 1.45 vs groom eyes = 0.4104 u (0.653 m) high, and 0.3154 u (0.502 m) above his crown at 1.1346 — the gaze passes over the top of his head. With the partner only 0.787 u away at the altar (groom x -0.26, bride x +0.26, both at PROCESSION_END_Z), the resulting gaze is 36.8 degrees off his eyes. preview-walkthrough.tsx already cites 'an honest 1.02-unit eye level', which matches the measured 1.005/1.040 — the walkthrough waypoints raise the camera deliberately, but nothing documents raising the first-person eye, and no reasoning excuses aiming above the partner's crown.

- **headsRef publishes the couple's LOCAL z but CameraSetup consumes it as world z**
  - `components/wedding-studio/church-scene.tsx:2707` — lens: held-props
  - 0.25 scene units = 0.398 m. The first-person eye lands at world z = brideWorld - 0.37 instead of the intended brideWorld - 0.12, and the 'look at your partner' target lands 0.25 u (0.398 m) short of the partner's actual body — which is why the gaze error at the altar comes out at 36.8 degrees rather than the ~30 the height error alone would give.

- **The head table's centrepiece is sunk 21 cm into the solid table box**
  - `components/wedding-studio/church-scene.tsx:3919` — lens: clearance
  - Cluster local bbox min y = -0.9114 (rebuilt from buildBloomGeometry/buildLeafGeometry with BLOOM_LAYOUT and LEAF_LAYOUT), so at radius 0.2 its lowest point is 0.71 - 0.1823 = 0.5277. The head table (3902) is a box [2.4, 0.66, 0.72] at y 0.33 -> y 0.000..0.660, with the cloth plane at y 0.662; the cluster's half-width is 0.171 and its z span is -0.072..+0.111, entirely inside the table's x +/-1.2, z +/-0.36 footprint. Burial = 0.662 - 0.5277 = 0.1343 u (0.214 m): 4 leaves (LEAF_LAYOUT 0, 1, 8, 9) and 2 blooms (BLOOM_LAYOUT 11, 12) are wholly inside the solid box, plus the lower caps of blooms 8 and 9; the lowest bloom head is 0.0396 u (6.3 cm) under the cloth. A clear centre would be y 0.844.

- **The altar vase's arrangement hangs 28 cm below the vase mouth, crossing a stem only 2-8 cm thick**
  - `components/wedding-studio/church-scene.tsx:1876` — lens: clearance
  - altar_vase.glb normalised to height 0.22 measures: foot radius 0.060-0.064 at y 0.00-0.02, a waisted stem of radius 0.010-0.015 at y 0.06-0.10, then a cup widening to radius 0.076 at y 0.20-0.22 (the mouth). The cluster at [0, 0.2, 0] radius 0.17 reaches y 0.0451 — 0.1749 u (0.278 m) below the mouth. In the bands y 0.04-0.13 the cluster's own radius is 0.027-0.080 while the vase's radius there is only 0.010-0.042, so 3 leaves (LEAF_LAYOUT 0, 1, 8) and 2 blooms (BLOOM_LAYOUT 11, 12) are outside the vase's surface, below its cup, unattached to anything. Both arrangements (line 1503-1504) are affected.

- **Seated guests sit 7-8 cm below the pew cushion, so the bench passes through their thighs**
  - `components/wedding-studio/church-scene.tsx:3656` — lens: clearance
  - Cushion: PewBody group y 0.18, mesh at local [0, 0.085, 0.02], box height 0.025 -> world y 0.2525..0.2775. Guests: y = 0 (line 2816), scale 0.205 x jitter 0.945-1.06 (1727). Measured seat-contact plane (peak of downward-facing triangle area): y 0.225 for cg_man_0, 0.235 for cg_woman_0 and cg_dress_0. Overlap 0.0425-0.0525 u (6.8-8.4 cm) at nominal scale; 0.029-0.056 u across the jitter range. The cushion's z span (rowZ-0.13..rowZ+0.17) does cover the buttock region (world z rowZ-0.006..rowZ+0.143), so the overlap is real, not just vertical.

- **Dinner chair seats are 12 cm above the diners' actual contact plane**
  - `components/wedding-studio/dinner-props.tsx:103` — lens: clearance
  - Seat pad: box [0.295, 0.026, 0.295] at y 0.295 -> top face 0.308. Figures: buildReceptionSeats (church-scene.tsx:4298) gives position [gx, 0, gz], and the chair uses the same position and rotationY (church-scene.tsx:3892 vs 3894), so they are concentric. Overlap 0.0730-0.0830 u (11.6-13.2 cm) — 9-10% of the 0.82-tall seated figure. The chair back (line 107, local z -0.1435..-0.1235) is likewise inside the torso, which reaches local z -0.170, leaving 0.0265 u (4.2 cm) of back protruding behind the chair.

- **The pews float 21 cm above the nave floor (gap, not overlap)**
  - `components/wedding-studio/church-scene.tsx:3652` — lens: clearance
  - The end panels are boxes [0.05, 0.38, 0.36] at local [+/-1.26, 0.1, 0] -> local y -0.09..+0.29, and the PewBody group is lifted to y 0.18 (lines 988, 991) -> world y 0.09..0.47. The floor is a plane at y -0.04 (TexturedGround, line 912, and the fallback plane at 906/915 — planeGeometry, no thickness). Gap 0.13 u (0.207 m), which is larger than the bench's own 0.16 thickness. Every other object in the nave uses y 0 as its base (dais 0.00, columns 0.00, aisle candle stands 0.00, congregation 0.00), so the pews are 0.09 above even that datum, and the shared 0.04 offset means all of those float 6.4 cm too.

- **The "5 ft" aisle-width control renders a 9.66 ft aisle — the feet value is applied as if a scene unit were about a foot**
  - `components/wedding-studio/church-scene.tsx:870` — lens: scale
  - pewInnerEdge = PEW_BLOCK_X 2.2 − PEW_BENCH_WIDTH/2 1.275 = 0.925. aisleScale = max(0.5, feet/5). At 5 ft: runnerWidth = 0.925 × 2 × 1 = 1.85 u = 2.943 m = 9.66 ft, against a labelled 5 ft = 1.524 m = 0.958 u. Error 0.892 u = 1.419 m = 4.66 ft. The whole slider range (MIN 3 / MAX 10) is off by the same 1.93× factor: 3 ft renders 5.79 ft (+0.85 m), 10 ft renders 19.31 ft (+2.84 m).

- **The couple are rendered twice: once as guests at the sweetheart table in the grid, once at the head table - 29 figures for 27 diners**
  - `components/wedding-studio/church-scene.tsx:3818` — lens: dinner-hall
  - lib/wedding-data.ts:489 dinnerTables[0] is "sweetheart-table" with assignedGuestIds ["emma-carter", "james-bennett"], who are partnerOneName "Emma Carter" and partnerTwoName "James Bennett" (lib/wedding-data.ts:17-18). seatCounts (church-scene.tsx:3804) gives that table min(10, 2) = 2 seats, placing 2 figures at (-1.650, -2.400) and (-3.350, -2.400). Two more are appended at (-0.34, -4.86) and (0.34, -4.86). Total congregation instances = 27 + 2 = 29 against 27 assigned diners: 2 extra bodies, 7.4% overstated, with the bride and groom visible in two places at once.

- **The couple's figures ride the draggable dinnerTables group; their head table does not, so a nudge separates them by up to 2.86 m per axis**
  - `components/wedding-studio/church-scene.tsx:3894` — lens: dinner-hall
  - EditableSceneObject returns <group position={[offset.x, 0, offset.z]}> (church-scene.tsx:1099-1101). The head table group opens at church-scene.tsx:3901, after the wrapper closes at 3896. clampSceneOffset bounds each axis to +/-1.8 (lib/wedding-studio-plan.ts:373) and NUDGE_STEP is 0.15 (components/overview/studio-inspector.tsx:57), so 12 clicks reaches the clamp: the couple end up 1.8 u = 2.864 m per axis from the table they are supposed to be seated at, 2.546 u = 4.051 m diagonally, while the table's cloth, three tapers and flower cluster stay behind.

- **27 chairs are drawn for 29 seated figures - the couple sit on nothing, next to a comment that says otherwise**
  - `components/wedding-studio/church-scene.tsx:3811` — lens: dinner-hall
  - With the app's real data, receptionSeats has 27 entries and receptionSeatsWithCouple has 29, so exactly 2 of 29 diners get no DinnerChair - the bride and groom at (+/-0.34, 0, -4.86). The comment on the line above reads "One chair per occupied seat. The diners were sitting on nothing."

- **The hall floor plane is at y -0.04 but every object in the room is built from y 0, so the whole dinner floats 0.064 m**
  - `components/wedding-studio/church-scene.tsx:3845` — lens: dinner-hall
  - Gap 0.04 u = 0.064 m under: chair legs (box 0.295 centred 0.1475, bottom 0), the floor-length cloth hem (cylinder height 0.49 centred 0.245, hem 0, dinner-props.tsx:134), the dance-floor platform (box 0.08 centred 0.04, bottom 0), the bar (0.56 at 0.28), the head table (0.66 at 0.33), the cake table (0.5 at 0.25), the sideboard (0.68 at 0.34), and every congregation instance (position[1] = 0). The two floor decals are worse in the other direction: the dance-floor surface plane at y -0.012 stands 0.028 u = 0.045 m above the floor and the service-path strip at y +0.012 stands 0.052 u = 0.083 m above it, though both carry polygonOffset as though they were coplanar with it.

### low (17)

- **Congregation face photos use one fixed y against instance heights that vary by 0.13 units**
  - `components/wedding-studio/church-scene.tsx:1951` — lens: held-props
  - Measured crowns at scale 0.205 with the jitter applied: cg_man 0.7760..0.8704, cg_woman 0.7393..0.8293, cg_dress 0.7454..0.8361 — a 0.131 u (0.208 m) spread against a fixed 0.79. Share of the jitter range whose crown falls below 0.79: cg_man 14.8%, cg_woman 56.3%, cg_dress 49.2% (about 40% weighted over the 9 equally-likely variants), worst case 0.0507 u (0.081 m) above the crown. Even on the tallest variant the disc centre is 0.0510 u (0.081 m) above the head's own vertical centre (cg_man_0's head band measures y 0.657..0.821 -> centre 0.739).

- **The officiant's own trousers and jacket protrude through the alb at hip height**
  - `components/wedding-studio/church-scene.tsx:2423` — lens: held-props
  - Alb radius interpolates to 0.1136 at y 0.5516 and 0.1132 at y 0.5567. The posed body's radial distance from the same axis reaches 0.1262 (Pants, at x 0.1193 z -0.0412) and 0.1287 (Shirt, at x 0.1215 z -0.0424) at those heights — 0.0126 u (0.020 m) and 0.0155 u (0.025 m) outside the robe, on the hip/side. The trousers are #24261f, near-black, against the alb's #f3ede0. For reference, the same check on the bride shows her source Dress mesh 0.0111 u (0.018 m) outside BridalGown at y 0.5647.

- **The dance floor's decal plane is completely hidden underneath its own platform**
  - `components/wedding-studio/church-scene.tsx:3862` — lens: clearance
  - Plane: 2.45 x 2.15 at (0, -0.012, 4.3) -> x -1.225..1.225, z 3.225..5.375. Platform box (line 3867): [2.52, 0.08, 2.2] at (0, 0.04, 4.3) -> x -1.26..1.26, z 3.2..5.4, y 0.000..0.080. The plane is inset 0.035 u in x and 0.025 u in z on every side and sits 0.012 u (1.9 cm) below the box's underside. Its single face points +y (planeGeometry rotated -PI/2, default FrontSide) straight into the box, so from above it is occluded and from below it is backface-culled: zero visible pixels.

- **The bride's own GLB dress pokes 2 cm through the silk lathe gown at hip and waist**
  - `components/wedding-studio/church-scene.tsx:2560` — lens: clearance
  - Worst overhang 0.0123 u (2.0 cm) at y 0.42-0.44 (body max radius 0.171 vs gown 0.159); also 0.0084 u at y 0.48-0.50 (0.135 vs 0.126), 0.0111 u at y 0.50-0.52 (0.127 vs 0.116), 0.0055 u at 0.52-0.54. 100 of the 250 Dress vertices inside the gown's y range lie outside its surface. The gown's top rim (radius 0.094 at y 0.565) is conversely 0.0111 inside her dress (0.105 there), which is the only part that is correct — the seam is hidden.

- **The officiant's trousers poke 2 cm through the alb at the hip**
  - `components/wedding-studio/church-scene.tsx:2418` — lens: clearance
  - 15 of the 612 Pants vertices inside the alb's y range (0.02-0.90) lie outside its surface; worst 0.0126 u (2.0 cm) at y 0.552. Pants is #24261f against the alb's #f3ede0. The Shirt/Skin overhangs in the same test (0.074/0.159 u) are the forearms and hands in POSE_OFFICIANT, which a surface of revolution cannot cover and which are expected. Confirmed separately that the freshly fixed stole panels do clear: alb radius 0.113 at y 0.56 vs panels at z 0.118-0.126.

- **The detail layer's flower pedestal runs 17 cm through the floor**
  - `components/wedding-studio/church-scene.tsx:4008` — lens: clearance
  - The group sits at y 0.48 (line 4005) and the mesh at local y -0.35 with height 0.55 -> y -0.145..0.405. Floor plane y -0.04. Burial 0.105 u (16.7 cm) at decorScale 1 — the whole flared foot (radius 0.08) plus 19% of the shaft's length; 0.064 u at decorScale 0.72 and 0.134 u at 1.2, since the whole DetailLayer group is scaled (line 3996).

- **The default reception camera stands 1.11 m past the end of the hall floor, not inside the room**
  - `components/wedding-studio/church-scene.tsx:4202` — lens: scale
  - Reception floor: TexturedGround position [0, -0.04, 0.25], size [10.2, 12.8], rendered inside WeddingStageInterior's <group position={[0, 0, 0.25]}> → world centre z 0.5, half-depth 6.4, far edge z 6.9. RoomFrame side walls: boxGeometry [0.18, h, 11.8] at local z 0.1 → local -5.8..6.0, world -5.55..6.25. Camera z 7.6 is 0.70 u = 1.114 m beyond the floor edge and 1.35 u = 2.148 m beyond the walls. preview-walkthrough.tsx:65 puts the cocktail-hour waypoint at z 7.4, 0.50 u = 0.796 m past the floor.

- **The chancel surround projects 38 cm, not the 24 cm its comment claims — 0.24 was written as centimetres**
  - `components/wedding-studio/church-scene.tsx:2912` — lens: scale
  - depth 0.24 u = 0.382 m against a stated 0.24 m — 0.142 m too deep (0.089 u). With bevelEnabled and bevelThickness 0.014 the extrusion actually spans 0.268 u = 0.426 m front to back.

- **The processional's length and pace are documented in metres but computed in units: 11.06 m at 0.55 m/s, not 6.95 m at 0.35 m/s**
  - `components/wedding-studio/church-scene.tsx:2549` — lens: scale
  - Length 6.95 u = 11.057 m (comment claims 6.95 m; error 4.11 m). Speed 11.057/20 = 0.553 m/s (comment claims ~0.35 m/s; error 0.20 m/s). The same comment's "13 s peaked at 1.07 m/s" does not reproduce either way — 11.057/13 = 0.851 m/s.

- **The load-bearing "a seated figure is 0.82 m" note is off by 0.485 m — it is 0.82 units, i.e. 1.305 m**
  - `components/wedding-studio/church-scene.tsx:1568` — lens: scale
  - 0.820 u = 1.305 m against the stated 0.82 m — 0.485 m understated. The same mislabel is repeated in dinner-props.tsx:23-26 and in CLAUDE.md's own note ("Dinner table height ... 0.66", now stale since dinner-props.tsx:33 is 0.49).

- **The first-person camera reads the couple's z in interior-local space and writes it as world, standing 0.40 m behind them**
  - `components/wedding-studio/church-scene.tsx:2708` — lens: scale
  - Space offset 0.25 u = 0.398 m, on top of the deliberate −0.12 pull-back, so the bride/groom eye sits 0.37 u = 0.589 m behind the figure's true world position all the way down the aisle. Same for the look target when arrived (CameraSetup:4115 reads partner.z).

- **The singer's microphone capsule sits above her eye line**
  - `components/wedding-studio/church-scene.tsx:2523` — lens: scale
  - Capsule centre 1.05 u = 1.671 m; pole 1.04 u = 1.655 m (a real mic stand's fully-extended height, written straight into scene units). Bride/singer eye line 1.0105 u = 1.608 m, so the capsule is 0.040 u = 0.063 m ABOVE her eyes; a capsule at the mouth belongs roughly 0.065 u (0.10 m) below the eye line, making the pole about 0.105 u = 0.167 m too long.

- **The chair's backrest is entirely inside the sitter's torso**
  - `components/wedding-studio/dinner-props.tsx:107` — lens: dinner-hall
  - Panel = boxGeometry [0.275, 0.29, 0.02] at z = -CHAIR_WIDTH/2 + 0.014 = -0.1335, so z -0.1435..-0.1235, y 0.30..0.59. The figure's rearmost vertex is z -0.1698 (-0.8284 model x 0.205), and over the panel's own y band 0.33..0.63 the back surface measures z -0.150..-0.170. The panel's rear face is 0.0263 u = 0.042 m in front of the sitter's back, so no part of the backrest is behind anyone; a correct centre would be <= -0.1598. For contrast the church pew puts its backrest at z +0.14 behind figures that face -z (church-scene.tsx:3646).

- **Tapers float 0.029 m above both tabletops while the floral ring is sunk 0.022 m into the cloth**
  - `components/wedding-studio/dinner-props.tsx:144` — lens: dinner-hall
  - Cloth top cap = height + 0.002 = 0.492 (dinner-props.tsx:138). Torus centre = height + 0.03 = 0.520 with tube radius 0.042, so its lowest point is 0.478 - 0.0140 u = 0.022 m below the cloth. TaperCandle groups sit at height + 0.02 = 0.510 and the candle cylinder begins at its group origin, so each base floats 0.0180 u = 0.029 m. The head table repeats it exactly: taper groups at y 0.68 over a 0.662 top, again 0.018 u = 0.029 m (church-scene.tsx:3911). There is also no holder geometry at all, contrary to the "slim brass holder" described at dinner-props.tsx:56.

- **The scale reference block records the dinner table height as 0.66 when TABLE_HEIGHT is 0.49**
  - `components/wedding-studio/church-scene.tsx:1566` — lens: dinner-hall
  - 0.66 - 0.49 = 0.17 u = 0.270 m. This block is the file's own authority for deriving anything placed against a diner, and it is the source of the still-shipping head table at 0.66. Line 1576 in the same block likewise prescribes "a chair seat belongs near 0.30 and its back near 0.62" - 0.30 is the value the mesh measurement above contradicts by 0.114 u.

- **Each pendant's suspension rod runs 3.77 m out through the hall's ceiling**
  - `components/wedding-studio/church-scene.tsx:1533` — lens: dinner-hall
  - Rod = cylinderGeometry [0.006, 0.006, 2.6] centred at local y 1.3 inside a group at y 3.55, so it spans y 3.55..6.15. The hall ceiling plane is backWallHeight - 0.02 = 3.78 and the wall tops are 3.80. 6.15 - 3.78 = 2.37 u = 3.771 m of rod above the roofline; only 0.23 of the 2.6 is inside the room. The rod length is dimensioned for the church vault and was carried into the hall unchanged - LightingRibbon routes both interiors to the same ChurchPendantRow (church-scene.tsx:3545-3546), and the decorScale={0.82} the reception passes at 3953 is discarded on that branch.

- **The nudge readout labels scene units as metres, understating the move by 1.06 m at the clamp**
  - `components/overview/studio-inspector.tsx:164` — lens: dinner-hall
  - 1 scene unit = 1.5909 m. clampSceneOffset bounds the offset to +/-1.8 (lib/wedding-studio-plan.ts:373), so the label reads "1.80 m" while the object actually travels 1.8 x 1.5909 = 2.864 m - understated by 1.064 m. One NUDGE_STEP of 0.15 reads as 0.15 m and moves 0.239 m. This is the only affordance that repositions the dinner tables, bar and dance floor, so every number the couple sees about their room is off by a factor of 1.59.

## Killed by the refutation pass

- **The singer's microphone capsule sits above her eye line and 0.32 m to the side of her face**
  - Every number reproduces exactly — but the defect does not follow from the geometry alone, so I am refuting under the default-to-refuted rule. What I confirmed: the Singer group's outer rotation of -0.55 (line 2539) applies to the figure and the stand alike and

- **Dinner chair seat surface sits 0.11–0.13 u above the seated figure's own seat contact — the plate slices through every diner's thighs**
  - no verdict returned

- **The couple's head table is 0.17 u taller than every guest table and crosses their throats**
  - no verdict returned

- **Church pew seat surface sits 0.08–0.11 u above the seated congregation's hips — the whole crowd is sunk into the benches**
  - no verdict returned

- **Every pew floats 0.13 u above the church floor — its lowest geometry is y 0.09, the floor plane is y −0.04**
  - no verdict returned

- **The officiant stands 0.09 u below the top of the dais he is standing on — buried past the ankle**
  - no verdict returned

- **A seated figure is as deep as the whole pew bench, so its back passes clean through the backrest and its feet end up under its own seat**
  - no verdict returned

- **Dinner chair back panel is thinner than the figure's back overhang, so every diner's torso pokes out behind the chair**
  - no verdict returned

- **The couple at the head table are seated on nothing — the chair list excludes them**
  - no verdict returned

- **The /reception seating editor reuses DinnerChair at GUEST_SCALE 0.2, so its diners sink 0.12–0.13 u into the same chair**
  - no verdict returned

- **Every figure, chair leg and pew stands on the y = 0 datum while the drawn floor is 0.04 u lower**
  - no verdict returned

- **The couple's altar mark lands inside the dais's flared skirt**
  - no verdict returned

- **Nudging "Dinner tables" moves the seated couple but not their head table (and "Focal point" moves the dais out from under the officiant)**
  - no verdict returned

- **The tallest altar arrangement's biggest leaf is buried inside the closed urn bowl**
  - REFUTED - the leaf's extent is wrong by an order of magnitude, and the residual effect is correct behaviour, not a defect. I rebuilt the cluster geometry exactly and transformed LEAF_LAYOUT[0] (length 0.72, the largest leaf) by its own placement: local y -0.91

- **Every dinner table's floral ring is sunk 2 cm into the cloth**
  - REFUTED - the arithmetic is right but there is no defect to report. Confirmed the numbers: TABLE_HEIGHT 0.49 (dinner-props.tsx:33), cloth flat top cap = circleGeometry at height + 0.002 = 0.492 (line 138), torus at height + 0.03 = 0.52 with torusGeometry [0.16

- **The pew bench is 4.06 m long and seats four: seat pitch is 1.88x the seated figure's own shoulder width**
  - REFUTED on three independent grounds. (1) The measured quantity is misidentified. The claim scanned max(|x|,|z|) per slice, which mixes body WIDTH with front-to-back DEPTH; cg_man_0's accessor bounds are x +/-0.7368 and z +/-0.8284, so at chest height that sca

- **The head table's flower cluster is planted 0.064 m below the tabletop - five of its twelve leaves have their centres inside the table**
  - REFUTED: the claim compares layout CENTRES against the tabletop, but a LEAF_LAYOUT entry's position is the stem attachment point of a blade that runs along local +x — buildLeafGeometry (church-scene.tsx:3426-3434) is a Shape from (0,0) to (1,0) extruded 0.02, 

- **The sweetheart table renders as a full 1.85 m round with the couple 2.7 m apart on opposite sides**
  - REFUTED as a defect, though the arithmetic checks out (I ran buildReceptionSeats for seatsHere = 2, tableIndex 0, offset (0%2)*0.42 = 0: seats at (-1.650,-2.400) and (-3.350,-2.400), chord 1.7000 u = 2.705 m; cloth 2 x 0.58 = 1.16 u = 1.845 m; and I grepped ch

- **The hall's hero camera stands 2.15 m outside the room, and 1.11 m past the edge of its floor**
  - REFUTED. The extents are right (side walls boxGeometry [0.18, h, 11.8] at z 0.1 -> local -5.80..6.00 -> world -5.55..6.25 through the interior's <group position={[0,0,0.25]}> at 887; floor 10.2 x 12.8 at local z 0.25 -> world -5.90..6.90; hall "3d" eye at worl
