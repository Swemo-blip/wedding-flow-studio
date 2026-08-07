// Measure a figure's posed arms WITHOUT a browser.
//
// Why this exists: the pose offsets in church-scene.tsx were tuned against palm
// positions read out of a live scene, and a live scene is exactly what an agent
// here cannot get (R3F never mounts in a tab that has never been visible — see
// components/wedding-studio/render-bridge.tsx). So the arms of the officiant went
// unmeasurable at the moment the owner said the officiant "looks very strange".
//
// A GLB is a JSON chunk plus a binary chunk. The node hierarchy, the rest
// transforms, the skin joints and the animation samplers all live in the JSON,
// with the sampler VALUES in the binary. That is everything needed to rebuild the
// skeleton and evaluate a pose with plain forward kinematics — no WebGL, no DOM.
//
// It reports, per pose, where the palms end up and how far apart they are, plus
// the shoulder/elbow angles in degrees so an outlier pose is visible as a number.

import { readFileSync } from "node:fs";
import { Quaternion, Vector3, Matrix4, Euler } from "three";

const GLB = process.argv[2] ?? "public/models/figure_suit.glb";

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`${path} is not a GLB`);
  }
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

const { bin, json } = readGlb(GLB);

// GLTFLoader pushes every node name through PropertyBinding.sanitizeNodeName,
// which strips dots — so the scene sees `UpperArmL` where the file says
// `UpperArm.L`. The lookup has to accept both spellings, same as findBone does.
const sanitize = (name) => (name ?? "").replace(/\./g, "");
const nodes = json.nodes ?? [];
const byName = new Map();
nodes.forEach((node, index) => {
  byName.set(node.name ?? `node${index}`, index);
  byName.set(sanitize(node.name), index);
});

const parentOf = new Map();
nodes.forEach((node, index) => {
  for (const child of node.children ?? []) {
    parentOf.set(child, index);
  }
});

// --- the animated base rotation -------------------------------------------
// The live figure is NOT in its rest pose: a mixer is playing an idle clip, and
// the scene post-multiplies the pose offset onto whatever the mixer just wrote.
// Composing against rest instead of against the clip is the one mistake that
// would make every number here confidently wrong, so the clip is read for real.
function accessor(index) {
  const desc = json.accessors[index];
  const view = json.bufferViews[desc.bufferView];
  const componentSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[desc.componentType];
  const componentCount = { MAT4: 16, SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[desc.type];
  const start = (view.byteOffset ?? 0) + (desc.byteOffset ?? 0);
  const out = [];
  for (let element = 0; element < desc.count; element += 1) {
    const row = [];
    for (let component = 0; component < componentCount; component += 1) {
      const at = start + (element * componentCount + component) * componentSize;
      if (desc.componentType === 5126) {
        row.push(bin.readFloatLE(at));
      } else if (desc.componentType === 5123) {
        row.push(bin.readUInt16LE(at));
      } else {
        row.push(bin.readUInt8(at));
      }
    }
    out.push(componentCount === 1 ? row[0] : row);
  }
  return out;
}

const clipNames = (json.animations ?? []).map((animation) => animation.name);
const wantedClip = (json.animations ?? []).findIndex((animation) => /idle/i.test(animation.name ?? ""));
const clipIndex = wantedClip >= 0 ? wantedClip : 0;

// Sample at a time the clip actually occupies rather than t=0: an idle's first
// frame is often the authored rest, which would hide exactly the discrepancy
// this is here to catch.
const clipBase = new Map();
let sampledAt = null;
if (json.animations?.[clipIndex]) {
  const animation = json.animations[clipIndex];
  for (const channel of animation.channels) {
    if (channel.target.path !== "rotation" || channel.target.node === undefined) {
      continue;
    }
    const sampler = animation.samplers[channel.sampler];
    const times = accessor(sampler.input);
    const values = accessor(sampler.output);
    const frame = Math.floor(times.length / 3);
    sampledAt = times[frame];
    clipBase.set(channel.target.node, values[frame]);
  }
}

function localMatrix(index, offsets) {
  const node = nodes[index];
  const position = new Vector3().fromArray(node.translation ?? [0, 0, 0]);
  const animated = clipBase.get(index);
  const quaternion = new Quaternion().fromArray(animated ?? node.rotation ?? [0, 0, 0, 1]);
  const scale = new Vector3().fromArray(node.scale ?? [1, 1, 1]);
  const offset = offsets?.get(index);
  if (offset) {
    // The scene post-multiplies the offset onto the bone's current quaternion
    // once per frame after the mixer writes it, so rest x offset is the same
    // composition the live figure uses on an idle frame.
    quaternion.multiply(new Quaternion().setFromEuler(new Euler(offset[0], offset[1], offset[2])));
  }
  return new Matrix4().compose(position, quaternion, scale);
}

function worldMatrix(index, offsets) {
  const chain = [];
  let cursor = index;
  while (cursor !== undefined) {
    chain.unshift(cursor);
    cursor = parentOf.get(cursor);
  }
  const out = new Matrix4();
  for (const link of chain) {
    out.multiply(localMatrix(link, offsets));
  }
  return out;
}

function poseOffsets(pose) {
  const offsets = new Map();
  const missing = [];
  for (const [bone, euler] of Object.entries(pose)) {
    const index = byName.get(bone) ?? byName.get(sanitize(bone));
    if (index === undefined) {
      missing.push(bone);
      continue;
    }
    offsets.set(index, euler);
  }
  return { missing, offsets };
}

function worldPosition(boneName, offsets) {
  const index = byName.get(boneName) ?? byName.get(sanitize(boneName));
  if (index === undefined) {
    return null;
  }
  return new Vector3().setFromMatrixPosition(worldMatrix(index, offsets));
}

// Scale to human metres so a number can be judged against a real body.
//
// Do NOT derive this from a head-bone-to-foot measurement, which is the obvious
// move and is wrong twice over: `Head` sits at the top of the neck rather than the
// crown, and this rig's `Foot.L` hangs off an IK helper rather than the leg chain.
// That pair measures 4.173 rig units and inflates every distance by 12%.
//
// Derive it from the two facts the project has already measured instead:
// FIGURE_SCALE is the rig-to-scene factor, and a standing figure measures 1.10
// scene units for a 1.75 m person (CLAUDE.md), so one scene unit is 1.591 m.
// Cross-check: 1.10 / 0.235 = 4.68 rig units of crown-to-floor, which is the
// head-bone 4.173 plus a skull, so the two agree.
const FIGURE_SCALE = 0.235;
const SCENE_UNIT_METRES = 1.591;
const RIG_UNIT_METRES = FIGURE_SCALE * SCENE_UNIT_METRES;
// The rig origin is the floor, so a bare world y IS the height above it.

// The poses are PARSED OUT OF THE SOURCE, never copied into this file. A probe
// carrying its own duplicate of the thing it measures reports on a stale copy the
// moment the source changes, and does so while looking authoritative — which is
// the failure mode this project has hit repeatedly (see MEMORY: verify-the-verifier).
function readPosesFromSource() {
  const source = readFileSync("components/wedding-studio/church-scene.tsx", "utf8");
  const poses = {};
  const declaration = /const POSE_([A-Z_]+): FigurePose = \{([\s\S]*?)\n\};/g;
  let match = declaration.exec(source);
  while (match) {
    const [, rawName, body] = match;
    const pose = {};
    const entry = /"([\w.]+)":\s*\[\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]/g;
    let bone = entry.exec(body);
    while (bone) {
      pose[bone[1]] = [Number(bone[2]), Number(bone[3]), Number(bone[4])];
      bone = entry.exec(body);
    }
    poses[rawName.toLowerCase()] = pose;
    match = declaration.exec(source);
  }
  return poses;
}

const POSES = { ...readPosesFromSource(), rest: {} };

const metres = (value) => value * RIG_UNIT_METRES;

console.log(`file        ${GLB}`);
console.log(`clips       ${clipNames.join(", ") || "none"}`);
console.log(`base pose   ${clipBase.size ? `clip "${clipNames[clipIndex]}" @ t=${sampledAt?.toFixed(2)}s, ${clipBase.size} animated bones` : "REST (no clip found)"}`);
console.log(`scale       1 rig unit = ${RIG_UNIT_METRES.toFixed(4)} m  (FIGURE_SCALE ${FIGURE_SCALE} x ${SCENE_UNIT_METRES} m/unit)`);
console.log("");
console.log("              palm gap   fwd of torso   palm height   off-centre   elbow  L/R asym");

for (const [name, pose] of Object.entries(POSES)) {
  const { missing, offsets } = poseOffsets(pose);
  const left = worldPosition("Palm.L", offsets);
  const right = worldPosition("Palm.R", offsets);
  const torso = worldPosition("Torso", offsets);
  if (!left || !right || !torso) {
    console.log(`${name.padEnd(13)} palm or torso bones not found`);
    continue;
  }
  const gap = metres(left.distanceTo(right));
  const forward = metres(Math.abs((left.z + right.z) / 2 - torso.z));
  const height = metres((left.y + right.y) / 2);
  // Lateral offset of the clasped pair from the body's own centre line. A pose can
  // close the hands to a correct gap and still put that gap off to one side, which
  // is its own kind of wrong and is invisible to a distance-only check.
  const lateral = metres((left.x + right.x) / 2 - torso.x);
  const elbow = ((pose["LowerArm.L"]?.[0] ?? 0) * 180) / Math.PI;
  const abduction = ((pose["UpperArm.L"]?.[1] ?? 0) * 180) / Math.PI;
  const asymmetry =
    Math.abs(Math.abs(pose["UpperArm.L"]?.[0] ?? 0) - Math.abs(pose["UpperArm.R"]?.[0] ?? 0)) * (180 / Math.PI);
  console.log(
    `${name.padEnd(13)} ${gap.toFixed(3)}      ${forward.toFixed(3)}       ${height.toFixed(3)}   ` +
      `${lateral >= 0 ? "+" : ""}${lateral.toFixed(3)}   ${elbow.toFixed(0).padStart(3)}°  ${asymmetry.toFixed(1).padStart(4)}°` +
      (missing.length ? `   MISSING ${missing.join(",")}` : "")
  );
}

console.log("");
console.log("");
console.log("Human reference: hands held together at the front sit 0.10-0.20 m apart,");
console.log("0.20-0.30 m ahead of the torso, at 1.00-1.20 m height, on the centre line");
console.log("(|off-centre| under ~0.04 m), with the two arms mirrored (asym under ~1°).");
console.log(`bin chunk   ${bin ? bin.length + " bytes" : "absent"}`);


// --- solver ----------------------------------------------------------------
// `node scripts/figure-pose-probe.mjs <glb> --solve <pose> <target gap in m>`
// searches the symmetric UpperArm y offset for the value that lands the palms at
// the requested gap, because that is the axis measurement showed actually closes
// them. Reported as the number to paste, never applied automatically.
const solveIndex = process.argv.indexOf("--solve");
if (solveIndex > 0) {
  const poseName = process.argv[solveIndex + 1];
  const targetGap = Number(process.argv[solveIndex + 2]);
  const base = POSES[poseName];
  if (!base) {
    console.log(`\nno pose named "${poseName}" — have: ${Object.keys(POSES).join(", ")}`);
  } else {
    const gapFor = (y) => {
      const trial = structuredClone(base);
      trial["UpperArm.L"] = [trial["UpperArm.L"][0], y, trial["UpperArm.L"][2]];
      trial["UpperArm.R"] = [trial["UpperArm.R"][0], -y, trial["UpperArm.R"][2]];
      const { offsets } = poseOffsets(trial);
      const l = worldPosition("Palm.L", offsets);
      const r = worldPosition("Palm.R", offsets);
      return metres(l.distanceTo(r));
    };
    let low = 0;
    let high = 1.4;
    for (let step = 0; step < 60; step += 1) {
      const mid = (low + high) / 2;
      if (gapFor(mid) > targetGap) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const y = (low + high) / 2;
    console.log(`\nsolve ${poseName}: target ${targetGap.toFixed(3)} m`);
    console.log(`  UpperArm.L y = ${y.toFixed(3)}   UpperArm.R y = ${(-y).toFixed(3)}`);
    console.log(`  resulting gap ${gapFor(y).toFixed(3)} m   (was ${gapFor(base["UpperArm.L"][1]).toFixed(3)} m)`);
  }
}


// --- fit mode --------------------------------------------------------------
// `--fit <pose>` prints body landmarks in SCENE units, which is the space the
// scene's own constants (ALB_HEM_Y, NECK_Y, stole offsets, prop positions) are
// written in. Comparing a garment against a body requires both in one space, and
// converting by hand is how a stole ends up buried inside a robe.
const fitIndex = process.argv.indexOf("--fit");
if (fitIndex > 0) {
  const pose = POSES[process.argv[fitIndex + 1]] ?? {};
  const { offsets } = poseOffsets(pose);
  const scene = (value) => value * FIGURE_SCALE;
  const landmark = (bone) => {
    const at = worldPosition(bone, offsets);
    return at ? { x: scene(at.x), y: scene(at.y), z: scene(at.z) } : null;
  };
  const show = (label, bone) => {
    const at = landmark(bone);
    if (!at) {
      console.log(`  ${label.padEnd(16)} bone "${bone}" not found`);
      return;
    }
    console.log(
      `  ${label.padEnd(16)} x ${at.x >= 0 ? "+" : ""}${at.x.toFixed(3)}   y ${at.y.toFixed(3)}   z ${at.z >= 0 ? "+" : ""}${at.z.toFixed(3)}`
    );
  };
  console.log(`\nbody landmarks in SCENE units, pose "${process.argv[fitIndex + 1]}"`);
  for (const bone of ["Hips", "Abdomen", "Torso", "Neck", "Head", "Shoulder.L", "Shoulder.R", "UpperArm.L", "Palm.L", "Palm.R"]) {
    show(bone, bone);
  }
  const left = landmark("Shoulder.L");
  const right = landmark("Shoulder.R");
  if (left && right) {
    console.log(`\n  shoulder half-width  ${(Math.abs(left.x - right.x) / 2).toFixed(3)} scene units`);
  }
  const torso = landmark("Torso");
  if (torso) {
    console.log(`  torso centre z       ${torso.z.toFixed(3)} scene units`);
  }
}


// --- check mode ------------------------------------------------------------
// `--check` turns this from a readout into something that can FAIL. Every defect it
// asserts on is one that actually shipped: a stole buried inside the robe, a book
// floating in front of the hands, palms three quarters of a metre apart, one
// shoulder rotated further than the other. A probe that can only print is a probe
// whose findings expire the moment someone edits a number.
const checkMode = process.argv.includes("--check");
if (checkMode) {
  const source = readFileSync("components/wedding-studio/church-scene.tsx", "utf8");
  const failures = [];
  const pass = [];
  const assert = (ok, label, detail) => (ok ? pass : failures).push(`${label} — ${detail}`);

  // Every pose, on the rig that actually uses it. The pairing is read from the
  // source rather than assumed, because a pose moved to the other rig changes every
  // number here (hands_clasped measures 0.105 m on the man and 0.043 m on the woman).
  const usage = [...source.matchAll(/pose=\{(?:\w+\s*\?\s*POSE_\w+\s*:\s*)?POSE_([A-Z_]+)\}[\s\S]{0,240}?url=\{FIGURE_(\w+)\}/g)];
  for (const [, poseName, rig] of usage) {
    const glb = `public/models/figure_${rig.toLowerCase()}.glb`;
    if (glb !== GLB) {
      continue;
    }
    const pose = POSES[poseName.toLowerCase()];
    if (!pose || !pose["UpperArm.L"]) {
      continue;
    }
    const { offsets } = poseOffsets(pose);
    const gap = metres(worldPosition("Palm.L", offsets).distanceTo(worldPosition("Palm.R", offsets)));
    const handsTogether = Math.abs(pose["UpperArm.L"][1]) > 0.2;
    if (handsTogether) {
      assert(gap >= 0.06 && gap <= 0.22, `${poseName} palm gap on ${rig}`, `${gap.toFixed(3)} m, want 0.06-0.22`);
    }
    const asym = Math.abs(Math.abs(pose["UpperArm.L"][0]) - Math.abs(pose["UpperArm.R"][0]));
    assert(asym < 0.02, `${poseName} arm symmetry`, `${((asym * 180) / Math.PI).toFixed(1)}° between sides, want under 1°`);
  }

  // The stole against the robe it hangs on. Both are declared in the source, so the
  // clearance is checked against the alb's real lathe profile, interpolated.
  // Scoped to the profile literal itself. Matching `[a, b]` across the whole file
  // instead swept up unrelated two-element arrays and reported the robe as reaching
  // z 60 — a check that fails loudly on a phantom is no better than one that passes
  // on a real defect.
  const profileBlock = /const profile: \[number, number\]\[\] = \[([\s\S]*?)\n {4}\];/.exec(source);
  const named = (token) => {
    const literal = new RegExp(`const ${token} = ([\\d.]+)`).exec(source);
    return literal ? Number(literal[1]) : NaN;
  };
  const albProfile = profileBlock
    ? [...profileBlock[1].matchAll(/\[([\d.]+), (ALB_HEM_Y|ALB_TOP_Y|[\d.]+)\]/g)].map(([, radius, height]) => [
        Number(radius),
        Number.isNaN(Number(height)) ? named(height) : Number(height)
      ])
    : [];
  const stoleZ = Number(/position=\{\[x, \(NECK_Y \+ ([\d.]+)\) \/ 2, ([\d.]+)\]\}/.exec(source)?.[2] ?? NaN);
  const stoleBottom = Number(/position=\{\[x, \(NECK_Y \+ ([\d.]+)\) \/ 2/.exec(source)?.[1] ?? NaN);
  const albRadiusAt = (y) => {
    let widest = 0;
    for (let index = 1; index < albProfile.length; index += 1) {
      const [r0, y0] = albProfile[index - 1];
      const [r1, y1] = albProfile[index];
      if (y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) {
        widest = Math.max(widest, r0, r1);
      }
    }
    return widest;
  };
  const officiantRig = /recolor=\{PRIEST_COLORS\}[\s\S]{0,120}?url=\{FIGURE_(\w+)\}/.exec(source)?.[1]?.toLowerCase();
  const isOfficiantRig = officiantRig ? GLB.includes(`figure_${officiantRig}.glb`) : true;
  if (isOfficiantRig && Number.isFinite(stoleZ) && albProfile.length) {
    const widest = Math.max(albRadiusAt(stoleBottom), albRadiusAt(0.7), albRadiusAt(0.85));
    assert(stoleZ > widest, "stole clears the alb", `stole at z ${stoleZ}, robe surface reaches z ${widest.toFixed(3)}`);
  }

  // The psalter against the hands that are supposed to be holding it.
  const psalter = /<group position=\{\[0, ([\d.]+), ([\d.]+)\]\} rotation=\{\[-0\.3/.exec(source);
  const officiant = POSES.officiant;
  if (isOfficiantRig && psalter && officiant) {
    const { offsets } = poseOffsets(officiant);
    const left = worldPosition("Palm.L", offsets);
    const right = worldPosition("Palm.R", offsets);
    const palmZ = ((left.z + right.z) / 2) * FIGURE_SCALE;
    const palmY = ((left.y + right.y) / 2) * FIGURE_SCALE;
    const bookZ = Number(psalter[2]);
    const bookY = Number(psalter[1]);
    assert(Math.abs(bookZ - palmZ) < 0.04, "psalter sits in the hands (depth)", `book z ${bookZ}, palms z ${palmZ.toFixed(3)}`);
    assert(Math.abs(bookY - palmY) < 0.05, "psalter sits in the hands (height)", `book y ${bookY}, palms y ${palmY.toFixed(3)}`);
  }

  // Constants that place something AT a figure — an eye-height camera, a photo disc
  // standing in for a face. Both were metre values written into unit fields, which put
  // the first-person camera 0.64 m above the crown of the person it represents and the
  // couple's uploaded photo clear of their hair. Checked against the figure's own
  // documented height rather than against anything real-world.
  const FIGURE_HEIGHT_UNITS = 1.1;
  const EYE_FRACTION = 0.93;
  const eyeHeight = FIGURE_HEIGHT_UNITS * EYE_FRACTION;
  for (const token of ["COUPLE_FACE_Y", "FIRST_PERSON_EYE_Y"]) {
    const declared = new RegExp(`const ${token} = ([\\d.]+)`).exec(source);
    if (!declared) {
      continue;
    }

    const value = Number(declared[1]);
    assert(
      value < FIGURE_HEIGHT_UNITS,
      `${token} is below the crown`,
      `${value} vs a figure ${FIGURE_HEIGHT_UNITS} units tall`
    );
    assert(
      Math.abs(value - eyeHeight) < 0.12,
      `${token} is near eye height`,
      `${value}, eyes are at ${eyeHeight.toFixed(3)}`
    );
  }

  console.log(`\n${GLB}`);
  for (const line of pass) {
    console.log(`  PASS  ${line}`);
  }
  for (const line of failures) {
    console.log(`  FAIL  ${line}`);
  }
  if (failures.length) {
    process.exitCode = 1;
  }
}
