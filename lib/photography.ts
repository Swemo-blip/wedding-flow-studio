import { SCENE_UNIT_METRES } from "@/lib/scene-units";
import {
  analyzeSightlines,
  FACE_LEGIBLE_DEGREES,
  STANDING_EYE_Y,
  type SightlineObstacle,
  type VowFacing
} from "@/lib/sightlines";

// Where does the photographer stand?
//
// The same arithmetic as the guests' sightlines, asked by someone who can move.
// That difference is the whole feature: a guest is stuck in a seat and wants to
// know what they will see, while a photographer wants to know where to BE — and
// the room answers that before anybody drives to it.
//
// ONE FACT DOES MOST OF THE WORK, and it is not obvious until the geometry says
// it. At the vows the couple turn to face each other (the scene rotates the groom
// to PI/2 and the bride to 3*PI/2, i.e. along x). A face stays readable to about
// 60 degrees of yaw. Two directions 180 degrees apart cannot both be within 60
// degrees of anything — so THERE IS NO POSITION IN THE ROOM THAT SEES BOTH FACES
// DURING THE VOWS. One of them is always in profile or turned away.
//
// That is the sentence a photographer needs before the day: it means two shooters,
// or a planned move, or a decision about whose face matters more. `seesBoth` below
// is COMPUTED rather than asserted, so if the scene ever stops turning them to
// face each other, the answer changes with the room instead of lying about it.
//
// The other thing the maths gives away for free: a standing photographer's eye is
// at 1.60 m and a seated crown reaches 1.36 m, so the crowd that dominates every
// guest's problem is simply not in a photographer's way. That is why this module
// passes the same obstacle list and lets the heights decide, rather than filtering
// the crowd out by hand and hoping.

export type CameraSpot = {
  blockedBy?: string;
  distanceMetres: number;
  facing: VowFacing;
  // SCENE UNITS, matching the caller. Converting is the caller's job because both
  // room-plan paths already own a conversion and a second one would drift.
  x: number;
  z: number;
};

/** A side of the room, as a working area rather than a single dot. */
export type CameraZone = {
  // The closest position that is not in front of the guests. NOT called "best":
  // the room cannot know whether they want the window behind them, and naming it
  // best would claim an aesthetic judgement this code never made.
  nearestWorkable: CameraSpot | null;
  count: number;
  furthestMetres: number;
  nearestMetres: number;
};

export type PhotographyPlan = {
  // Straight down the aisle: the classic frame, both of them in profile.
  aisle: CameraZone;
  bride: CameraZone;
  // How many standing positions in this room have a clear view at all.
  clearSpots: number;
  // Whether the seated crowd blocks a standing photographer anywhere. Reported
  // because it is reassuring and non-obvious, not because it is ever expected.
  crowdBlocks: boolean;
  // The line a photographer should not cross: the front row of guests. Measured
  // from the room rather than chosen, see buildZone.
  frontRowMetres: number;
  groom: CameraZone;
  seesBoth: boolean;
};

// How close a photographer may stand to a seated guest without being in their lap.
const CLEAR_OF_SEATS = 0.6 / SCENE_UNIT_METRES;
// A working range. Inside 1.8 m they are standing in the ceremony; beyond 12 m the
// lens, not the room, is the constraint — and this module has nothing useful to say
// about lenses.
const MIN_WORKING_METRES = 1.8;
const MAX_WORKING_METRES = 12;
// Grid step for candidate positions. 0.4 m is finer than a person can reliably
// stand anyway, so a finer grid would report precision the day cannot deliver.
const STEP = 0.4 / SCENE_UNIT_METRES;

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

/**
 * Which of the two faces is readable from here.
 *
 * Both can never be true — see the header — but this is written as two
 * independent tests rather than as one exclusive choice, precisely so the
 * impossibility stays a RESULT rather than an assumption baked into the code.
 */
export function facesVisibleFrom(point: { x: number; z: number }, couple: { x: number; z: number }) {
  const dx = point.x - couple.x;
  const dz = point.z - couple.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) {
    return { bride: false, groom: false };
  }
  // The bride faces -x, the groom +x.
  const toBride = toDegrees(Math.acos(Math.max(-1, Math.min(1, -dx / length))));
  const toGroom = toDegrees(Math.acos(Math.max(-1, Math.min(1, dx / length))));
  return { bride: toBride <= FACE_LEGIBLE_DEGREES, groom: toGroom <= FACE_LEGIBLE_DEGREES };
}

export function planPhotography({
  bounds,
  coupleX,
  coupleZ,
  insideRoom,
  obstacles,
  seats
}: {
  // Scene units. The area to search — the nave, or the traced room's extent.
  bounds: { maxX: number; maxZ: number; minX: number; minZ: number };
  coupleX: number;
  coupleZ: number;
  // For a traced venue, the walls. Omitted for the church, whose bounds are its room.
  insideRoom?: (point: { x: number; z: number }) => boolean;
  obstacles: SightlineObstacle[];
  seats: Array<{ x: number; z: number }>;
}): PhotographyPlan {
  const couple = { x: coupleX, z: coupleZ };
  const candidates: Array<{ id: string; x: number; z: number }> = [];

  for (let x = bounds.minX; x <= bounds.maxX; x += STEP) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += STEP) {
      const point = { x, z };
      if (insideRoom && !insideRoom(point)) {
        continue;
      }
      const metres = Math.hypot(x - couple.x, z - couple.z) * SCENE_UNIT_METRES;
      if (metres < MIN_WORKING_METRES || metres > MAX_WORKING_METRES) {
        continue;
      }
      // A photographer does not stand on a guest.
      if (seats.some((seat) => Math.hypot(seat.x - x, seat.z - z) < CLEAR_OF_SEATS)) {
        continue;
      }
      // Nor inside a pillar or an arrangement.
      if (obstacles.some((obstacle) => obstacle.kind === "fixture" && Math.hypot(obstacle.x - x, obstacle.z - z) < obstacle.radius)) {
        continue;
      }
      candidates.push({ id: `spot-${x.toFixed(2)}-${z.toFixed(2)}`, x, z });
    }
  }

  const emptyZone = (): CameraZone => ({ nearestWorkable: null, count: 0, furthestMetres: 0, nearestMetres: 0 });
  if (candidates.length === 0) {
    return {
      aisle: emptyZone(),
      bride: emptyZone(),
      clearSpots: 0,
      crowdBlocks: false,
      frontRowMetres: 0,
      groom: emptyZone(),
      seesBoth: false
    };
  }

  // The SAME analysis the guests get, at a standing eye. Every obstacle is passed
  // in, crowd included, and the heights decide what actually matters.
  const verdicts = analyzeSightlines({
    coupleX,
    coupleZ,
    eyeY: STANDING_EYE_Y,
    obstacles,
    seats: candidates
  });
  const byId = new Map(verdicts.map((verdict) => [verdict.id, verdict]));

  const spots: CameraSpot[] = [];
  let crowdBlocks = false;
  for (const candidate of candidates) {
    const verdict = byId.get(candidate.id);
    if (!verdict) {
      continue;
    }
    if (verdict.headInLine) {
      crowdBlocks = true;
    }
    if (verdict.issues.includes("blocked")) {
      continue;
    }
    spots.push({
      blockedBy: verdict.blockedBy,
      distanceMetres: verdict.distanceMetres,
      facing: verdict.vowFacing,
      x: candidate.x,
      z: candidate.z
    });
  }

  // WHERE TO STAND IS A REGION, NOT A DOT, and the first version of this got that
  // wrong in a way worth recording. It picked the closest clear spot, which meant
  // every recommendation landed exactly on MIN_WORKING_METRES — the answer was
  // always "stand as close as the code allows", which is not advice, and at 1.8 m
  // it is advice to stand on top of a couple saying their vows.
  //
  // So a zone reports its extent, and its representative spot is the closest one
  // that is NOT IN FRONT OF THE GUESTS. That line is measured from the room — the
  // distance from the couple to the nearest seat — rather than chosen by taste. A
  // photographer ahead of the front row is between the guests and the wedding,
  // which is a real constraint every venue enforces and no aesthetic judgement.
  const frontRowMetres = seats.length
    ? Math.min(...seats.map((seat) => Math.hypot(seat.x - couple.x, seat.z - couple.z))) * SCENE_UNIT_METRES
    : MIN_WORKING_METRES;

  const buildZone = (predicate: (spot: CameraSpot) => boolean): CameraZone => {
    const inZone = spots.filter(predicate).sort((a, b) => a.distanceMetres - b.distanceMetres);
    if (inZone.length === 0) {
      return { nearestWorkable: null, count: 0, furthestMetres: 0, nearestMetres: 0 };
    }
    const behindTheFrontRow = inZone.find((spot) => spot.distanceMetres >= frontRowMetres);
    return {
      // If nothing clears the front row, say so with the nearest available rather
      // than silently recommending a spot in front of the guests.
      nearestWorkable: behindTheFrontRow ?? inZone[0],
      count: inZone.length,
      furthestMetres: inZone[inZone.length - 1].distanceMetres,
      nearestMetres: inZone[0].distanceMetres
    };
  };

  const seesBoth = spots.some((spot) => {
    const faces = facesVisibleFrom({ x: spot.x, z: spot.z }, couple);
    return faces.bride && faces.groom;
  });

  return {
    aisle: buildZone((spot) => spot.facing === "profile"),
    bride: buildZone((spot) => spot.facing === "bride"),
    clearSpots: spots.length,
    crowdBlocks,
    frontRowMetres: Math.round(frontRowMetres * 10) / 10,
    groom: buildZone((spot) => spot.facing === "groom"),
    seesBoth
  };
}
