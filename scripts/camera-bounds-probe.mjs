// Assert that every camera in the app starts INSIDE the room it points at.
//
//   node scripts/camera-bounds-probe.mjs          # report
//   node scripts/camera-bounds-probe.mjs --check  # exit non-zero on a violation
//
// Why this exists: an audit on 2026-08-11 measured every camera start against the
// scene's own wall constants and found three of the four /ceremony presets, the
// resting dinner camera and seven of the thirteen preview waypoints sitting
// outside the room they framed — "Overview" 3.1 m behind the west wall, the
// dinner camera 5.25 m past the back of the hall, two waypoints above the hall's
// own ceiling. The owner's report was "the cameras start outside the church so
// you cannot even see", and every one of those was arithmetic, not taste.
//
// The numbers are parsed out of the source rather than duplicated here, so a
// camera edited in the component is the camera this checks.
import { readFileSync } from "node:fs";

const SCENE_UNIT_METRES = 1.591;
const INTERIOR_Z = 0.25;

// World-space interior bounds, derived from the wall geometry in church-scene.tsx
// and re-derived here so a wall move that is not reflected here shows up as a
// disagreement rather than a silent pass.
//   church: side walls args [0.2, 5.6, 12.4] at x ±4.95 z 0.1 -> inner x ±4.85,
//           chancel wall at local z -5.85 (0.22 deep) -> world -5.49,
//           west wall WEST_WALL_Z 6.3 with 0.22-thick piers -> world 6.44
//   hall:   back wall local z -5.75 -> world -5.40, sides x ±4.9 (0.18) -> ±4.81,
//           span 11.8 centred local 0.1 -> world 6.25, ceiling y 3.78 m
const ROOMS = {
  church: { maxX: 4.85, maxY: 5.6 / SCENE_UNIT_METRES, maxZ: 6.44, minZ: -5.49, name: "church nave" },
  hall: { maxX: 4.81, maxY: 3.78 / SCENE_UNIT_METRES, maxZ: 6.25, minZ: -5.4, name: "dinner hall" }
};

// A camera above this is not a person looking; it is a drone. 2.1 m of eye height
// is already generous for a room whose figures are 1.75 m tall.
const MAX_EYE_METRES = 2.1;

function parseVectors(source, pattern) {
  const found = [];
  for (const match of source.matchAll(pattern)) {
    const numbers = match[1].split(",").map((piece) => Number(piece.trim()));
    if (numbers.length === 3 && numbers.every((value) => Number.isFinite(value))) {
      found.push({ line: source.slice(0, match.index).split("\n").length, position: numbers });
    }
  }
  return found;
}

const cameras = [];

const walkthrough = readFileSync("components/preview/preview-walkthrough.tsx", "utf8");
const walkthroughBody = walkthrough.slice(walkthrough.indexOf("const walkthrough: Waypoint[]"));
for (const match of walkthroughBody.matchAll(
  /position:\s*\[([^\]]+)\][\s\S]{0,80}?target:\s*\[([^\]]+)\][\s\S]{0,120}?step:\s*"(\w+)"/g
)) {
  const position = match[1].split(",").map((piece) => Number(piece.trim()));
  const target = match[2].split(",").map((piece) => Number(piece.trim()));
  cameras.push({
    file: "components/preview/preview-walkthrough.tsx",
    index: cameras.length,
    label: `waypoint ${cameras.length}`,
    position,
    room: match[3] === "reception" ? "hall" : "church",
    target
  });
}

// The named framings moved to lib/studio-framings.ts so the home studio and
// /ceremony share one table; read them THERE, or this probe silently checks
// four fewer cameras than the app ships (it did, for one commit).
const framings = readFileSync("lib/studio-framings.ts", "utf8");
const framingBlock = framings.slice(framings.indexOf("export const STUDIO_FRAMINGS"));
for (const match of framingBlock.matchAll(
  /position:\s*\[([^\]]+)\][\s\S]{0,40}?target:\s*\[([^\]]+)\][\s\S]{0,90}?key:\s*"(\w+)"/g
)) {
  cameras.push({
    file: "lib/studio-framings.ts",
    label: `framing "${match[3]}"`,
    position: match[1].split(",").map((piece) => Number(piece.trim())),
    room: "church",
    target: match[2].split(",").map((piece) => Number(piece.trim()))
  });
}

const scene = readFileSync("components/wedding-studio/church-scene.tsx", "utf8");
for (const [table, room] of [["churchPositions", "church"], ["hallPositions", "hall"]]) {
  const start = scene.indexOf(`const ${table}`);
  const block = scene.slice(start, scene.indexOf("};", start));
  for (const entry of parseVectors(block, /:\s*\[([^\]]+)\]/g)) {
    const mode = block.slice(0, block.indexOf(`[${entry.position.join(", ")}]`)).match(/(\w+|"[\w-]+")\s*:\s*$/);
    cameras.push({
      file: "components/wedding-studio/church-scene.tsx",
      label: `${table} ${mode ? mode[1] : "?"}`,
      position: entry.position,
      room,
      // the top-down plan camera is deliberately above the roof
      skipHeight: entry.position[1] > 6
    });
  }
}

// ---------------------------------------------------------------------------
// Where people STAND, parsed from the plan so it cannot drift. A camera dropped
// on one of these renders the inside of a person: the processional shot did
// exactly that at world z -3.2, which is the officiant's mark, and the frame came
// out a featureless cream rectangle. Marks are LOCAL; world z = local + INTERIOR_Z.
// ---------------------------------------------------------------------------
const plan = readFileSync("lib/wedding-studio-plan.ts", "utf8");
const marksBlock = plan.slice(plan.indexOf("export const ceremonyStagingMarks"), plan.indexOf("export const ceremonyStagingMarkIds"));
const OCCUPIED = [];
for (const match of marksBlock.matchAll(/(\w+):\s*\{\s*home:\s*\{\s*x:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)\s*\}/g)) {
  OCCUPIED.push({ role: match[1], x: Number(match[2]), z: Number(match[3]) + INTERIOR_Z });
}
// A standing adult is about 0.30 units across the shoulders; half of that plus the
// camera's 0.3 near plane is the radius inside which the lens sees only torso.
const BODY_CLEARANCE = 0.45;

// The couple's own path, from the scene's constants. The processional shot exists
// to show this walk, so the check is literal: are they in front of the lens and
// inside the horizontal field of view while they walk it?
const sceneSource = readFileSync("components/wedding-studio/church-scene.tsx", "utf8");
function sceneNumber(name) {
  const match = sceneSource.match(new RegExp(`${name}\\s*=\\s*(-?[\\d.]+)`));
  return match ? Number(match[1]) : null;
}
const PATH_START_Z = sceneNumber("PROCESSION_START_Z") + INTERIOR_Z;
const PATH_END_Z = sceneNumber("PROCESSION_END_Z") + INTERIOR_Z;
const BRIDE_X = 0.26;
const FOV_DEGREES = 40;
// The frame is wider than it is tall, so the HORIZONTAL half-angle is the
// generous one; using the vertical fov here would reject shots that are fine.
const ASPECT = 16 / 10;
const HALF_FOV = Math.atan(Math.tan((FOV_DEGREES / 2) * (Math.PI / 180)) * ASPECT);

function framesTheCouple(camera) {
  if (!camera.target) {
    return { note: "no target parsed", ok: true };
  }
  const forward = [camera.target[0] - camera.position[0], camera.target[2] - camera.position[2]];
  const forwardLength = Math.hypot(forward[0], forward[1]) || 1;
  const unit = [forward[0] / forwardLength, forward[1] / forwardLength];
  const samples = [0, 0.25, 0.5];
  const seen = samples.filter((t) => {
    const z = PATH_START_Z + (PATH_END_Z - PATH_START_Z) * t;
    const to = [BRIDE_X - camera.position[0], z - camera.position[2]];
    const distance = Math.hypot(to[0], to[1]);
    if (distance < 0.01) {
      return false;
    }
    const dot = (to[0] * unit[0] + to[1] * unit[1]) / distance;
    return dot > 0 && Math.acos(Math.min(1, dot)) <= HALF_FOV;
  });
  return {
    note: `bride visible at ${seen.length}/${samples.length} points of the walk`,
    ok: seen.length >= 2
  };
}

let failures = 0;
for (const camera of cameras) {
  const room = ROOMS[camera.room];
  const [x, y, z] = camera.position;
  const problems = [];
  if (Math.abs(x) > room.maxX) {
    problems.push(`x ${x} is ${((Math.abs(x) - room.maxX) * SCENE_UNIT_METRES).toFixed(2)} m past the side wall`);
  }
  if (z > room.maxZ) {
    problems.push(`z ${z} is ${((z - room.maxZ) * SCENE_UNIT_METRES).toFixed(2)} m past the back wall`);
  }
  if (z < room.minZ) {
    problems.push(`z ${z} is ${((room.minZ - z) * SCENE_UNIT_METRES).toFixed(2)} m past the far wall`);
  }
  if (!camera.skipHeight && y > room.maxY) {
    problems.push(`y ${y} is above the ceiling (${(room.maxY).toFixed(2)} units)`);
  }
  if (!camera.skipHeight && y * SCENE_UNIT_METRES > MAX_EYE_METRES) {
    problems.push(`eye height ${(y * SCENE_UNIT_METRES).toFixed(2)} m — nobody is that tall`);
  }
  if (camera.room === "church" && !camera.skipHeight) {
    for (const person of OCCUPIED) {
      const distance = Math.hypot(x - person.x, z - person.z);
      if (distance < BODY_CLEARANCE) {
        problems.push(`stands ${(distance * SCENE_UNIT_METRES).toFixed(2)} m from the ${person.role} — inside a person`);
      }
    }
  }
  if (camera.target) {
    const [tx, , tz] = camera.target;
    if (Math.abs(tx) > room.maxX || tz > room.maxZ || tz < room.minZ) {
      problems.push(`aims at (${tx}, ${tz}), which is outside the ${room.name}`);
    }
  }
  // Waypoint 2 is the processional; it exists to show the walk.
  let framing = null;
  if (camera.index === 2) {
    framing = framesTheCouple(camera);
    if (!framing.ok) {
      problems.push(`the processional shot does not frame the couple — ${framing.note}`);
    }
  }
  if (problems.length) {
    failures += 1;
    console.log(`  FAIL  ${camera.label} (${room.name}) — ${problems.join("; ")}`);
  } else {
    const extra = framing ? `, ${framing.note}` : "";
    console.log(`  PASS  ${camera.label} — inside the ${room.name} at ${(y * SCENE_UNIT_METRES).toFixed(2)} m${extra}`);
  }
}

console.log(
  `\n${cameras.length} cameras checked against ${OCCUPIED.length} standing positions, ${failures} with problems.`
);
if (process.argv.includes("--check") && failures > 0) {
  process.exit(1);
}
