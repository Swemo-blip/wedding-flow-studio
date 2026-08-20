// Does the shared link carry the couple's real room, losslessly, and how much URL
// does it cost?
//
//   node scripts/share-room-probe.mjs           # report
//   node scripts/share-room-probe.mjs --check   # exit non-zero if the wire format lies
//
// This guards a WIRE FORMAT THAT PUBLISHES TO THIRD PARTIES. A venue, a
// photographer and a planner open this link and act on what it shows. A packing bug
// that silently dropped a dragged mark would not look like a bug — it would look
// like a floor plan, and someone would stand in the wrong place on the day.
//
// It imports the shipped module rather than re-deriving the format, for the same
// reason sightline-probe.mjs does: this project has twice shipped a probe whose own
// copy of the logic had already drifted from the code it was checking.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "share-room-"));
for (const name of ["share-snapshot.ts", "wedding-studio-plan.ts", "wedding-types.ts", "asset-path.ts", "venue-trace.ts", "scene-units.ts"]) {
  writeFileSync(join(dir, name), readFileSync(`lib/${name}`, "utf8").replace(/from "@\/lib\/([a-z-]+)"/g, 'from "./$1.ts"'));
}
const share = await import(pathToFileURL(join(dir, "share-snapshot.ts")).href);
const planLib = await import(pathToFileURL(join(dir, "wedding-studio-plan.ts")).href);

const defaults = { sceneEdits: planLib.defaultStudioSceneEdits, staging: planLib.defaultCeremonyStaging };
const hashLength = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url").length;

const resting = {
  plan: { ...planLib.defaultWeddingStudioPlan, guestCount: 27 },
  sceneEdits: planLib.defaultStudioSceneEdits,
  staging: planLib.defaultCeremonyStaging
};

const cases = [
  ["nothing moved", resting],
  [
    "one object nudged",
    { ...resting, sceneEdits: { ...planLib.defaultStudioSceneEdits, focalPoint: { x: 0.5, z: -0.3 } } }
  ],
  [
    "officiant, singer, groom start",
    {
      ...resting,
      staging: {
        groomStart: "altar",
        marks: { ...planLib.defaultCeremonyStaging.marks, celebrant: { x: -1.5, z: 1.5 }, singer: { x: 0.4, z: 0 } },
        showSinger: true
      }
    }
  ],
  [
    "every offset moved",
    {
      plan: { ...planLib.defaultWeddingStudioPlan, aisleWidthFeet: 9, seatingLayout: "Spaced rows" },
      sceneEdits: Object.fromEntries(
        Object.keys(planLib.defaultStudioSceneEdits).map((key, index) => [key, { x: 0.1 * (index + 1), z: -0.2 }])
      ),
      staging: {
        groomStart: "altar",
        marks: Object.fromEntries(
          Object.keys(planLib.defaultCeremonyStaging.marks).map((key, index) => [key, { x: 0.3, z: 0.1 * (index + 1) }])
        ),
        showSinger: true
      }
    }
  ]
];

const problems = [];
console.log("The room, as it travels in the URL hash:\n");
for (const [label, room] of cases) {
  const packed = share.packRoom(room);
  const restored = share.unpackRoom(packed, defaults);
  const lossless = JSON.stringify(restored) === JSON.stringify(room);
  console.log(
    `  ${label.padEnd(32)} ${String(hashLength(packed)).padStart(4)} hash chars   ` +
      `${lossless ? "lossless" : "*** LOSSY ***"}`
  );
  if (!lossless) {
    problems.push(`packing "${label}" loses data`);
    console.log(`      sent: ${JSON.stringify(room)}`);
    console.log(`      got : ${JSON.stringify(restored)}`);
  }
}

// A whole snapshot, so the number is the one a person actually pastes.
const snapshot = share.buildShareSnapshot({
  guests: Array.from({ length: 27 }, (_, index) => ({ id: `g${index}`, rsvpStatus: index < 24 ? "attending" : "pending" })),
  room: resting,
  timelineItems: Array.from({ length: 14 }, (_, index) => ({
    time: `1${index % 10}:30`,
    title: "A moment in the day",
    location: "The nave",
    phase: "ceremony",
    visibility: "everyone"
  })),
  wedding: {
    coupleNames: "Emma & James",
    date: "2027-06-12",
    ceremonyLocation: "St Mary the Virgin",
    receptionLocation: "The Long Barn",
    guestCount: 27,
    style: "classic"
  }
});
const full = hashLength(snapshot);
console.log(`\n  a whole shared link (14 moments + the room): ${full} hash chars`);

// A TRACED VENUE MUST TRAVEL, AND ITS IMAGE MUST NOT.
//
// The geometry is what a vendor needs and it is tiny; the plan photograph is
// hundreds of kilobytes and belongs to the device that traced it. Asserting both
// halves here, because "the trace travels" and "the image does not" are two
// different ways for this feature to be wrong.
const TRACED = {
  v: 1,
  calibration: { a: { x: 40, y: 900 }, b: { x: 540, y: 900 }, metres: 50 },
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
    { radius: 8, x: 150, y: 220 },
    { radius: 8, x: 230, y: 220 }
  ]
};
const tracedSnapshot = share.buildShareSnapshot({
  guests: [],
  room: resting,
  timelineItems: [],
  trace: TRACED,
  wedding: snapshot.wedding
});
const tracedRound = share.decodeSnapshot(share.encodeSnapshot(tracedSnapshot));
const traceLossless = JSON.stringify(tracedRound?.trace) === JSON.stringify(TRACED);
console.log(
  `  a traced venue (6 corners, 2 pillars): ` +
    `${hashLength(tracedSnapshot) - hashLength({ ...tracedSnapshot, trace: undefined })} extra hash chars, ` +
    `${traceLossless ? "lossless" : "*** LOSSY ***"}`
);
if (!traceLossless) {
  problems.push("the traced venue did not survive the round trip");
}
// The image must be impossible to smuggle in: buildShareSnapshot takes no image
// argument at all, so the assertion is that no field of the encoded snapshot ever
// holds a data URL, however the trace was assembled.
const encoded = JSON.stringify(tracedSnapshot);
if (encoded.includes("data:image")) {
  problems.push("a plan image reached the share link — it must stay on the device that traced it");
}
const resolved = (await import(pathToFileURL(join(dir, "venue-trace.ts")).href)).resolveVenueTrace(tracedRound?.trace);
console.log(
  `  and it still resolves after the round trip: ` +
    (resolved ? `${resolved.widthMetres} x ${resolved.depthMetres} m, ${resolved.pillars.length} pillars` : "*** NO ***")
);
if (!resolved || resolved.pillars.length !== TRACED.pillars.length) {
  problems.push("the decoded trace no longer resolves to the room that was sent");
}

// THE ROOM MUST NOT TRAVEL WITH ANYONE'S NAME ATTACHED, and this is asserted as a
// strict ALLOW-LIST of keys rather than a search for suspicious words. The same
// reasoning lib/share-snapshot.ts already applies to timeline visibility: a
// deny-list only catches the leaks somebody thought of, while an allow-list fails
// closed the moment a field is added without a decision being made about it.
//
// The first version of this check searched substrings and immediately produced a
// false alarm on `accessibilitySeats` — which is a count of reserved step-free
// seats, a property of the ROOM that a venue genuinely needs, not a note about a
// person. That is exactly the sort of judgement a word search cannot make and a
// named list can.
const ALLOWED_ROOM_KEYS = {
  plan: [
    "accessibilitySeats",
    "aisleWidthFeet",
    "budgetLevel",
    "colorDirection",
    "decorLevel",
    "guestCount",
    "seatingLayout",
    "style",
    "venueType"
  ],
  sceneEdits: null, // object ids, each { x, z } — no names possible
  staging: ["groomStart", "marks", "showSinger"]
};

for (const [slice, allowed] of Object.entries(ALLOWED_ROOM_KEYS)) {
  const value = snapshot.room?.[slice];
  if (!value || !allowed) {
    continue;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      problems.push(`the packed room's ${slice} carries an unreviewed field "${key}" — decide whether a vendor may see it`);
    }
  }
}

// A link nobody can paste is a link nobody sends. 6000 is conservative: browsers
// take far more, but messaging apps and email clients start wrapping and breaking
// hashes well before their own limits.
if (full > 6000) {
  problems.push(`a shared link is ${full} characters — too long to survive being pasted`);
}

if (process.argv.includes("--check")) {
  if (problems.length) {
    for (const problem of problems) {
      console.log(`\n  FAIL  ${problem}`);
    }
    process.exit(1);
  }
  console.log("\n  PASS  the room travels intact, carries no guest detail, and fits in a link");
}
