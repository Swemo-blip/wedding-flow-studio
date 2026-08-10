// Turn the bride's ponytail INTO her low bun — without Blender.
//
//   node scripts/collapse-ponytail.mjs public/models/figure_woman.glb
//
// Why not Blender: a full import/export roundtrip of this animated rig is NOT an
// identity operation. It re-decomposed the bone rest rotations, which silently
// broke the solved POSE_BOUQUET (palm gap 0.125 m -> 0.725 m, caught by
// check:figures). This script instead rewrites ONLY vertex position values inside
// the GLB's binary chunk: same topology, same indices, same skin weights, same
// bones, same clips. Nothing else in the file changes by a single byte.
//
// The move itself: the tail vertices collapse toward their own centroid (an
// affine shrink, which survives the bind-to-world transform unchanged) and slide
// toward the nape. The ponytail's own geometry BECOMES the bun — already skinned
// to the head, already wearing the Hair material the app recolors by name.
//
// Tail identification is measured, not assumed: vertices are skinned to their
// idle-clip world positions by forward kinematics (the same math as
// figure-pose-probe), and the tail is what projects backward past the skull.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { Matrix4, Vector3, Vector4, Quaternion } from "three";

const GLB = process.argv[2] ?? "public/models/figure_woman.glb";
if (!existsSync(GLB + ".bak")) {
  copyFileSync(GLB, GLB + ".bak");
}

const buf = readFileSync(GLB);
let offset = 12;
let json = null;
let binStart = -1;
let binLength = 0;
while (offset < buf.length) {
  const length = buf.readUInt32LE(offset);
  const type = buf.readUInt32LE(offset + 4);
  const start = offset + 8;
  if (type === 0x4e4f534a) {
    json = JSON.parse(buf.subarray(start, start + length).toString("utf8"));
  } else if (type === 0x004e4942) {
    binStart = start;
    binLength = length;
  }
  offset = start + length + ((4 - (length % 4)) % 4);
}
const bin = buf.subarray(binStart, binStart + binLength);

// --- forward kinematics at an idle frame (same approach as the pose probe) ---
const parentOf = new Map();
json.nodes.forEach((node, index) => (node.children ?? []).forEach((child) => parentOf.set(child, index)));

function accessor(index) {
  const desc = json.accessors[index];
  const view = json.bufferViews[desc.bufferView];
  const sizes = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
  const counts = { MAT4: 16, SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const componentSize = sizes[desc.componentType];
  const componentCount = counts[desc.type];
  const stride = view.byteStride ?? componentSize * componentCount;
  const base = (view.byteOffset ?? 0) + (desc.byteOffset ?? 0);
  const out = [];
  for (let element = 0; element < desc.count; element += 1) {
    const row = [];
    for (let component = 0; component < componentCount; component += 1) {
      const at = base + element * stride + component * componentSize;
      row.push(
        desc.componentType === 5126 ? bin.readFloatLE(at) : desc.componentType === 5123 ? bin.readUInt16LE(at) : desc.componentType === 5125 ? bin.readUInt32LE(at) : bin.readUInt8(at)
      );
    }
    out.push(componentCount === 1 ? row[0] : row);
  }
  return out;
}

const idle = (json.animations ?? []).find((animation) => /idle/i.test(animation.name ?? "")) ?? json.animations[0];
const clipRotation = new Map();
for (const channel of idle.channels) {
  if (channel.target.path !== "rotation") continue;
  const sampler = idle.samplers[channel.sampler];
  const values = accessor(sampler.output);
  clipRotation.set(channel.target.node, values[Math.floor(values.length / 3)]);
}

function nodeWorld(index) {
  const chain = [];
  let cursor = index;
  while (cursor !== undefined) {
    chain.unshift(cursor);
    cursor = parentOf.get(cursor);
  }
  const matrix = new Matrix4();
  for (const link of chain) {
    const node = json.nodes[link];
    const rotation = clipRotation.get(link) ?? node.rotation ?? [0, 0, 0, 1];
    matrix.multiply(
      new Matrix4().compose(
        new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        new Quaternion().fromArray(rotation),
        new Vector3().fromArray(node.scale ?? [1, 1, 1])
      )
    );
  }
  return matrix;
}

// --- skin the hair vertices to world space -----------------------------------
const skin = json.skins[0];
const jointNodes = skin.joints;
const inverseBinds = accessor(skin.inverseBindMatrices).map((row) => new Matrix4().fromArray(row));
const jointMatrices = jointNodes.map((jointIndex, position) => nodeWorld(jointIndex).clone().multiply(inverseBinds[position]));

const names = json.nodes.map((node) => node.name);
const headJoint = nodeWorld(names.indexOf("Head"));
const skullCentre = new Vector3().setFromMatrixPosition(headJoint);

// Locate the Hair primitive and its POSITION accessor.
const hairMaterialIndex = json.materials.findIndex((material) => material.name === "Hair");
let positionAccessorIndex = -1;
let jointsAccessorIndex = -1;
let weightsAccessorIndex = -1;
for (const mesh of json.meshes) {
  for (const primitive of mesh.primitives) {
    if (primitive.material === hairMaterialIndex) {
      positionAccessorIndex = primitive.attributes.POSITION;
      jointsAccessorIndex = primitive.attributes.JOINTS_0;
      weightsAccessorIndex = primitive.attributes.WEIGHTS_0;
    }
  }
}
if (positionAccessorIndex < 0) throw new Error("no Hair primitive");

const positions = accessor(positionAccessorIndex);
const joints = accessor(jointsAccessorIndex);
const weights = accessor(weightsAccessorIndex);

function skinnedWorld(index) {
  const bind = new Vector3().fromArray(positions[index]);
  const out = new Vector3();
  const temp = new Vector3();
  for (let influence = 0; influence < 4; influence += 1) {
    const weight = weights[index][influence];
    if (!weight) continue;
    temp.copy(bind).applyMatrix4(jointMatrices[joints[index][influence]]);
    out.addScaledVector(temp, weight);
  }
  return out;
}

// Back axis from the hair's own asymmetry, in WORLD space.
const worlds = positions.map((_, index) => skinnedWorld(index));
const backward = new Vector3();
for (const world of worlds) {
  backward.add(new Vector3(world.x - skullCentre.x, 0, world.z - skullCentre.z));
}
backward.normalize();

const projections = worlds.map((world) => (world.x - skullCentre.x) * backward.x + (world.z - skullCentre.z) * backward.z);
const sortedProjections = [...projections].sort((a, b) => a - b);
console.log(
  `hair verts ${worlds.length}; back-axis projection min ${sortedProjections[0].toFixed(2)} median ${sortedProjections[Math.floor(sortedProjections.length / 2)].toFixed(2)} max ${sortedProjections[sortedProjections.length - 1].toFixed(2)}`
);

// The skull cap reaches ~0.35 behind centre on this rig; the tail is what is left.
const TAIL_THRESHOLD = 0.42;
const tail = [];
for (let index = 0; index < worlds.length; index += 1) {
  if (projections[index] > TAIL_THRESHOLD) tail.push(index);
}
console.log(`tail: ${tail.length} verts past ${TAIL_THRESHOLD}`);
if (!tail.length) throw new Error("no tail found — read the projection stats above");

// --- collapse, in BIND space (affine, so it survives skinning unchanged) -----
const bindCentroid = new Vector3();
for (const index of tail) {
  bindCentroid.add(new Vector3().fromArray(positions[index]));
}
bindCentroid.divideScalar(tail.length);

// Shrink to 45% around the centroid, then pull the whole clump 40% of the way
// back toward the skull so it nestles at the nape instead of hovering where the
// tail's middle used to be. All affine, all bind space.
const positionDescriptor = json.accessors[positionAccessorIndex];
const positionView = json.bufferViews[positionDescriptor.bufferView];
const positionStride = positionView.byteStride ?? 12;
const positionBase = binStart + (positionView.byteOffset ?? 0) + (positionDescriptor.byteOffset ?? 0);

// The nape in bind space: average of the NON-tail hair verts' rear quarter.
const capRear = [];
for (let index = 0; index < worlds.length; index += 1) {
  if (projections[index] > 0.15 && projections[index] <= TAIL_THRESHOLD) capRear.push(index);
}
const napeBind = new Vector3();
for (const index of capRear) {
  napeBind.add(new Vector3().fromArray(positions[index]));
}
napeBind.divideScalar(Math.max(1, capRear.length));

for (const index of tail) {
  const bind = new Vector3().fromArray(positions[index]);
  bind.sub(bindCentroid).multiplyScalar(0.45).add(bindCentroid);
  bind.lerp(napeBind, 0.4);
  buf.writeFloatLE(bind.x, positionBase + index * positionStride);
  buf.writeFloatLE(bind.y, positionBase + index * positionStride + 4);
  buf.writeFloatLE(bind.z, positionBase + index * positionStride + 8);
}

writeFileSync(GLB, buf);
console.log(`BUN: collapsed ${tail.length} tail verts into a nape knot -> ${GLB}`);
