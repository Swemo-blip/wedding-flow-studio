import { SCENE_UNIT_METRES } from "@/lib/scene-units";

// Can each guest actually SEE the ceremony?
//
// This is the question a checklist cannot answer and a floor plan on paper cannot
// either: it needs the room, the seats and the couple in the same coordinate
// system. All three already live in this app, so the answer is arithmetic.
//
// The analysis is deliberately HEADLESS — it takes positions, not a Three.js
// scene — for three reasons. It can run before the 3D has mounted, it can be
// asserted by a script (npm run check:sightlines), and it cannot quietly start
// depending on what happens to be visible in one particular frame.
//
// ---------------------------------------------------------------------------
// THIS FILE WAS WRONG IN KIND ON ITS FIRST SHIP (2026-08-17), and the corrections
// are the most useful thing in it. Read them before adding a criterion.
//
// 1. IT ASKED THE WRONG QUESTION. The first version reported four defects —
//    blocked / side-on / distant / behind — and the two middle ones flagged 30 of
//    112 seats, including the whole front row at 78-86 degrees from 1.8 m. Those
//    are the seats reserved for parents. A person that close simply turns their
//    head. A panel whose first act is to tell a couple their parents cannot see
//    their wedding does not get read a second time.
// 2. "SIDE-ON SEES THE VOWS IN PROFILE" WAS BACKWARDS. On arrival the scene turns
//    the couple to face EACH OTHER (church-scene.tsx: groom to PI/2, bride to
//    3*PI/2, i.e. along x). So the seat straight down the aisle is the one that
//    sees two profiles, and a seat well off to one side sees one partner's face
//    square on. The old sentence told the couple the exact opposite of the render.
// 3. THE DISTANCE THRESHOLD HAD A FABRICATED DERIVATION. The comment claimed a
//    visual-acuity argument for 12 m. A face at 12 m subtends about 46 arcmin,
//    roughly 46x the acuity limit — the argument was invented, and 9 m would have
//    flagged 43 seats where 12 m flagged 19. Distance is now REPORTED AS A
//    MEASURED FACT with no verdict attached. "The back row is 14.2 m from the
//    altar" cannot be wrong and needs no threshold.
// 4. THE ALTAR ARRANGEMENT WAS MODELLED AT HALF ITS SIZE AND, ON ONE SIDE, IN THE
//    WRONG PLACE. It was given the urn's radius 0.19 and top 0.98 — the vase, with
//    the flowers left out of a floral arrangement. Measured from the scene's own
//    bloom math it is 0.365 wide and 1.476 tall. And the left copy was mirrored
//    the wrong way (`side * (1.28 + mark.x * side)` against the scene's
//    `-1.28 - mark.x`), putting it up to 1.8 units from where it renders.
// 5. IT OMITTED EVERY FIGURE THE COUPLE CAN DRAG, which is where the real ruin
//    is. The officiant's own reach (1.5) carries him to world z -1.80, half a unit
//    IN FRONT of the couple, at 0.185 wide and 1.119 tall. He blocks; the urns at
//    their real reach of 0.9 cannot. The first version passed in only the urns.
// 6. ITS REGRESSION TEST PROVED NOTHING REACHABLE. `--regress` dragged the florals
//    2.4 units when clampStagingOffset caps that mark at 0.9. It certified
//    detection of a state no user can create — the same trap CLAUDE.md already
//    records for the camera body-clearance check. The regression now uses the
//    officiant at his real clamp.
// 7. THE PANEL WAS BLIND TO THE CONTROLS DIRECTLY ABOVE IT. The call site omitted
//    the seat-layout argument, so the number never moved when the couple changed
//    Seating layout or Aisle width. A live number beside a live control that does
//    not move it is the "dead control" failure this product is built against.
//
// WHAT IS STILL DELIBERATELY NOT A PER-SEAT DEFECT: the head of the guest in
// front. Measured, this is the DOMINANT occluder — the rendered congregants'
// crowns reach 0.855 while a seated eye is 0.69-0.78, so the person ahead really
// is above your sightline, and including them flags roughly three seats in four.
// Reporting that per guest would drown every other finding. But the first version
// justified the exclusion by calling it unfixable, and that was wrong: row spacing
// IS a control in this app ("Spaced rows" goes from 0.62 to 0.80). So heads are
// still measured, and reported ONCE as a statement about the layout with the lever
// named — not as a verdict on a guest.
// ---------------------------------------------------------------------------

export type SightlineSeat = {
  guestName?: string;
  id: string;
  // WORLD space, matching the scene: x across the nave, z along it.
  x: number;
  z: number;
};

export type SightlineObstacle = {
  // A fixture can be moved by the couple, so naming it is actionable. A person
  // is measured but never reported as one guest's defect — see the header.
  kind: "fixture" | "person";
  label: string;
  // Horizontal half-extent in scene units — how wide a shadow it casts on a line
  // of sight.
  radius: number;
  // How tall it stands, scene units. An obstacle shorter than the line of sight
  // at the crossing point does not block anything.
  topY: number;
  x: number;
  z: number;
};

export type SightlineIssue = "blocked" | "level-with-couple";

// Which partner this seat sees during the vows. Not a defect — a fact, and the
// question wedding planners are actually asked ("will her mother see her face?").
export type VowFacing = "bride" | "groom" | "profile";

export type SightlineVerdict = {
  // Which fixture blocks, when one does. Named so the answer is actionable:
  // "the left altar arrangement" can be dragged.
  blockedBy?: string;
  // Metres, so the couple reads a distance they recognise.
  distanceMetres: number;
  guestName?: string;
  // Another guest's head sits in this line. Aggregated into a layout statement,
  // never shown as this guest's problem.
  headInLine: boolean;
  id: string;
  issues: SightlineIssue[];
  vowFacing: VowFacing;
};

// A seated adult's eye. MEASURED, not assumed: the four congregant GLBs the nave
// actually renders put their eye meshes at 0.691, 0.699, 0.760 and 0.781 units.
// 0.73 is the midpoint of that range, and the 9 cm spread is smaller than the
// lean allowance below — which is why one value is enough here.
export const SEATED_EYE_Y = 0.73;
// A standing adult's eye: 1.60 m over SCENE_UNIT_METRES. This is the number that
// separates a photographer's problem from a guest's.
export const STANDING_EYE_Y = 1.6 / SCENE_UNIT_METRES;
// The couple's sternum. A 1.75 m adult's sternum sits at about 1.36 m; over
// SCENE_UNIT_METRES that is 0.855. This is the target the line of sight has to
// reach, chosen over the face because a guest who can see the chest can lean for
// the face, and over the feet because nobody watches a wedding by the shoes.
const COUPLE_CHEST_Y = 1.36 / SCENE_UNIT_METRES;

// How far a seated person can shift their head without leaving their seat. The
// nave's seat offsets are 0.57 units apart (0.91 m), so half a seat is 0.285;
// 0.19 units (30 cm) stays comfortably inside your own place.
//
// This is the single most important constant in the file. An obstruction that a
// 30 cm lean defeats is not a blocked view — it is a moment of leaning, which
// every guest at every wedding does without noticing. Testing the ray from three
// head positions instead of one is what stops this analysis crying wolf, and it
// replaced two hand-waved exclusions (a thin candle post, a distant threshold)
// with one rule that states its own reason.
const LEAN_UNITS = 0.19;

// Beyond this much yaw you are looking at the side of a head, not at a face:
// both eyes and the mouth line stay readable to about 60 degrees, which is why a
// three-quarter portrait sits inside it and a full profile is 90.
export const FACE_LEGIBLE_DEGREES = 60;

// The rendered congregation, measured: crowns at 0.758 / 0.830 / 0.845 / 0.855
// units and half-widths 0.122 / 0.137 / 0.161 / 0.162. Heads are modelled at the
// LARGEST of each rather than per-variant, deliberately: the per-seat variant
// mapping lives in the scene and duplicating it here is exactly the kind of
// second implementation that drifts. A worst-case head is the honest input to a
// statement about the layout.
const SEATED_HEAD_TOP = 0.855;
const SEATED_HEAD_RADIUS = 0.162;

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

/**
 * How close a point passes to a segment, in the horizontal plane, and how far
 * along that segment the closest approach happens (0 = at the guest, 1 = at the
 * couple). Both are needed: the distance decides whether the obstacle is in the
 * way, and the fraction decides how high the line of sight is when it gets there.
 */
function approach(
  from: { x: number; z: number },
  to: { x: number; z: number },
  point: { x: number; z: number }
) {
  const spanX = to.x - from.x;
  const spanZ = to.z - from.z;
  const lengthSquared = spanX * spanX + spanZ * spanZ;
  if (lengthSquared < 1e-9) {
    return { distance: Math.hypot(point.x - from.x, point.z - from.z), fraction: 0 };
  }
  const raw = ((point.x - from.x) * spanX + (point.z - from.z) * spanZ) / lengthSquared;
  const fraction = Math.max(0, Math.min(1, raw));
  const nearestX = from.x + spanX * fraction;
  const nearestZ = from.z + spanZ * fraction;
  return { distance: Math.hypot(point.x - nearestX, point.z - nearestZ), fraction };
}

/** Does this obstacle stand in the line from one head position to the couple? */
function interrupts(
  head: { x: number; z: number },
  couple: { x: number; z: number },
  obstacle: SightlineObstacle,
  eyeY: number
) {
  const { distance, fraction } = approach(head, couple, obstacle);
  if (distance > obstacle.radius) {
    return false;
  }
  // The line of sight runs from the observer's eye to the couple's chest; if the
  // obstacle is shorter than the line where it crosses, they see over it.
  const lineHeight = eyeY + (COUPLE_CHEST_Y - eyeY) * fraction;
  return obstacle.topY > lineHeight;
}

/**
 * Blocked means blocked from every head position the guest can reach without
 * leaving their seat. See LEAN_UNITS.
 */
function blocks(seat: SightlineSeat, couple: { x: number; z: number }, obstacle: SightlineObstacle, eyeY: number) {
  const spanX = couple.x - seat.x;
  const spanZ = couple.z - seat.z;
  const length = Math.hypot(spanX, spanZ) || 1;
  // Lean perpendicular to the line of sight — that is the direction that clears
  // something standing in it.
  const leanX = (-spanZ / length) * LEAN_UNITS;
  const leanZ = (spanX / length) * LEAN_UNITS;
  const heads = [
    seat,
    { x: seat.x + leanX, z: seat.z + leanZ },
    { x: seat.x - leanX, z: seat.z - leanZ }
  ];
  return heads.every((head) => interrupts(head, couple, obstacle, eyeY));
}

/**
 * During the vows the bride faces -x and the groom faces +x (they turn to face
 * each other). So which face a seat sees is decided by the angle between that
 * seat's direction and each partner's facing.
 */
function vowFacing(seat: SightlineSeat, couple: { x: number; z: number }): VowFacing {
  const toSeatX = seat.x - couple.x;
  const toSeatZ = seat.z - couple.z;
  const length = Math.hypot(toSeatX, toSeatZ);
  if (length < 1e-6) {
    return "profile";
  }
  // cos of the angle between the seat direction and the bride's facing (-1, 0).
  const towardBrideFace = toDegrees(Math.acos(Math.max(-1, Math.min(1, -toSeatX / length))));
  const towardGroomFace = toDegrees(Math.acos(Math.max(-1, Math.min(1, toSeatX / length))));
  if (towardBrideFace <= FACE_LEGIBLE_DEGREES) {
    return "bride";
  }
  if (towardGroomFace <= FACE_LEGIBLE_DEGREES) {
    return "groom";
  }
  return "profile";
}

export function analyzeSightlines({
  coupleX,
  coupleZ,
  // Whose eye is this? Defaults to a seated guest, which is who this analysis was
  // written for. A STANDING observer is not a detail — a photographer at 1.60 m
  // sees straight over the seated crowns at 0.855 that dominate every guest's
  // problem, so the same room gives a genuinely different answer depending on who
  // is asking. Threading it through rather than hard-coding it is what let the
  // photographer's view reuse this file unchanged.
  eyeY = SEATED_EYE_Y,
  obstacles,
  seats
}: {
  coupleX: number;
  coupleZ: number;
  eyeY?: number;
  obstacles: SightlineObstacle[];
  seats: SightlineSeat[];
}): SightlineVerdict[] {
  const couple = { x: coupleX, z: coupleZ };

  return seats.map((seat) => {
    const issues: SightlineIssue[] = [];
    const distance = Math.hypot(couple.x - seat.x, couple.z - seat.z);
    const distanceMetres = distance * SCENE_UNIT_METRES;

    // The nave runs along -z toward the altar. A guest level with or past the
    // couple is looking at the room, not at the ceremony — and this fires from a
    // 35 cm nudge of the couple's own mark, which is exactly when the couple
    // should be told.
    const forward = seat.z - couple.z;
    if (forward <= 0) {
      issues.push("level-with-couple");
    }

    let blockedBy: string | undefined;
    let headInLine = false;
    for (const obstacle of obstacles) {
      if (!blocks(seat, couple, obstacle, eyeY)) {
        continue;
      }
      if (obstacle.kind === "person") {
        headInLine = true;
        continue;
      }
      if (!blockedBy) {
        blockedBy = obstacle.label;
        issues.push("blocked");
      }
    }

    return {
      blockedBy,
      distanceMetres: Math.round(distanceMetres * 10) / 10,
      guestName: seat.guestName,
      headInLine,
      id: seat.id,
      issues,
      vowFacing: vowFacing(seat, couple)
    };
  });
}

/**
 * The church's fixtures and figures, in WORLD space, derived from the scene's own
 * constants rather than copied by eye. Everything here is something the couple can
 * DRAG, which is the whole point: the analysis exists to answer "what did that
 * move just cost me?".
 */
export function churchSightlineObstacles({
  celebrantMark,
  floralMark,
  focalPointEdit,
  interiorZ,
  showSinger,
  singerMark
}: {
  celebrantMark: { x: number; z: number };
  floralMark: { x: number; z: number };
  // The whole altar group renders inside the "focalPoint" editable object, so its
  // offset moves the arrangements too. Omitting this was one of the first
  // version's errors.
  focalPointEdit: { x: number; z: number };
  interiorZ: number;
  showSinger: boolean;
  singerMark: { x: number; z: number };
}): SightlineObstacle[] {
  const obstacles: SightlineObstacle[] = [];

  // ChurchAltar sits at local z -4.55, the urns at +0.16 inside it. The scene
  // MIRRORS them: `-1.28 - mark.x` on the left, `1.28 + mark.x` on the right, so
  // the mark spreads them apart rather than sliding both one way.
  const arrangementZ = -4.55 + 0.16 + floralMark.z + focalPointEdit.z + interiorZ;
  for (const side of [-1, 1] as const) {
    obstacles.push({
      kind: "fixture",
      label: side < 0 ? "the left altar arrangement" : "the right altar arrangement",
      // Measured from the scene's own bloom placement math, not from the vase:
      // the widest bloom mass reaches 0.365 and the crown of the cluster 1.476.
      radius: 0.365,
      topY: 1.476,
      x: side * (1.28 + floralMark.x) + focalPointEdit.x,
      z: arrangementZ
    });
  }

  // The officiant. He starts a full unit behind the couple, but his reach (1.5)
  // carries him to world z -1.80 — half a unit in FRONT of them — and at 1.119
  // tall he is over every seated sightline. This is the reachable obstruction the
  // first version left out. Measured from officiant_realistic.glb with node
  // transforms applied: RealisticFigure normalises him to 1.78 m, factor 0.6193,
  // giving half-width 0.185.
  obstacles.push({
    kind: "fixture",
    label: "the officiant",
    radius: 0.185,
    topY: 1.119,
    x: 0 + celebrantMark.x,
    z: -3.55 + celebrantMark.z + interiorZ
  });

  if (showSinger) {
    // singer_realistic.glb, normalised to 1.70 m: factor 0.6896, half-width 0.231.
    obstacles.push({
      kind: "fixture",
      label: "the singer",
      radius: 0.231,
      topY: 1.069,
      x: 1.75 + singerMark.x,
      z: -3.05 + singerMark.z + interiorZ
    });
    // The stand is mounted at local [0.2, 0, 0.16] inside a group yawed -0.55 rad,
    // so its world offset is that vector ROTATED, not added: x 0.087, z 0.241.
    obstacles.push({
      kind: "fixture",
      label: "the microphone stand",
      radius: 0.042,
      topY: 1.092,
      x: 1.75 + singerMark.x + 0.087,
      z: -3.05 + singerMark.z + 0.241 + interiorZ
    });
  }

  return obstacles;
}

/**
 * The other guests' heads. Measured and passed in, but reported only as a
 * statement about the layout — see the header for why this is not a per-guest
 * defect.
 */
export function seatedGuestObstacles(seats: SightlineSeat[]): SightlineObstacle[] {
  return seats.map((seat) => ({
    kind: "person" as const,
    label: "a guest in front",
    radius: SEATED_HEAD_RADIUS,
    topY: SEATED_HEAD_TOP,
    x: seat.x,
    z: seat.z
  }));
}

export type SightlineSummary = {
  blocked: { blockedBy?: string; id: string }[];
  brideFace: number;
  clear: number;
  furthestMetres: number;
  groomFace: number;
  headInLine: number;
  levelWithCouple: number;
  profile: number;
  total: number;
};

/**
 * What the couple is actually told. "Clear" is deliberately strict about the
 * things they can fix and silent about the things they cannot: a seat counts as
 * clear when no fixture blocks it and it is not level with the couple.
 */
export function summarizeSightlines(verdicts: SightlineVerdict[]): SightlineSummary {
  return {
    blocked: verdicts
      .filter((verdict) => verdict.issues.includes("blocked"))
      .map((verdict) => ({ blockedBy: verdict.blockedBy, id: verdict.id })),
    brideFace: verdicts.filter((verdict) => verdict.vowFacing === "bride").length,
    clear: verdicts.filter((verdict) => verdict.issues.length === 0).length,
    furthestMetres: verdicts.reduce((max, verdict) => Math.max(max, verdict.distanceMetres), 0),
    groomFace: verdicts.filter((verdict) => verdict.vowFacing === "groom").length,
    headInLine: verdicts.filter((verdict) => verdict.headInLine).length,
    levelWithCouple: verdicts.filter((verdict) => verdict.issues.includes("level-with-couple")).length,
    profile: verdicts.filter((verdict) => verdict.vowFacing === "profile").length,
    total: verdicts.length
  };
}

/** Only the seats with something worth telling the couple about. */
export function sightlineProblems(verdicts: SightlineVerdict[]) {
  return verdicts.filter((verdict) => verdict.issues.length > 0);
}
