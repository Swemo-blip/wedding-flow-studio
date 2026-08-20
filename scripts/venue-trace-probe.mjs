// Does a traced venue produce a room a vendor could work from?
//
//   node scripts/venue-trace-probe.mjs           # report the reference traces
//   node scripts/venue-trace-probe.mjs --check   # exit non-zero if the geometry is unsound
//   node scripts/venue-trace-probe.mjs --regress # prove the checks CATCH a broken fit
//
// The property that matters more than any other: NO SEAT MAY LAND OUTSIDE THE ROOM.
// A floor plan that puts three guests inside a wall is worse than no floor plan,
// because a venue manager will believe it. Everything else here is secondary.
//
// Like the sightline probe, this IMPORTS the shipped modules rather than carrying a
// copy of the arithmetic — Node 24 strips TypeScript natively, so the only thing in
// the way is the "@/" alias, rewritten as the files are copied to a temp directory.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "venue-"));
for (const name of ["venue-trace", "venue-seating"]) {
  writeFileSync(
    join(dir, `${name}.ts`),
    readFileSync(`lib/${name}.ts`, "utf8").replace(/from "@\/lib\/([\w-]+)"/g, 'from "./$1.ts"')
  );
}
const trace = await import(pathToFileURL(join(dir, "venue-trace.ts")).href);
const seating = await import(pathToFileURL(join(dir, "venue-seating.ts")).href);

// ---------------------------------------------------------------------------
// Reference traces. Each is what a person would actually have clicked, in image
// pixels, so the calibration is exercised rather than bypassed.
// A 10 px = 1 m drawing throughout, set by a 500 px calibration line called 50 m.
// ---------------------------------------------------------------------------
const CALIBRATION = { a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, metres: 50 };

const ROOMS = {
  // 18 m wide, 30 m deep. The front edge is the SHORT one at the top.
  "rectangular hall": {
    frontEdge: 0,
    outline: [
      { x: 100, y: 100 },
      { x: 280, y: 100 },
      { x: 280, y: 400 },
      { x: 100, y: 400 }
    ]
  },
  // Same footprint with a 9 x 12 m bite out of the back-right: the shape a scanline
  // gets right and a bounding box gets wrong.
  "L-shaped hall": {
    frontEdge: 0,
    outline: [
      { x: 100, y: 100 },
      { x: 280, y: 100 },
      { x: 280, y: 280 },
      { x: 190, y: 280 },
      { x: 190, y: 400 },
      { x: 100, y: 400 }
    ]
  },
  // THE SAME 18 x 30 m room as the rectangle, traced anticlockwise and starting
  // from a different corner, with frontEdge pointing at the same physical wall.
  // Proves the result does not depend on which corner the couple clicked first —
  // the check below asserts the two measure the same.
  "traced the other way round": {
    frontEdge: 3,
    outline: [
      { x: 100, y: 100 },
      { x: 100, y: 400 },
      { x: 280, y: 400 },
      { x: 280, y: 100 }
    ]
  }
};

const SEATING = { ...seating.DEFAULT_VENUE_SEATING, maxGuests: 400 };

function analyse(name) {
  const room = trace.resolveVenueTrace({ v: 1, calibration: CALIBRATION, ...ROOMS[name] });
  if (!room) {
    return { name, room: null };
  }
  const seats = seating.fitSeatsToRoom({ ...SEATING, polygon: room.polygon });
  const outside = seats.filter((seat) => !trace.isInsideRoom(room.polygon, seat));
  const inAisle = seats.filter((seat) => Math.abs(seat.x) < SEATING.aisleMetres / 2);
  return { inAisle, name, outside, room, seats };
}

const results = Object.keys(ROOMS).map(analyse);

if (process.argv.includes("--regress")) {
  const problems = [];

  // 1. A room whose seats are laid on the BOUNDING BOX rather than the shape. This
  //    is the exact failure the scanline exists to prevent, so it must be caught.
  const l = analyse("L-shaped hall");
  const boxed = seating.fitSeatsToRoom({
    ...SEATING,
    // UNCAPPED on purpose. With the 400-guest cap the fill stops at y 15.8, before
    // it ever reaches the corner that was cut away at y 18 — so the test passed
    // while proving nothing. A regression fixture that cannot reach the bug is the
    // same failure this project already recorded for the sightline --regress.
    maxGuests: Number.MAX_SAFE_INTEGER,
    polygon: [
      { x: -9, y: 0 },
      { x: 9, y: 0 },
      { x: 9, y: 30 },
      { x: -9, y: 30 }
    ]
  });
  const escaped = boxed.filter((seat) => !trace.isInsideRoom(l.room.polygon, seat));
  console.log(`Seats laid on the bounding box instead of the L: ${escaped.length} land outside the room`);
  if (escaped.length === 0) {
    problems.push("laying seats on the bounding box did not put any of them outside the L — the inside test is broken");
  }

  // 2. A calibration line too short to trust must be REFUSED, not scaled.
  const shaky = trace.resolveVenueTrace({
    v: 1,
    calibration: { a: { x: 0, y: 0 }, b: { x: 12, y: 0 }, metres: 50 },
    ...ROOMS["rectangular hall"]
  });
  console.log(`A 12 px calibration line called 50 m: ${shaky === null ? "refused" : "ACCEPTED"}`);
  if (shaky !== null) {
    problems.push("a 12 px calibration line was accepted — the whole venue would be scaled wrong");
  }

  // 3. An outline with two corners cannot enclose anything.
  const open = trace.resolveVenueTrace({
    v: 1,
    calibration: CALIBRATION,
    frontEdge: 0,
    outline: [
      { x: 100, y: 100 },
      { x: 280, y: 100 }
    ]
  });
  console.log(`A two-corner outline: ${open === null ? "refused" : "ACCEPTED"}`);
  if (open !== null) {
    problems.push("a two-corner outline produced a room");
  }

  // 4. The L must seat FEWER than the rectangle it is cut from. If it does not, the
  //    scanline is not clipping and the shape is decorative.
  // Uncapped, or maxGuests hides the very difference being tested.
  const rectCapacity = seating.venueSeatingCapacity({ ...SEATING, polygon: analyse("rectangular hall").room.polygon });
  const lCapacity = seating.venueSeatingCapacity({ ...SEATING, polygon: l.room.polygon });
  console.log(`Rectangle holds ${rectCapacity}, the L cut from it holds ${lCapacity}`);
  if (lCapacity >= rectCapacity) {
    problems.push("the L-shaped room seats as many as the full rectangle — the shape is being ignored");
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  every way of getting this wrong is caught");
  process.exit(0);
}

for (const result of results) {
  if (!result.room) {
    console.log(`${result.name}: REFUSED`);
    continue;
  }
  const { room, seats } = result;
  console.log(`${result.name}`);
  console.log(`  ${room.widthMetres} x ${room.depthMetres} m, ${room.areaMetres} m2, ${room.metresPerPixel.toFixed(4)} m/px`);
  console.log(`  seats ${seats.length}, rows ${new Set(seats.map((seat) => seat.row)).size}`);
  console.log(`  outside the walls ${result.outside.length}, standing in the aisle ${result.inAisle.length}\n`);
}

if (process.argv.includes("--check")) {
  const problems = [];

  for (const result of results) {
    if (!result.room) {
      problems.push(`${result.name} produced no room at all`);
      continue;
    }
    // THE property. Everything else on this page is decoration if this fails.
    if (result.outside.length > 0) {
      problems.push(`${result.name}: ${result.outside.length} seat(s) land outside the walls`);
    }
    if (result.inAisle.length > 0) {
      problems.push(`${result.name}: ${result.inAisle.length} seat(s) stand in the aisle`);
    }
    if (result.seats.length === 0) {
      problems.push(`${result.name}: seats nobody — a traced room that seats no one is not a room`);
    }
  }

  // The two rectangles are the same 18 x 30 m room traced differently — one
  // clockwise from the top edge, one anticlockwise from the right. They must agree,
  // or the feature depends on which corner the couple happened to click first.
  const rect = results.find((result) => result.name === "rectangular hall");
  const flipped = results.find((result) => result.name === "traced the other way round");
  const sameWidth = Math.abs(rect.room.widthMetres - flipped.room.widthMetres) < 0.15;
  const sameDepth = Math.abs(rect.room.depthMetres - flipped.room.depthMetres) < 0.15;
  if (!sameWidth || !sameDepth) {
    problems.push(
      `the same room traced two ways measured ${rect.room.widthMetres}x${rect.room.depthMetres} and ` +
        `${flipped.room.widthMetres}x${flipped.room.depthMetres} — winding or front edge is not honoured`
    );
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("  PASS  every traced room seats its guests inside its own walls");
}
