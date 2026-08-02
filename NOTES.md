# Working notes — 2026-08-02

In-flight state for the current push. Durable project rules live in `CLAUDE.md`;
this file is the session hand-off and can be deleted once the three tasks below
are done.

## The three tasks Johan asked for, in the order agreed

### 1. Move the groom-start choice to where the scene is
The option already exists and works — `GROOM_START_OPTIONS` in
`components/ceremony/ceremony-studio.tsx:91`, applied at `:250`, honoured by the
scene through `staging.groomStart` (`"aisle" | "altar"`). Choosing `altar` makes
the groom wait on his mark facing the doors while only the bride walks in.

The defect is discoverability: it lives on `/ceremony` while the couple watches
the ceremony on `/` (the home studio). Johan never found it. Surface it in the
home studio's inspector alongside the other staging controls, reading and writing
the same `staging` object the home surface already holds.

### 2. Simplify the intake
Today it is five questions. Johan wants: couple names, guest count, optional
couple photo — then straight into the scene. Couple photos already have a store
(`lib/use-couple-photos.ts`, keys `couple-photo.{role}`) and the 3D already
renders them as face billboards, so this is a form change, not a feature.

### 3. The arrival sequence
Camera starts outside, moves in through the portal, doors open, music starts, the
couple walk to the altar.

**What exists:** the west portal with measured geometry — `WEST_WALL_Z = 6.3`,
`PORTAL_WIDTH 1.2`, `PORTAL_HEIGHT 1.4`, `DOOR_LEAF_WIDTH 0.55`,
`DOOR_MAX_SWING 1.6` (all in `components/wedding-studio/church-scene.tsx`). The
processional itself works: 20 s, ceremonial pace, groom parallel to the aisle.
Audio exists too — the scene already plays a public-domain Pachelbel on Play.

**What does not exist:** any exterior. The model stops at the west wall. No
facade, no tower, no ground, no sky to approach from. Johan's reference photo is
Sofia kyrka, Stockholm. This is real 3D modelling work, the same lift
`docs/blender-baked-venue.md` already identifies, and it is NOT a camera path.

**Agreed staging:** do the camera move from *inside the portal opening* first —
that reads as an arrival without needing a facade — and leave the true exterior
until the Blender shell exists.

## Open question, needs Johan's answer

The budget card shows `ESTIMATED TOTAL` in English next to `53 000 kr`. Not a
bug: the language toggle is on EN while the currency is SEK, so the app is doing
what it was told. The fix is a product decision he has not made yet — either the
language follows the currency, or Swedish users default to SV.

## Shipped today (13 commits, newest last)

| Commit | What |
|---|---|
| `4caddbb` | Hero camera was outside the west wall, framing blank limestone |
| `76e6af2` | Tool rail needed `justify-self`, not `align-self` |
| `7a4aa62` | Preview was dropping staging and the uploaded faces |
| `49767d8` | "Lay out the whole day" — 20 timed moments in one action |
| `9b91008` | **One scene, not two.** Edit/Preview stopped remounting the whole 3D |
| `807a9f4` | Processional rewinds when Edit hands over to Preview |
| `89bea0c` | The load-in flash WAS the better render; made it the settled look |
| `96043a4` | Officiant holds a psalter; groom stopped crab-walking |
| `b294828`, `13fe289` | Klara → Sanne at read time, plus the 50 ordered guests |
| `ea1646f`, `6cee321`, `e188600` | Deep mahogany pews; congregation dressed for a wedding |
| `d55187f` | Retired Fraunces (it ships a "wonk" axis); 50 font sizes → 13 |
| `46a3222` | **Menus and shot lists were deleted on every read** |
| `04c50e5` | Unreachable mobile menu, fabricated intake score, lying drag hint |
| `e99c77e` | Vendor briefs select by phase — 7 of 8 printed blank before |
| `09abcbe` | Music cues can finally be attached to a moment, both directions |
| `4af6ca9` | One shadow family, one radius family, the optical type layer |
| `5a9ca4c` | Intake stops handing the couple six songs they never chose |

## Measurement discipline that actually earned its keep

Read `.claude/skills/verify-3d/SKILL.md` before touching the 3D. Step 4 is
mandatory and exists because the same mistake was made twice in one day.

- **Never conclude from one `gl.info.render.frame` read.** It sat at 23 mid-load
  and was reported as a frozen loop; it later climbed past 50 000.
- **Never read `calls`/`triangles` without `gl.info.autoReset = false` first.**
  `info` resets on every `render()`, so a casual read returns the last pass only.
  A read of `calls: 1` was reported as "everything is culled"; the truth was 777.
- **Pixels outrank counters.** `scripts/scene-probe.js` decides from colour
  variance. A settled static scene legitimately reports `loopLive: false`.
- **Measure the pew region, never the full frame** — the pale wall dominates any
  full-frame mean and will lie about saturation.
- Johan's photographs are the colour reference. Pews target ~`[95,60,32]`.

## Remaining audit findings (28 total, these are what is left)

1. **Guest allergies, accessibility notes and tags are read everywhere and
   writable nowhere** — `components/guests/guests-view.tsx:230`. This is why
   `/menu`'s allergy-conflict feature is permanently dead. Size M.
2. The scene drag itself — `EditableSceneObject`
   (`church-scene.tsx:1034`) accepts `onMoveObject`/`onSelectObject`/
   `selectedObjectId` and uses none of them. The instruction was removed in
   `04c50e5`; the capability is still missing.
3. Hymn selection with playback — now unblocked by `09abcbe`, since a cue can
   finally hold a moment. Public-domain **recordings** only; the melodies are old
   enough but the recordings usually are not.
4. Toastmaster live-run mode. Johan called this one of his strongest ideas.
   `/director` and `lib/risk-analysis.ts` are already half of it. **Design note
   agreed with him:** a struck moment must be marked struck, never deleted — he
   has to be able to change his mind at 19:00, and the exports must show the
   planned day.

## Verification not yet done

`d55187f` and `4af6ca9` touched type, shadows and radii across the whole app
(41 + 154 declarations). Verified on `/`, `/menu` and `/budget` only. A route
sweep at desktop and mobile is owed.

Note: `history.pushState` does NOT drive the Next.js router — a "sweep" written
that way measures the same page repeatedly and reports identical numbers for
every route. Navigate for real.
