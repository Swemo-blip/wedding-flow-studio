// Who can actually see the ceremony?
//
//   node scripts/sightline-probe.mjs           # report the nave as it stands
//   node scripts/sightline-probe.mjs --check   # exit non-zero if the analysis is unsound
//   node scripts/sightline-probe.mjs --regress # prove it CATCHES a reachable obstruction
//
// This exists for the same reason check:cameras does: the analysis makes a claim
// to the couple, and a claim shown to a person must be measured, not assumed.
//
// TWO THINGS THIS PROBE GOT WRONG THE FIRST TIME, both now structural:
//
// 1. IT RE-IMPLEMENTED THE ARITHMETIC IT WAS MEANT TO VERIFY, and had already
//    drifted from it (it dropped floralMark.x entirely). It now IMPORTS the shipped
//    modules — the analysis AND the seat grid — so there is exactly one copy of
//    each and a drift is impossible rather than merely unlikely.
// 2. ITS REGRESSION EXERCISED A STATE NO USER CAN REACH. It dragged the altar
//    florals 2.4 units when clampStagingOffset caps that mark at 0.9 — certifying
//    detection of something impossible, which is the exact trap CLAUDE.md records
//    for the camera body-clearance check. The regression now drags the OFFICIANT
//    to his real clamp of 1.5, which genuinely carries him in front of the couple.
//    If a check cannot be triggered from the UI, it is decoration.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Import the shipped TypeScript with no build step and no dependency: Node 24
// strips types natively, so the only obstacle is the "@/" path alias, which
// tsconfig resolves and Node does not. Copy the modules to a temp directory with
// those imports rewritten and load them for real.
// ---------------------------------------------------------------------------
async function loadLib() {
  const dir = mkdtempSync(join(tmpdir(), "sightlines-"));
  for (const name of ["scene-units.ts", "church-seating.ts", "sightlines.ts"]) {
    writeFileSync(
      join(dir, name),
      readFileSync(`lib/${name}`, "utf8").replace(/from "@\/lib\/([a-z-]+)"/g, 'from "./$1.ts"')
    );
  }
  const load = (name) => import(pathToFileURL(join(dir, name)).href);
  return { seating: await load("church-seating.ts"), sightlines: await load("sightlines.ts"), units: await load("scene-units.ts") };
}

const planSource = readFileSync("lib/wedding-studio-plan.ts", "utf8");

// The reaches the UI actually enforces, parsed out of the plan so this probe can
// never test past them again. This is the only thing still read as text; all the
// geometry is imported.
function markReach(markId) {
  // The nested `home: { ... }` sits between the id and the reach, so this cannot be
  // a [^}] scan — it has to cross one closing brace.
  const match = planSource.match(new RegExp(`${markId}:\\s*\\{[\\s\\S]*?reach:\\s*([\\d.]+)`));
  if (!match) {
    throw new Error(`could not find reach for ${markId}`);
  }
  return Number(match[1]);
}
const CELEBRANT_REACH = markReach("celebrant");
const FLORALS_REACH = markReach("florals");

const { seating, sightlines: lib, units } = await loadLib();
const { INTERIOR_Z } = units;
const { buildChurchSeatedGuests, churchSeatLayout, PROCESSION_END_Z } = seating;
const ROWS = 14;

function run({
  aisleWidthFeet = 5,
  celebrantMark = { x: 0, z: 0 },
  coupleMark = { x: 0, z: 0 },
  floralMark = { x: 0, z: 0 },
  focalPointEdit = { x: 0, z: 0 },
  seatingLayout = "Traditional",
  showSinger = false,
  singerMark = { x: 0, z: 0 }
} = {}) {
  const layout = churchSeatLayout({ aisleWidthFeet, seatingLayout });
  // The REAL seat builder, with a guest count high enough to fill all 14 rows, so
  // the probe measures a full nave rather than a grid of its own invention.
  const seats = buildChurchSeatedGuests(ROWS, ROWS * 8, layout).map((seat) => ({
    id: seat.id,
    x: seat.position[0],
    z: seat.position[2] + INTERIOR_Z
  }));
  const obstacles = lib.churchSightlineObstacles({
    celebrantMark,
    floralMark,
    focalPointEdit,
    interiorZ: INTERIOR_Z,
    showSinger,
    singerMark
  });
  const verdicts = lib.analyzeSightlines({
    coupleX: 0.26 + coupleMark.x,
    coupleZ: PROCESSION_END_Z + coupleMark.z + INTERIOR_Z,
    obstacles: [...obstacles, ...lib.seatedGuestObstacles(seats)],
    seats
  });
  return { summary: lib.summarizeSightlines(verdicts), verdicts };
}

const asShipped = run();

if (process.argv.includes("--regress")) {
  const problems = [];

  // 1. The officiant, at the reach the UI grants him. Home z -3.55 + 1.5 puts him
  //    at world -1.80, half a unit in FRONT of the couple.
  const moved = run({ celebrantMark: { x: 0, z: CELEBRANT_REACH } });
  const blocked = moved.summary.blocked;
  console.log(`Officiant dragged ${CELEBRANT_REACH} forward (his real clamp): ${blocked.length} seat(s) blocked`);
  for (const seat of blocked.slice(0, 5)) {
    console.log(`  ${seat.id} — cannot see past ${seat.blockedBy}`);
  }
  if (blocked.length === 0) {
    problems.push("the analysis did not notice the officiant standing in front of the couple");
  }

  // 2. The altar florals at THEIR real clamp. This is expected NOT to block — they
  //    start 1.84 units behind the couple and 0.9 does not close that. Reported so
  //    the limit is visible rather than mistaken for a passing test.
  const florals = run({ floralMark: { x: 0, z: FLORALS_REACH } });
  console.log(
    `\nAltar florals dragged ${FLORALS_REACH} forward (their real clamp): ` +
      `${florals.summary.blocked.length} seat(s) blocked — expected 0, they cannot reach past the couple`
  );

  // 3. The couple walked toward the guests: seats become level with them.
  const forward = run({ coupleMark: { x: 0, z: 1.2 } });
  console.log(`\nCouple dragged 1.2 toward the guests: ${forward.summary.levelWithCouple} seat(s) level with them`);
  if (forward.summary.levelWithCouple === 0) {
    problems.push("the couple stepping into the front rows did not register");
  }

  // 4. BOTH SEATING CONTROLS MUST MOVE THE NUMBERS. This is the check that would
  //    have caught the panel shipping blind to the two controls above it — and each
  //    control is asserted against the number it ACTUALLY moves, measured rather
  //    than assumed: the aisle slider drives heads-in-line hard, while Spaced rows
  //    barely touches it and instead pushes the back row further away.
  //
  //    Note what is asserted about the aisle: that the number MOVES, not which way.
  //    The direction is not monotone — on a full 14-row nave a wider aisle helps,
  //    but on a small one it can hurt (measured live: 2 → 3 going from 5 ft to
  //    10 ft), because seats pushed outward look along their own row more obliquely.
  //    That is exactly why the panel states the count and gives no advice, and this
  //    check must not assert a direction the product does not claim.
  const narrow = run({ aisleWidthFeet: 3 }).summary.headInLine;
  const wide = run({ aisleWidthFeet: 8 }).summary.headInLine;
  console.log(`\nHeads in the line — 3 ft aisle ${narrow}, 8 ft aisle ${wide}`);
  if (narrow === wide) {
    problems.push("the aisle width changed nothing — the aisle control is not wired in");
  }

  const traditionalDepth = run({ seatingLayout: "Traditional" }).summary.furthestMetres;
  const spacedDepth = run({ seatingLayout: "Spaced rows" }).summary.furthestMetres;
  console.log(`Back row — Traditional ${traditionalDepth} m, Spaced rows ${spacedDepth} m`);
  if (spacedDepth <= traditionalDepth) {
    problems.push("Spaced rows did not push the back row further — the layout control is not wired in");
  }

  // 5. The singer toggle adds two obstacles, so it must be able to change something.
  const singer = run({ showSinger: true, singerMark: { x: -1.8, z: 0 } });
  console.log(`\nSinger on and dragged toward the aisle: ${singer.summary.blocked.length} seat(s) blocked`);

  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  every obstruction the UI can actually create is detected");
  process.exit(0);
}

const { summary } = asShipped;
console.log(`${summary.total} seats in a ${ROWS}-row nave, couple at world z ${(PROCESSION_END_Z + INTERIOR_Z).toFixed(2)}\n`);
console.log("  During the vows the couple face each other, so:");
console.log(`    see the bride's face ..... ${summary.brideFace}`);
console.log(`    see the groom's face ..... ${summary.groomFace}`);
console.log(`    both in profile .......... ${summary.profile}`);
console.log("\n  Problems the couple can act on:");
console.log(`    blocked by a fixture .... ${summary.blocked.length}`);
console.log(`    level with the couple ... ${summary.levelWithCouple}`);
console.log("\n  Measured facts, no threshold attached:");
console.log(`    back row ................ ${summary.furthestMetres} m from the altar`);
console.log(`    a guest's head in line .. ${summary.headInLine} of ${summary.total} (Traditional rows)`);
console.log(`                              ${run({ seatingLayout: "Spaced rows" }).summary.headInLine} with Spaced rows`);

if (process.argv.includes("--check")) {
  const problems = [];

  // The facing split is the panel's headline and the shared plan's legend, so it has
  // to be non-degenerate: a nave where nobody sees either face means the geometry or
  // the facing rule moved.
  if (summary.brideFace === 0 || summary.groomFace === 0) {
    problems.push("no seat sees one of the two faces — the vow facing rule is broken");
  }
  if (summary.brideFace + summary.groomFace + summary.profile !== summary.total) {
    problems.push("the facing split does not account for every seat");
  }

  // Nothing may block in the DEFAULT layout: measured, every fixture starts behind
  // the couple. A blocked seat here means the altar geometry moved and the
  // derivation in lib/sightlines.ts is now wrong.
  if (summary.blocked.length > 0) {
    problems.push(`${summary.blocked.length} seat(s) blocked in the default layout — re-check the altar geometry`);
  }
  if (summary.levelWithCouple > 0) {
    problems.push("a seat is level with the couple in the default layout — the couple's mark moved");
  }

  // Heads are the dominant occluder and the reason the count is worth printing. If
  // they ever come back as zero, the head model has silently stopped being applied
  // and the layout line in the panel is a lie.
  if (summary.headInLine === 0) {
    problems.push("no seat has a head in the line — the congregation is no longer being measured");
  }
  if (summary.headInLine === summary.total) {
    problems.push("every seat has a head in the line — the head model is too coarse to say anything");
  }

  // The lean allowance is what stops this crying wolf, so prove it is still real.
  const leanMatch = readFileSync("lib/sightlines.ts", "utf8").match(/LEAN_UNITS\s*=\s*([\d.]+)/);
  if (!leanMatch || !(Number(leanMatch[1]) > 0)) {
    problems.push("LEAN_UNITS is not positive — every thin object will read as a blocked view");
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  the analysis answers a non-trivial question and flags nothing false at rest");
}
