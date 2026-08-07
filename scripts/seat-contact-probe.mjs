// Where does a seated figure's body actually rest, and does its furniture meet it?
//
// The 2026-08-06 scene audit's single largest group of findings was that seated
// figures meet their furniture nowhere: pews, dinner chairs and the /reception
// editor all place the seat surface above the height at which the model's body
// rests, so the crowd is sunk into the benches and the seat plates cut through
// laps. That is not something a screenshot settles — it is arithmetic on the mesh.
//
// The congregation figures are drawn as InstancedMesh, so they cannot be skinned:
// each cg_*.glb is a STATIC seated mesh, and its vertices can be read straight out
// of the binary chunk with plain Node. No browser, no WebGL, no visible tab.
//
// HOW THE CONTACT PLANE IS FOUND, without guessing where the body ends:
// a seated figure touches the world in two places — the feet, low and forward, and
// the buttocks, higher and back. So the model is split on its own z extent and each
// end is measured separately. The front band's lowest vertex is the sole, and it
// doubles as the check that the split is right, because a seated model's soles must
// land near y 0.
//
// THE REAR BAND IS NOT A MIN(). This is the correction that matters, and both the
// 2026-08-06 audit and this script's own first version got it wrong in the same way.
// A `min()` over the rear band returns whatever narrow thing hangs lowest — a hand
// beside a hip, a heel tucked back, a hem — and on cg_man_0 that is 0.1941, a feature
// 11 vertices wide spanning 3.8 cm. His actual seat is 8 cm higher at 0.274, where the
// mesh first becomes as wide as a pair of hips. Reported as "the pew is 13-16 cm too
// high", the min() reading was wrong by roughly its own magnitude: the pew cushion
// tops out at 0.2775 and meets that man within 3.5 mm.
//
// So a contact plane is the LOWEST HEIGHT AT WHICH THE BODY IS HIP-WIDE. Anything
// narrower is a limb, not a surface you could sit on.
//
//   node scripts/seat-contact-probe.mjs           every model, both scales
//   node scripts/seat-contact-probe.mjs --check   fail if furniture misses the body

import { readFileSync, readdirSync } from "node:fs";
import { Matrix4, Vector3, Quaternion } from "three";

const MODELS_DIR = "public/models";
const SCENE_UNIT_METRES = 1.591;

function readGlb(path) {
  const buf = readFileSync(path);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === 0x4e4f534a) {
      json = JSON.parse(buf.subarray(start, start + length).toString("utf8"));
    } else if (type === 0x004e4942) {
      bin = buf.subarray(start, start + length);
    }
    offset = start + length + ((4 - (length % 4)) % 4);
  }
  return { bin, json };
}

// Vertex positions are float32 VEC3, but a bufferView may be INTERLEAVED, so the
// stride has to be honoured rather than assumed to be 12 bytes. Reading it as tight
// would silently return a different vertex every time on any interleaved asset.
function positions(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? 12;
  const out = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const at = base + index * stride;
    out.push([bin.readFloatLE(at), bin.readFloatLE(at + 4), bin.readFloatLE(at + 8)]);
  }
  return out;
}

function worldMatrices(json) {
  const parent = new Map();
  json.nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      parent.set(child, index);
    }
  });

  return json.nodes.map((_, index) => {
    const chain = [];
    let cursor = index;
    while (cursor !== undefined) {
      chain.unshift(cursor);
      cursor = parent.get(cursor);
    }
    const matrix = new Matrix4();
    for (const link of chain) {
      const node = json.nodes[link];
      if (node.matrix) {
        matrix.multiply(new Matrix4().fromArray(node.matrix));
        continue;
      }
      matrix.multiply(
        new Matrix4().compose(
          new Vector3().fromArray(node.translation ?? [0, 0, 0]),
          new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
          new Vector3().fromArray(node.scale ?? [1, 1, 1])
        )
      );
    }
    return matrix;
  });
}

function vertices(path, scale) {
  return measure(path, scale, true);
}

function measure(path, scale, wantPoints = false) {
  const { bin, json } = readGlb(path);
  const matrices = worldMatrices(json);
  const points = [];
  json.nodes.forEach((node, index) => {
    if (node.mesh === undefined) {
      return;
    }
    for (const primitive of json.meshes[node.mesh].primitives) {
      if (primitive.attributes.POSITION === undefined) {
        continue;
      }
      for (const raw of positions(json, bin, primitive.attributes.POSITION)) {
        const point = new Vector3(...raw).applyMatrix4(matrices[index]).multiplyScalar(scale);
        points.push(point);
      }
    }
  });

  if (!points.length) {
    return wantPoints ? [] : null;
  }

  if (wantPoints) {
    return points;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  // Split on the model's own z extent. The seated figures face +z (buildReceptionSeats
  // yaws local +z at the table), so the rear third holds the seat and the front third
  // holds the feet.
  const span = maxZ - minZ;
  const rearEdge = minZ + span * 0.34;
  const frontEdge = maxZ - span * 0.34;
  const rear = points.filter((point) => point.z <= rearEdge);
  let soleContact = Infinity;
  for (const point of points) {
    if (point.z >= frontEdge) {
      soleContact = Math.min(soleContact, point.y);
    }
  }

  // Hip width at this scale. The measured broad surfaces run 0.15-0.25 units across
  // and the narrow limbs 0.00-0.14, so the threshold sits in a real gap rather than on
  // a guess. It scales with the model so both draw scales use the same rule.
  const hipWidth = 0.72 * scale;
  const slabHeight = 0.005;
  const rearFloor = Math.min(...rear.map((point) => point.y));
  let seatContact = null;
  for (let y = rearFloor; y <= maxY && seatContact === null; y += slabHeight) {
    const slice = rear.filter((point) => point.y >= y && point.y < y + slabHeight);
    if (slice.length < 6) {
      continue;
    }
    const xs = slice.map((point) => point.x);
    if (Math.max(...xs) - Math.min(...xs) >= hipWidth) {
      seatContact = y;
    }
  }

  return {
    height: maxY - minY,
    lowestRear: rearFloor,
    maxY,
    minY,
    points: points.length,
    seatContact: seatContact ?? rearFloor,
    soleContact,
    zSpan: span
  };
}

const models = readdirSync(MODELS_DIR)
  .filter((name) => name.startsWith("cg_") && name.endsWith(".glb"))
  .sort();

// The two scales the same meshes are drawn at, read from the components that draw them.
const SCALES = [
  ["church CONGREGATION_SCALE", 0.205, "components/wedding-studio/church-scene.tsx"],
  ["/reception GUEST_SCALE", 0.2, "components/reception/reception-seating-3d.tsx"]
];

const metres = (value) => (value * SCENE_UNIT_METRES).toFixed(3);

if (!process.argv.includes("--check")) {
  for (const [label, scale] of SCALES) {
    console.log(`\n${label} = ${scale}`);
    console.log("model            seat contact     lowest rear    soles    total height");
    for (const name of models) {
      const m = measure(`${MODELS_DIR}/${name}`, scale);
      if (!m) {
        console.log(`  ${name.padEnd(15)} no vertices`);
        continue;
      }
      console.log(
        `  ${name.replace(".glb", "").padEnd(14)} ${m.seatContact.toFixed(4)} (${metres(m.seatContact)} m)` +
          `   ${m.lowestRear.toFixed(4)}       ${m.soleContact.toFixed(4)}   ${m.height.toFixed(4)} (${metres(m.height)} m)`
      );
    }
  }
  console.log("\nThe soles column is the self-check: a seated model's feet must land near 0.");
  console.log("If it drifts far from zero the front/rear split is wrong and nothing above holds.");
}

// Furniture volumes, read off the components that draw them. Local to the figure's own
// origin, which the figure and its seat share: buildReceptionSeats emits [x, 0, z] for
// both and yaws them together, and the interior's +0.25 z group wraps both and cancels.
const FURNITURE = {
  // PewBody, church-scene.tsx: group at y 0.18, bench box [width, 0.16, 0.34] centred
  // on it, cushion [2.4, 0.025, 0.3] at local y 0.085, backrest [w, 0.3, 0.07] at z 0.14.
  "pew bench": { x: [-1.2, 1.2], y: [0.1, 0.26], z: [-0.17, 0.17] },
  "pew cushion": { x: [-1.2, 1.2], y: [0.2525, 0.2775], z: [-0.15, 0.15] },
  "pew backrest": { x: [-1.2, 1.2], y: [0.23, 0.53], z: [0.105, 0.175] },
  // DinnerChair, dinner-props.tsx: CHAIR_SEAT_Y 0.295, CHAIR_WIDTH 0.295, slab 0.026.
  "chair seat": { x: [-0.1475, 0.1475], y: [0.282, 0.308], z: [-0.1475, 0.1475] },
  "chair back": { x: [-0.1375, 0.1375], y: [0.3, 0.59], z: [-0.1435, -0.1235] }
};

function inside(points, box, yOffset = 0) {
  return points.filter((point) => {
    const y = point.y + yOffset;
    return (
      point.x >= box.x[0] && point.x <= box.x[1] && y >= box.y[0] && y <= box.y[1] && point.z >= box.z[0] && point.z <= box.z[1]
    );
  });
}

// The measured state on 2026-08-06, per furniture volume, as the WORST count across the
// three body variants at either draw scale. This is a ratchet, not a target: the defect
// cannot be asserted away because fixing it needs a redesign nobody can verify from here,
// but it can be stopped from getting worse. Lower any number here when a change earns it.
const INTERSECTION_BASELINE = {
  "chair back": 126,
  "chair seat": 269,
  "pew backrest": 22,
  "pew bench": 889,
  "pew cushion": 353
};

if (process.argv.includes("--intersect") || process.argv.includes("--check")) {
  // THE DEFINITION-FREE TEST, and the only one here worth asserting on. "Where does the
  // body rest" turned out to depend entirely on how you ask: a min() over the rear band
  // says 0.194 for cg_man_0, the lowest hip-wide slice says 0.274, and these meshes are
  // too coarse (occupancy 1-2 of 6 columns almost everywhere) for either to be trusted.
  // "Is body mesh inside furniture mesh" needs no definition at all.
  console.log("\nvertices of the body INSIDE each furniture volume");
  for (const [label, scale] of SCALES) {
    console.log(`\n  ${label} = ${scale}`);
    for (const name of models.filter((n) => n.endsWith("_0.glb"))) {
      const points = vertices(`${MODELS_DIR}/${name}`, scale);
      const parts = Object.entries(FURNITURE).map(([boxName, box]) => `${boxName} ${String(inside(points, box).length).padStart(4)}`);
      console.log(`    ${name.replace(".glb", "").padEnd(12)} of ${String(points.length).padStart(5)}:  ${parts.join("   ")}`);
    }
  }

  // WHY NO HEIGHT FIX WORKS, kept in the tool so the next reader does not re-derive it
  // and does not act on the audit's "lower the seat by 12-16 cm".
  const man = vertices(`${MODELS_DIR}/cg_man_0.glb`, 0.205);
  const bench = FURNITURE["pew bench"];
  const here = inside(man, bench);
  const ahead = here.filter((point) => point.z > 0.05).length;
  console.log(`\n  cg_man_0 inside the pew bench: ${here.length} verts — ${ahead} of them AHEAD of his own origin.`);
  console.log("  Those are shins and calves, and they belong in front of the bench's front face.");
  console.log("  Sweeping the figure up through the bench never clears it:");
  let best = { count: Infinity, offset: 0 };
  for (let offset = 0; offset <= 0.24; offset += 0.02) {
    const count = inside(man, bench, offset).length;
    if (count < best.count) {
      best = { count, offset };
    }
    console.log(`    +${offset.toFixed(2)} (feet ${(offset * SCENE_UNIT_METRES * 100).toFixed(0)} cm off the floor): ${String(count).padStart(4)} inside`);
  }
  console.log(`  best is ${best.count} at +${best.offset.toFixed(2)}, and it rises again after that.`);
  console.log("  So this is a DEPTH problem, not a height one: the bench is a solid 0.34-deep,");
  console.log("  0.16-thick box centred on the figure's own origin, so it occupies the volume a");
  console.log("  seated person's thighs and calves are in whatever height it sits at. Fixing it");
  console.log("  means redesigning the bench section and where the figure sits in z — a change to");
  console.log("  the look, which must not ship unseen. The constants are deliberately untouched.");

  if (process.argv.includes("--check")) {
    const failures = [];

    // A narrow guard, and narrow on purpose. Both rooms' floor planes sat at y -0.04
    // while every object in them is built from y 0, so the whole wedding floated 6.4 cm
    // and the dance floor's own top finish ended up under its platform. This asserts the
    // exact string rather than trying to parse five JSX planes, which is less clever and
    // more likely to still be true in a year.
    const church = readFileSync("components/wedding-studio/church-scene.tsx", "utf8");
    const sunkFloors = church.split("position={[0, -0.04, 0.25]}").length - 1;
    if (sunkFloors > 0) {
      failures.push(`${sunkFloors} floor plane(s) back at y -0.04 while objects stand on y 0`);
    } else {
      console.log("  PASS  both rooms' floor planes sit on the y 0 datum their objects stand on");
    }
    const worst = {};
    for (const [, scale] of SCALES) {
      for (const name of models.filter((entry) => entry.endsWith("_0.glb"))) {
        const points = vertices(`${MODELS_DIR}/${name}`, scale);
        for (const [boxName, box] of Object.entries(FURNITURE)) {
          worst[boxName] = Math.max(worst[boxName] ?? 0, inside(points, box).length);
        }
      }
    }

    console.log("");
    for (const [boxName, baseline] of Object.entries(INTERSECTION_BASELINE)) {
      const count = worst[boxName] ?? 0;
      if (count > baseline) {
        failures.push(`${boxName}: ${count} verts inside, worse than the recorded ${baseline}`);
        continue;
      }
      const note = count < baseline ? ` — improved from ${baseline}, lower the baseline` : "";
      console.log(`  PASS  ${boxName}: ${count} verts inside, not worse than ${baseline}${note}`);
    }
    for (const line of failures) {
      console.log(`  FAIL  ${line}`);
    }
    if (failures.length) {
      process.exitCode = 1;
    }
  }
}
