// Where does the photographer stand, and is the answer true?
//
//   node scripts/photography-probe.mjs           # report the nave and a traced hall
//   node scripts/photography-probe.mjs --check   # exit non-zero if the answer is unsound
//   node scripts/photography-probe.mjs --regress # prove the checks CATCH a bad spot
//
// The claim this feature rests on is strong enough to need proving rather than
// asserting: during the vows the couple face each other, so NO position in the room
// sees both faces. If that is ever false, the product is telling a photographer to
// plan around a constraint that does not exist.
//
// Imports the shipped modules, like the other probes — one copy of the arithmetic.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "photo-"));
for (const name of ["photography", "sightlines", "scene-units", "venue-trace", "venue-seating", "church-seating"]) {
  writeFileSync(
    join(dir, `${name}.ts`),
    readFileSync(`lib/${name}.ts`, "utf8").replace(/from "@\/lib\/([\w-]+)"/g, 'from "./$1.ts"')
  );
}
const photo = await import(pathToFileURL(join(dir, "photography.ts")).href);
const sight = await import(pathToFileURL(join(dir, "sightlines.ts")).href);
const church = await import(pathToFileURL(join(dir, "church-seating.ts")).href);
const trace = await import(pathToFileURL(join(dir, "venue-trace.ts")).href);
const venueSeating = await import(pathToFileURL(join(dir, "venue-seating.ts")).href);

const INTERIOR_Z = 0.25;
const SCENE_UNIT_METRES = 1.591;

// ---- The church, as the studio renders it ----
function navePlan() {
  const layout = church.churchSeatLayout({ aisleWidthFeet: 5, seatingLayout: "Traditional" });
  const seats = church
    .buildChurchSeatedGuests(14, 112, layout)
    .map((seat) => ({ x: seat.position[0], z: seat.position[2] + INTERIOR_Z }));
  const obstacles = [
    ...sight.churchSightlineObstacles({
      celebrantMark: { x: 0, z: 0 },
      floralMark: { x: 0, z: 0 },
      focalPointEdit: { x: 0, z: 0 },
      interiorZ: INTERIOR_Z,
      showSinger: false,
      singerMark: { x: 0, z: 0 }
    }),
    ...sight.seatedGuestObstacles(seats.map((seat, index) => ({ id: `s${index}`, ...seat })))
  ];
  const zs = seats.map((seat) => seat.z);
  return {
    coupleX: 0.26,
    coupleZ: church.PROCESSION_END_Z + INTERIOR_Z,
    bounds: { maxX: 4.4, maxZ: Math.max(...zs) + 1, minX: -4.4, minZ: church.PROCESSION_END_Z + INTERIOR_Z },
    obstacles,
    seats
  };
}

// ---- A traced L-shaped hall, 18 x 30 m, with two pillars ----
function tracedPlan() {
  const room = trace.resolveVenueTrace({
    v: 1,
    calibration: { a: { x: 0, y: 0 }, b: { x: 500, y: 0 }, metres: 50 },
    frontEdge: 0,
    outline: [
      { x: 100, y: 100 },
      { x: 280, y: 100 },
      { x: 280, y: 280 },
      { x: 190, y: 280 },
      { x: 190, y: 400 },
      { x: 100, y: 400 }
    ],
    pillars: [
      { radius: 12, x: 150, y: 200 },
      { radius: 12, x: 230, y: 200 }
    ]
  });
  const fitted = venueSeating.fitSeatsToRoom({
    ...venueSeating.DEFAULT_VENUE_SEATING,
    maxGuests: 112,
    pillars: room.pillars,
    polygon: room.polygon
  });
  const toUnits = (metres) => metres / SCENE_UNIT_METRES;
  const seats = fitted.map((seat) => ({ x: toUnits(seat.x), z: toUnits(seat.y) }));
  const obstacles = [
    ...room.pillars.map((pillar) => ({
      kind: "fixture",
      label: "a pillar",
      radius: toUnits(pillar.radiusMetres),
      topY: 99,
      x: toUnits(pillar.x),
      z: toUnits(pillar.y)
    })),
    ...sight.seatedGuestObstacles(seats.map((seat, index) => ({ id: `s${index}`, ...seat })))
  ];
  const xs = room.polygon.map((point) => point.x);
  const ys = room.polygon.map((point) => point.y);
  return {
    coupleX: 0,
    coupleZ: toUnits(venueSeating.DEFAULT_VENUE_SEATING.frontClearanceMetres / 2),
    bounds: {
      maxX: toUnits(Math.max(...xs)),
      maxZ: toUnits(Math.max(...ys)),
      minX: toUnits(Math.min(...xs)),
      minZ: toUnits(Math.min(...ys))
    },
    insideRoom: (point) =>
      trace.isInsideRoom(room.polygon, { x: point.x * SCENE_UNIT_METRES, y: point.z * SCENE_UNIT_METRES }),
    obstacles,
    room,
    seats
  };
}

const ROOMS = { "the studio church": navePlan(), "a traced L-shaped hall": tracedPlan() };
const results = Object.fromEntries(Object.entries(ROOMS).map(([name, input]) => [name, photo.planPhotography(input)]));

function describe(zone) {
  if (!zone || !zone.nearestWorkable) {
    return "none";
  }
  return (
    `${zone.count} spots ${zone.nearestMetres}-${zone.furthestMetres} m, ` +
    `nearest workable ${zone.nearestWorkable.distanceMetres} m at (${zone.nearestWorkable.x.toFixed(2)}, ${zone.nearestWorkable.z.toFixed(2)})`
  );
}

if (process.argv.includes("--regress")) {
  const problems = [];

  // 1. A pillar planted between every candidate and the couple must remove the
  //    spots it covers. A wide one across the bride's side is the honest test.
  const base = ROOMS["the studio church"];
  const walled = photo.planPhotography({
    ...base,
    obstacles: [
      ...base.obstacles,
      // Floor to ceiling, 1.2 units (1.9 m) wide, standing on the BRIDE's side
      // only. The first version of this fixture was 3 units wide and reached
      // across the aisle, so it blocked the whole room and proved nothing about
      // sides — a regression that fires for the wrong reason still passes.
      { kind: "fixture", label: "a test screen", radius: 1.2, topY: 99, x: -2.6, z: base.coupleZ + 1.4 }
    ]
  });
  console.log(
    `A screen across the bride's side: clear spots ${results["the studio church"].clearSpots} -> ${walled.clearSpots}, ` +
      `bride zone ${describe(results["the studio church"].bride)} -> ${describe(walled.bride)}`
  );
  if (walled.clearSpots >= results["the studio church"].clearSpots) {
    problems.push("a floor-to-ceiling screen removed no standing positions — the obstacle test is not running");
  }
  // It stood on HER side, so it must cost her zone more than his.
  const lostBride = results["the studio church"].bride.count - walled.bride.count;
  const lostGroom = results["the studio church"].groom.count - walled.groom.count;
  console.log(`  it cost the bride's side ${lostBride} spots and the groom's ${lostGroom}`);
  if (lostBride <= lostGroom) {
    problems.push("a screen on the bride's side cost her side no more than his — the geometry is not side-aware");
  }

  // 2. If the couple ever stopped facing each other, seesBoth would have to change.
  //    Proven by asking the same question of a point set where they face the SAME
  //    way: facesVisibleFrom is driven by the couple's own facing, so a camera
  //    directly in front must see the one whose face points at it and not the other.
  const front = photo.facesVisibleFrom({ x: -5, z: 0 }, { x: 0, z: 0 });
  const behind = photo.facesVisibleFrom({ x: 5, z: 0 }, { x: 0, z: 0 });
  console.log(`Standing on the bride's side: bride ${front.bride}, groom ${front.groom}`);
  console.log(`Standing on the groom's side: bride ${behind.bride}, groom ${behind.groom}`);
  if (!front.bride || front.groom || behind.bride || !behind.groom) {
    problems.push("the two facing tests do not mirror each other — one of them is wrong");
  }

  // 3. A room with nowhere legal to stand must answer "none", not guess.
  const boxed = photo.planPhotography({
    ...base,
    insideRoom: () => false
  });
  console.log(`A room with no legal standing position: ${boxed.clearSpots} spots, bride ${describe(boxed.bride)}`);
  if (boxed.clearSpots !== 0 || boxed.bride.nearestWorkable !== null) {
    problems.push("a room with nowhere to stand still produced a recommendation");
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  the photographer's answer responds to the room it is asked about");
  process.exit(0);
}

for (const [name, plan] of Object.entries(results)) {
  console.log(name);
  console.log(`  standing positions with a clear view ... ${plan.clearSpots}`);
  console.log(`  the front row sits ..................... ${plan.frontRowMetres} m from the couple`);
  console.log(`  her face, from the left ................ ${describe(plan.bride)}`);
  console.log(`  his face, from the right ............... ${describe(plan.groom)}`);
  console.log(`  on the aisle, both in profile .......... ${describe(plan.aisle)}`);
  console.log(`  any spot that sees BOTH faces .......... ${plan.seesBoth ? "*** YES ***" : "no"}`);
  console.log(`  seated crowd ever in the way .......... ${plan.crowdBlocks ? "yes" : "no"}\n`);
}

if (process.argv.includes("--check")) {
  const problems = [];

  for (const [name, plan] of Object.entries(results)) {
    // THE claim. If a position ever sees both faces, the advice this feature gives
    // — plan a move, or bring a second shooter — is wrong.
    if (plan.seesBoth) {
      problems.push(`${name}: a position sees both faces — the vow facing has changed and the advice is now wrong`);
    }
    if (plan.clearSpots === 0) {
      problems.push(`${name}: no standing position has a clear view, which cannot be right`);
    }
    if (!plan.bride.nearestWorkable || !plan.groom.nearestWorkable) {
      problems.push(`${name}: no spot found for one of the two faces`);
    }
    // The bride faces -x, so her face is readable from the -x side. A recommendation
    // on the wrong side of the aisle would send a photographer to the back of her head.
    if (plan.bride.nearestWorkable && plan.bride.nearestWorkable.x >= 0.26) {
      problems.push(`${name}: the bride-face spot sits on the groom's side of the couple`);
    }
    if (plan.groom.nearestWorkable && plan.groom.nearestWorkable.x <= 0.26) {
      problems.push(`${name}: the groom-face spot sits on the bride's side of the couple`);
    }
    // A standing eye at 1.60 m clears a seated crown at 1.36 m, so the crowd must
    // never be what stops a photographer. If this fires, the eye height is not
    // reaching the obstacle test.
    if (plan.crowdBlocks) {
      problems.push(`${name}: the seated crowd blocks a standing photographer — check STANDING_EYE_Y is being used`);
    }
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("  PASS  no position sees both faces, and each recommendation is on the right side of the aisle");
}
