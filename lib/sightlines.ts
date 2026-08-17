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
// WHAT IS DELIBERATELY NOT A PROBLEM: the head of the person in front. In every
// real church the guest ahead of you is partly in the way. It is not a defect,
// the couple cannot fix it by moving a table, and reporting it would make this
// feature cry wolf about the one thing nobody can act on.

export type SightlineSeat = {
  guestName?: string;
  id: string;
  // WORLD space, matching the scene: x across the nave, z along it.
  x: number;
  z: number;
};

export type SightlineObstacle = {
  // Horizontal half-extent in scene units — how wide a shadow it casts on a
  // line of sight.
  radius: number;
  // How tall it stands, scene units. An obstacle shorter than the line of sight
  // at the crossing point does not block anything.
  topY: number;
  label: string;
  x: number;
  z: number;
};

export type SightlineIssue = "blocked" | "side-on" | "distant" | "behind";

export type SightlineVerdict = {
  // Metres, so the couple reads a distance they recognise.
  distanceMetres: number;
  guestName?: string;
  id: string;
  issues: SightlineIssue[];
  // Which obstacle blocks, when one does. Named so the answer is actionable:
  // "the left altar arrangement" can be moved; "too far" cannot.
  blockedBy?: string;
  // Degrees off the nave axis. 0 = straight down the aisle at the couple.
  viewAngle: number;
};

// A seated adult's eye, and the couple's upper body: the line of sight runs
// between these two heights. Both are derived from the figure measurements this
// project already trusts — a seated guest occupies 0.82 units base to crown
// (church-scene.tsx), so the eye sits just below that, and the couple's own
// FIRST_PERSON_EYE_Y is 1.02.
const SEATED_EYE_Y = 0.74;
const COUPLE_CHEST_Y = 0.86;

// The thresholds. Each one has a reason that is not "it looked about right":
//
// SIDE_ON_DEGREES — past this the guest is looking across the couple rather than
// at them, so during vows (when the couple turn to face each other) at least one
// of the two has their back to this seat. 70 degrees is where the far partner's
// face leaves view entirely for a couple standing shoulder to shoulder.
const SIDE_ON_DEGREES = 70;
// DISTANT_METRES — a face subtends about 1/60 of a degree per centimetre at this
// range; beyond 12 m a guest sees clothing and posture, not expression. It is
// also roughly where a 50 mm lens stops holding a face, which is why
// photographers move for the vows.
const DISTANT_METRES = 12;

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

export function analyzeSightlines({
  coupleX,
  coupleZ,
  obstacles,
  seats
}: {
  coupleX: number;
  coupleZ: number;
  obstacles: SightlineObstacle[];
  seats: SightlineSeat[];
}): SightlineVerdict[] {
  const couple = { x: coupleX, z: coupleZ };

  return seats.map((seat) => {
    const issues: SightlineIssue[] = [];
    const spanX = couple.x - seat.x;
    const spanZ = couple.z - seat.z;
    const distance = Math.hypot(spanX, spanZ);
    const distanceMetres = distance * SCENE_UNIT_METRES;

    // The nave axis runs along -z toward the altar, so the angle off-axis is the
    // arctangent of the sideways offset over the forward offset. A guest level
    // with or past the couple has no forward component at all.
    const forward = seat.z - couple.z;
    const viewAngle = forward <= 0 ? 90 : toDegrees(Math.atan2(Math.abs(spanX), forward));

    if (forward <= 0) {
      // Sitting level with or beyond the couple: they are looking at the room,
      // not at the ceremony.
      issues.push("behind");
    } else if (viewAngle >= SIDE_ON_DEGREES) {
      issues.push("side-on");
    }

    if (distanceMetres > DISTANT_METRES) {
      issues.push("distant");
    }

    let blockedBy: string | undefined;
    for (const obstacle of obstacles) {
      const { distance: clearance, fraction } = approach(seat, couple, obstacle);
      if (clearance > obstacle.radius) {
        continue;
      }
      // The line of sight rises from the guest's eye to the couple's chest; if
      // the obstacle is shorter than the line where it crosses, the guest sees
      // straight over it.
      const lineHeight = SEATED_EYE_Y + (COUPLE_CHEST_Y - SEATED_EYE_Y) * fraction;
      if (obstacle.topY <= lineHeight) {
        continue;
      }
      blockedBy = obstacle.label;
      issues.push("blocked");
      break;
    }

    return {
      blockedBy,
      distanceMetres: Math.round(distanceMetres * 10) / 10,
      guestName: seat.guestName,
      id: seat.id,
      issues,
      viewAngle: Math.round(viewAngle)
    };
  });
}

// The church's own geometry, in WORLD space, derived from the scene's constants
// rather than copied. Two findings from measuring it, both worth keeping:
//
// 1. THE ALTAR ARRANGEMENTS CANNOT BLOCK ANYONE where they stand by default.
//    ChurchAltar sits at local z -4.55 and the urns at +0.16 within it, so world
//    z -4.14 — which is 1.84 units BEHIND the couple at world -2.30. Nothing
//    behind the target can occlude it. They are still passed in, because the
//    couple can DRAG them (floralMark), and if they are pulled forward the
//    analysis will say so. Including them and letting the arithmetic return "no"
//    is honest; omitting them would hide a real case.
// 2. THE AISLE CANDLE STANDS ARE NOT OBSTACLES and are deliberately left out.
//    Their post measures 0.045 units at the widest, scaled by 0.82 — under 4 cm.
//    A 4 cm post between a guest and a couple 10 m away hides a wrist. Reporting
//    it would be crying wolf about something nobody would ever notice.
export function churchSightlineObstacles({
  floralMark,
  interiorZ
}: {
  floralMark: { x: number; z: number };
  interiorZ: number;
}): SightlineObstacle[] {
  // Local z of the altar group, plus the urn's own offset inside it.
  const urnZ = -4.55 + 0.16 + floralMark.z + interiorZ;
  // The bloom head is the widest part (cylinder radius 0.19) and the whole urn
  // stands 0.98 units tall — head centre 0.86 plus half its 0.24 height.
  return [-1, 1].map((side) => ({
    label: side < 0 ? "the left altar arrangement" : "the right altar arrangement",
    radius: 0.19,
    topY: 0.98,
    x: side * (1.28 + floralMark.x * side),
    z: urnZ
  }));
}

/** Only the seats with something worth telling the couple about. */
export function sightlineProblems(verdicts: SightlineVerdict[]) {
  return verdicts.filter((verdict) => verdict.issues.length > 0);
}
