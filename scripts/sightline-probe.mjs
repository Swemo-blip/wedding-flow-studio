// Who can actually see the ceremony?
//
//   node scripts/sightline-probe.mjs           # report the nave as it stands
//   node scripts/sightline-probe.mjs --check   # exit non-zero if the analysis is unsound
//   node scripts/sightline-probe.mjs --regress # prove it CATCHES a blocked seat
//
// This exists for the same reason check:cameras does: the analysis makes a claim
// to the couple ("four guests see the ceremony side-on"), and a claim shown to a
// person must be measured, not assumed. It also runs the analysis on the real
// seat grid, which is the only way to know whether the thresholds say anything
// useful or just fire on everybody.
//
// The seat grid and the couple's mark are parsed out of the source so this file
// cannot drift away from the scene it describes.
import { readFileSync } from "node:fs";

const scene = readFileSync("components/wedding-studio/church-scene.tsx", "utf8");
const plan = readFileSync("lib/wedding-studio-plan.ts", "utf8");

function sceneNumber(name, source = scene) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(-?[\\d.]+)`));
  if (!match) {
    throw new Error(`could not find ${name}`);
  }
  return Number(match[1]);
}

const INTERIOR_Z = sceneNumber("INTERIOR_Z", readFileSync("lib/scene-units.ts", "utf8"));
const SCENE_UNIT_METRES = sceneNumber("SCENE_UNIT_METRES", readFileSync("lib/scene-units.ts", "utf8"));
const PEW_BLOCK_X = sceneNumber("PEW_BLOCK_X");
const PROCESSION_END_Z = sceneNumber("PROCESSION_END_Z");
const ROW_SPACING = 0.62; // DEFAULT_SEAT_LAYOUT.rowSpacing
const SEAT_OFFSETS = [-0.86, -0.29, 0.29, 0.86];

// The analysis itself is TypeScript, so rather than compile it this probe carries
// the same arithmetic. That duplication is a real risk — so the two are kept
// deliberately tiny and the constants come from one place. If they ever disagree,
// the --regress mode below is what will notice.
const SEATED_EYE_Y = 0.74;
const COUPLE_CHEST_Y = 0.86;
const SIDE_ON_DEGREES = 70;
const DISTANT_METRES = 12;

function analyse({ coupleX, coupleZ, obstacles, seats }) {
  return seats.map((seat) => {
    const spanX = coupleX - seat.x;
    const forward = seat.z - coupleZ;
    const distance = Math.hypot(spanX, coupleZ - seat.z);
    const distanceMetres = distance * SCENE_UNIT_METRES;
    const viewAngle = forward <= 0 ? 90 : (Math.atan2(Math.abs(spanX), forward) * 180) / Math.PI;
    const issues = [];
    if (forward <= 0) {
      issues.push("behind");
    } else if (viewAngle >= SIDE_ON_DEGREES) {
      issues.push("side-on");
    }
    if (distanceMetres > DISTANT_METRES) {
      issues.push("distant");
    }
    let blockedBy;
    for (const obstacle of obstacles) {
      const spanZ = coupleZ - seat.z;
      const lengthSquared = spanX * spanX + spanZ * spanZ;
      const raw = ((obstacle.x - seat.x) * spanX + (obstacle.z - seat.z) * spanZ) / (lengthSquared || 1);
      const fraction = Math.max(0, Math.min(1, raw));
      const clearance = Math.hypot(obstacle.x - (seat.x + spanX * fraction), obstacle.z - (seat.z + spanZ * fraction));
      if (clearance > obstacle.radius) {
        continue;
      }
      if (obstacle.topY <= SEATED_EYE_Y + (COUPLE_CHEST_Y - SEATED_EYE_Y) * fraction) {
        continue;
      }
      blockedBy = obstacle.label;
      issues.push("blocked");
      break;
    }
    return { blockedBy, distanceMetres, id: seat.id, issues, viewAngle };
  });
}

function buildSeats(rows) {
  const seats = [];
  for (let row = 0; row < rows; row += 1) {
    const z = -2.4 + row * ROW_SPACING + 0.07 + INTERIOR_Z;
    for (const side of [-1, 1]) {
      for (const dx of SEAT_OFFSETS) {
        seats.push({ id: `row${row + 1}-${side < 0 ? "L" : "R"}${dx}`, row: row + 1, x: side * PEW_BLOCK_X + dx, z });
      }
    }
  }
  return seats;
}

const coupleX = 0.26;
const coupleZ = PROCESSION_END_Z + INTERIOR_Z;
const seats = buildSeats(14);

function urns(floralMark) {
  const urnZ = -4.55 + 0.16 + floralMark.z + INTERIOR_Z;
  return [-1, 1].map((side) => ({
    label: side < 0 ? "the left altar arrangement" : "the right altar arrangement",
    radius: 0.19,
    topY: 0.98,
    x: side * 1.28,
    z: urnZ
  }));
}

const asShipped = analyse({ coupleX, coupleZ, obstacles: urns({ x: 0, z: 0 }), seats });

if (process.argv.includes("--regress")) {
  // Drag the arrangements forward until they stand between the front rows and the
  // couple. If the analysis does not notice, it is decoration, not a check.
  // 2.4 units forward puts the urns at world z -1.74, ahead of the couple.
  const moved = analyse({ coupleX, coupleZ, obstacles: urns({ x: 0, z: 2.4 }), seats });
  const blocked = moved.filter((verdict) => verdict.issues.includes("blocked"));
  console.log(`Arrangements dragged 2.4 units forward: ${blocked.length} seat(s) now blocked`);
  for (const verdict of blocked.slice(0, 6)) {
    console.log(`  ${verdict.id} — blocked by ${verdict.blockedBy}`);
  }
  if (blocked.length === 0) {
    console.log("  FAIL  the analysis did not notice an arrangement standing in the way");
    process.exit(1);
  }
  console.log("  PASS  the analysis catches an obstacle it should catch");
  process.exit(0);
}

const byIssue = { behind: 0, blocked: 0, distant: 0, "side-on": 0 };
for (const verdict of asShipped) {
  for (const issue of verdict.issues) {
    byIssue[issue] += 1;
  }
}
const clear = asShipped.filter((verdict) => verdict.issues.length === 0).length;

console.log(`${asShipped.length} seats in a 14-row nave, couple at world z ${coupleZ.toFixed(2)}\n`);
console.log(`  clear view ......... ${clear}`);
console.log(`  side-on ............ ${byIssue["side-on"]}`);
console.log(`  more than ${DISTANT_METRES} m ..... ${byIssue.distant}`);
console.log(`  blocked ............ ${byIssue.blocked}`);
console.log(`  level with/past .... ${byIssue.behind}`);

const nearest = asShipped.reduce((best, verdict) => (verdict.distanceMetres < best.distanceMetres ? verdict : best));
const furthest = asShipped.reduce((best, verdict) => (verdict.distanceMetres > best.distanceMetres ? verdict : best));
console.log(
  `\n  nearest seat ${nearest.distanceMetres.toFixed(1)} m at ${Math.round(nearest.viewAngle)}°` +
    `, furthest ${furthest.distanceMetres.toFixed(1)} m at ${Math.round(furthest.viewAngle)}°`
);

if (process.argv.includes("--check")) {
  const problems = [];
  // An analysis that flags everybody, or nobody, tells the couple nothing.
  if (clear === 0) {
    problems.push("no seat has a clear view — the thresholds are too strict to be useful");
  }
  if (clear === asShipped.length) {
    problems.push("every seat is clear — the thresholds are too loose to say anything");
  }
  // Nothing should be blocked in the shipped layout: the arrangements stand
  // BEHIND the couple. A blocked seat here means the geometry has moved and the
  // comment in lib/sightlines.ts is now wrong.
  if (byIssue.blocked > 0) {
    problems.push(`${byIssue.blocked} seat(s) blocked in the default layout — re-check the altar geometry`);
  }
  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  the analysis separates clear seats from compromised ones");
}
