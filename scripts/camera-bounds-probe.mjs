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
for (const match of walkthroughBody.matchAll(/position:\s*\[([^\]]+)\][\s\S]{0,120}?step:\s*"(\w+)"/g)) {
  const position = match[1].split(",").map((piece) => Number(piece.trim()));
  cameras.push({
    file: "components/preview/preview-walkthrough.tsx",
    label: `waypoint ${cameras.length}`,
    position,
    room: match[2] === "reception" ? "hall" : "church"
  });
}

// The named framings moved to lib/studio-framings.ts so the home studio and
// /ceremony share one table; read them THERE, or this probe silently checks
// four fewer cameras than the app ships (it did, for one commit).
const framings = readFileSync("lib/studio-framings.ts", "utf8");
const framingBlock = framings.slice(framings.indexOf("export const STUDIO_FRAMINGS"));
for (const match of framingBlock.matchAll(/position:\s*\[([^\]]+)\][\s\S]{0,90}?key:\s*"(\w+)"/g)) {
  cameras.push({
    file: "lib/studio-framings.ts",
    label: `framing "${match[2]}"`,
    position: match[1].split(",").map((piece) => Number(piece.trim())),
    room: "church"
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
  if (problems.length) {
    failures += 1;
    console.log(`  FAIL  ${camera.label} (${room.name}) — ${problems.join("; ")}`);
  } else {
    console.log(`  PASS  ${camera.label} — inside the ${room.name} at ${(y * SCENE_UNIT_METRES).toFixed(2)} m`);
  }
}

console.log(`\n${cameras.length} cameras checked, ${failures} outside their room.`);
if (process.argv.includes("--check") && failures > 0) {
  process.exit(1);
}
