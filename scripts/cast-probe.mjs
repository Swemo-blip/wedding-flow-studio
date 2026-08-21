// Does the wedding party actually change who can see the ceremony?
//
//   node scripts/cast-probe.mjs           # what each cast costs the room
//   node scripts/cast-probe.mjs --check   # exit non-zero if the cast model is unsound
//   node scripts/cast-probe.mjs --regress # prove the checks CATCH a party in the way
//
// This probe was written to answer a question BEFORE any figure was modelled: is a
// wedding party standing at the front a real sightline effect, or a rounding error?
//
// THE ANSWER WAS NEITHER, and it is the useful kind of surprise. A party standing
// where a party actually stands — upstage of the couple, fanned out — blocks NOBODY,
// at any size, because nothing behind the target can occlude it. What decides the
// cost is the LINE THEY STAND ON, and party size barely registers. So this probe
// now sweeps the position rather than counting heads, and --check asserts the shape
// of that truth rather than a number that would drift.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "cast-"));
for (const name of ["ceremony-cast", "sightlines", "scene-units", "church-seating"]) {
  writeFileSync(
    join(dir, `${name}.ts`),
    readFileSync(`lib/${name}.ts`, "utf8").replace(/from "@\/lib\/([\w-]+)"/g, 'from "./$1.ts"')
  );
}
const cast = await import(pathToFileURL(join(dir, "ceremony-cast.ts")).href);
const sight = await import(pathToFileURL(join(dir, "sightlines.ts")).href);
const church = await import(pathToFileURL(join(dir, "church-seating.ts")).href);

const INTERIOR_Z = 0.25;
const GUESTS = 112;
const ROWS = 14;

const layout = church.churchSeatLayout({ aisleWidthFeet: 5, seatingLayout: "Traditional" });
const seats = church.buildChurchSeatedGuests(ROWS, GUESTS, layout).map((seat) => ({
  id: seat.id,
  x: seat.position[0],
  z: seat.position[2] + INTERIOR_Z
}));

function analyse(members) {
  const obstacles = [
    ...cast.castSightlineObstacles(members, INTERIOR_Z),
    // The altar arrangements stay in, so the party is measured on top of the room
    // as it really is rather than in an empty chancel.
    ...sight.churchSightlineObstacles({
      celebrantMark: { x: 0, z: 0 },
      floralMark: { x: 0, z: 0 },
      focalPointEdit: { x: 0, z: 0 },
      interiorZ: INTERIOR_Z,
      showSinger: false,
      singerMark: { x: 0, z: 0 }
    }).filter((obstacle) => obstacle.label !== "the officiant"),
    ...sight.seatedGuestObstacles(seats)
  ];
  const verdicts = sight.analyzeSightlines({
    coupleX: 0.26,
    coupleZ: church.PROCESSION_END_Z + INTERIOR_Z,
    obstacles,
    seats
  });
  return sight.summarizeSightlines(verdicts);
}

const CASES = [
  ["just the two of them and the officiant", cast.defaultCeremonyCast()],
  ["walked down the aisle (an escort)", cast.buildCastFromTemplate("traditional")],
  ["walk in together", cast.buildCastFromTemplate("together")],
  ["2 attendants each side", cast.buildCastFromTemplate("party-at-the-front", { attendantsPerSide: 2 })],
  ["4 attendants each side", cast.buildCastFromTemplate("party-at-the-front", { attendantsPerSide: 4 })],
  ["6 attendants each side", cast.buildCastFromTemplate("party-at-the-front", { attendantsPerSide: 6 })]
];

const results = CASES.map(([label, members]) => [label, members, analyse(members)]);
const baseline = results[0][2];

// The sweep that carries the actual finding: move four attendants each side along
// the nave axis and watch the cost appear. Everything the couple can act on is here.
const COUPLE_Z_LOCAL = church.PROCESSION_END_Z;
function attendantsAt(zLocal, perSide = 4, firstX = 1.05) {
  const members = [];
  for (const side of [1, 2]) {
    for (let index = 0; index < perSide; index += 1) {
      members.push({
        entrance: "in-place",
        id: `sweep-${side}-${index}`,
        look: "dress",
        mark: { x: (side === 1 ? -1 : 1) * (firstX + index * 0.55), z: zLocal },
        name: "",
        order: 0,
        role: "attendant",
        side
      });
    }
  }
  return analyse(members).blocked.length;
}

if (process.argv.includes("--regress")) {
  const problems = [];

  // 1. THE POSITION MUST DECIDE. Upstage costs nothing; downstage costs seats. If
  //    that gradient ever flattens, the marks have stopped reaching the analysis and
  //    the couple's drag has quietly become decoration.
  const upstage = attendantsAt(COUPLE_Z_LOCAL - 0.5);
  const level = attendantsAt(COUPLE_Z_LOCAL);
  const downstage = attendantsAt(COUPLE_Z_LOCAL + 0.5);
  console.log(`Four each side — upstage ${upstage} blocked, level ${level}, downstage ${downstage}`);
  if (!(upstage < level && level < downstage)) {
    problems.push("moving the wedding party toward the guests did not cost more seats — the marks are not reaching the analysis");
  }

  // 2. The blocking must be NAMED. "Someone is in the way" is not actionable;
  //    "Elin is in the way" is, because she can take half a step.
  const blockedDownstage = analyse(
    Array.from({ length: 8 }, (_, index) => ({
      entrance: "in-place",
      id: `named-${index}`,
      look: "dress",
      mark: { x: (index % 2 === 0 ? -1 : 1) * (1.05 + Math.floor(index / 2) * 0.55), z: COUPLE_Z_LOCAL + 0.5 },
      name: index === 0 ? "Elin" : "",
      order: 0,
      role: "attendant",
      side: index % 2 === 0 ? 1 : 2
    }))
  ).blocked;
  const named = blockedDownstage.filter((seat) => seat.blockedBy && seat.blockedBy.trim().length > 0);
  console.log(`  a party standing downstage blocks ${blockedDownstage.length}, all naming who: ${named.length === blockedDownstage.length}`);
  if (blockedDownstage.length === 0 || named.length !== blockedDownstage.length) {
    problems.push("a blocked seat did not name who was blocking it");
  }

  // 3. The two partners must NEVER be obstacles: they are what the guests are
  //    looking at, and putting a body on the target blocks the entire room.
  const withPartners = cast.castSightlineObstacles(cast.defaultCeremonyCast(), INTERIOR_Z);
  console.log(`  obstacles from the default cast: ${withPartners.map((entry) => entry.label).join(", ")}`);
  if (withPartners.some((entry) => entry.label.toLowerCase().includes("partner"))) {
    problems.push("a partner was passed in as an obstacle — every seat would read as blocked");
  }

  // 4. A SEEDED MARK MUST SURVIVE STORAGE. This is here because it did not: the
  //    cast was clamped with clampSceneOffset, which bounds a DELTA at +/-1.8, so an
  //    attendant seeded at z -3.05 came back at -1.8 — from behind the couple's
  //    shoulders to in front of them, silently, on the first save.
  const seeded = cast.buildCastFromTemplate("party-at-the-front", { attendantsPerSide: 2 });
  const roundTripped = seeded.map((entry) => ({ ...entry, mark: cast.clampCastMark(entry.mark) }));
  const moved = seeded.filter((entry, index) => {
    const after = roundTripped[index].mark;
    return Math.abs(after.x - entry.mark.x) > 0.001 || Math.abs(after.z - entry.mark.z) > 0.001;
  });
  console.log(`  marks surviving a storage clamp: ${seeded.length - moved.length}/${seeded.length}`);
  if (moved.length > 0) {
    problems.push(`${moved.length} seeded mark(s) were moved by the storage clamp — an attendant would teleport on reload`);
  }

  // 5. The processional order must survive being described. A pair walking arm in
  //    arm is ONE group, not two, or the toastmaster reads the same person twice.
  const groups = cast.processionalOrder(cast.buildCastFromTemplate("traditional"));
  console.log(`  traditional processional: ${groups.length} group(s), sizes ${groups.map((g) => g.length).join("+")}`);
  if (groups.length !== 1 || groups[0].length !== 2) {
    problems.push("an escorted partner did not come back as a single pair in the processional");
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  the wedding party is measured, named, and never blocks the couple it stands beside");
  process.exit(0);
}

console.log(`What the wedding party costs the room — ${GUESTS} guests, ${ROWS} rows\n`);
console.log("  cast                                    standing  blocked  clear");
for (const [label, members, summary] of results) {
  const standing = cast.castStandingAtVows(members).length;
  console.log(
    `  ${label.padEnd(38)} ${String(standing).padStart(8)} ${String(summary.blocked.length).padStart(8)} ${String(summary.clear).padStart(6)}`
  );
}

console.log("\n  Four attendants each side, swept along the nave — THIS is what decides it:\n");
console.log("    where they stand            blocked");
for (const offset of [-0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8, 1.1]) {
  const where = offset < 0 ? `${(-offset).toFixed(1)} m upstage` : offset > 0 ? `${offset.toFixed(1)} downstage` : "level with the couple";
  console.log(`    ${where.padEnd(26)} ${String(attendantsAt(COUPLE_Z_LOCAL + offset)).padStart(7)}`);
}
console.log("\n  And how far OUT the line starts, at level with the couple:\n");
for (const firstX of [0.55, 0.75, 1.05, 1.5, 2]) {
  console.log(`    first attendant at ${firstX} m out   ${String(attendantsAt(COUPLE_Z_LOCAL, 4, firstX)).padStart(7)}`);
}
console.log(
  "\n  It is not how many attendants you have. It is whether they stand level with\n" +
    "  you or in front of you, and how far out the line starts."
);

if (process.argv.includes("--check")) {
  const problems = [];

  // The empty case must be clean: with nobody but the couple and the officiant,
  // nothing at the front may block, or the marks have drifted.
  if (baseline.blocked.length > 0) {
    problems.push(`${baseline.blocked.length} seat(s) blocked with no wedding party at all — the default marks have moved`);
  }
  // Every template must produce a usable ceremony rather than an empty list.
  for (const [label, members] of CASES) {
    if (cast.castStandingAtVows(members).filter((entry) => entry.role === "partner").length !== 2) {
      problems.push(`${label}: does not end with two partners standing`);
    }
  }
  // Marks must be distinct: two people on the same spot is one person in the render
  // and a wrong count in the analysis.
  for (const [label, members] of CASES) {
    const standing = cast.castStandingAtVows(members);
    const spots = new Set(standing.map((entry) => `${entry.mark.x.toFixed(2)},${entry.mark.z.toFixed(2)}`));
    if (spots.size !== standing.length) {
      problems.push(`${label}: ${standing.length - spots.size} member(s) share a mark with someone else`);
    }
  }

  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  every cast stands two partners on distinct marks, and an empty chancel blocks nobody");
}
