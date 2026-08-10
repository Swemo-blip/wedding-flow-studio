# Give the bride the reference's LOW BUN instead of the source model's ponytail.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python scripts/refine-bride-hair.py -- public/models/figure_woman.glb
#
# The owner's reference mockup shows the bride with a low bun at the nape; the
# Quaternius rig ships a ponytail that reads playful rather than bridal, and it is
# the single most visible thing about her from the hero camera, which stands
# behind the couple.
#
# Method, chosen for what it CANNOT break:
# - The ponytail is removed by deleting Hair-material vertices that hang BEHIND
#   and BELOW the skull — measured against the head bone, not guessed.
# - The bun is a new UV sphere at the nape, weighted 100% to the Head bone, so it
#   follows every clip exactly like the skull does. It reuses the existing Hair
#   MATERIAL, which is what AnimatedFigure recolors by name — no app change needed.
# - Edits happen on a COPY of the input; the original is kept as .bak once.
import os
import shutil
import sys

import bpy
from mathutils import Vector

GLB = sys.argv[sys.argv.index("--") + 1]
backup = GLB + ".bak"
if not os.path.exists(backup):
    shutil.copy2(GLB, backup)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

armature = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
head_bone = armature.pose.bones["Head"]
# bone.head is the bone's BASE — the neck joint — not the skull. Measuring hair
# distances from the neck made the whole skull read as "far" and hid the tail
# cluster entirely (min 0.35, median 0.57, max 0.77: one smeared band). The skull
# centre is the bone's midpoint.
neck_world = armature.matrix_world @ head_bone.head
head_world = armature.matrix_world @ ((head_bone.head + head_bone.tail) / 2)

meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
hair_mesh = None
hair_slot = None
for mesh in meshes:
    for index, slot in enumerate(mesh.material_slots):
        if slot.material and slot.material.name.startswith("Hair"):
            hair_mesh = mesh
            hair_slot = index
            break
    if hair_mesh:
        break
if hair_mesh is None:
    raise RuntimeError("no Hair material found")

# --- remove the ponytail, MEASURED and sign-free -----------------------------
# Attempt #1 failed twice over and both failures were scale/axis guesses: the
# selection threshold was written in APP units (0.235x) against a rig ~4.7 units
# tall, and it swept the whole mesh rather than the Hair faces. This version:
#   1. collects ONLY vertices used by Hair-material polygons,
#   2. measures each one's DISTANCE from the head bone (no axis assumptions),
#   3. prints the distribution, then splits skull-hair from tail at the gap,
#   4. derives the bun's direction FROM the measured tail centroid.
hair_vert_indices = set()
for polygon in hair_mesh.data.polygons:
    if polygon.material_index == hair_slot:
        hair_vert_indices.update(polygon.vertices)

distances = {}
for index in hair_vert_indices:
    world = hair_mesh.matrix_world @ hair_mesh.data.vertices[index].co
    distances[index] = (world - head_world).length

values = sorted(distances.values())
print(f"HAIR: {len(values)} verts, distance from skull centre min {values[0]:.2f} median {values[len(values)//2]:.2f} max {values[-1]:.2f}", flush=True)

# The tail on this model is a short puff, so there is no distance gap to split on.
# Split by DIRECTION instead: the hair's own asymmetry points backward (a skull cap
# is symmetric; the tail is the only mass on one side), and tail verts are those
# projecting past the skull surface along that axis. Sign-free — the axis is
# measured, not assumed.
backward = Vector((0, 0, 0))
for index in hair_vert_indices:
    offset = (hair_mesh.matrix_world @ hair_mesh.data.vertices[index].co) - head_world
    offset.z = 0
    backward += offset
backward.normalize()

projections = {}
for index in hair_vert_indices:
    offset = (hair_mesh.matrix_world @ hair_mesh.data.vertices[index].co) - head_world
    projections[index] = offset.x * backward.x + offset.y * backward.y
sorted_projections = sorted(projections.values())
print(
    f"PROJECTION along measured back axis ({backward.x:.2f}, {backward.y:.2f}): "
    f"min {sorted_projections[0]:.2f} median {sorted_projections[len(sorted_projections)//2]:.2f} max {sorted_projections[-1]:.2f}",
    flush=True
)

# The skull surface sits ~0.35 from centre on this rig; anything projecting well
# past it along the back axis is tail.
threshold = 0.42
tail = [index for index, projection in projections.items() if projection > threshold]
if not tail:
    raise RuntimeError("no tail past the skull — inspect the printed projections")
print(f"TAIL: {len(tail)} verts past {threshold:.2f}", flush=True)

bpy.context.view_layer.objects.active = hair_mesh
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for index in tail:
    hair_mesh.data.vertices[index].select = True
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="VERT")
bpy.ops.object.mode_set(mode="OBJECT")
print(f"PONYTAIL: removed {len(tail)} vertices", flush=True)

# --- add the low bun ---------------------------------------------------------
# Sized to the RIG (a skull here is ~0.6 units wide), placed along the measured
# backward direction — the same one the tail actually hung in.
# The LOW bun sits at the nape: at neck-joint height, just behind the skull.
bun_center = Vector((neck_world.x, neck_world.y, neck_world.z + 0.06)) + backward * 0.3
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.22, location=bun_center)
bun = bpy.context.active_object
bun.name = "BridalBun"
bun.scale = (1.0, 0.85, 0.9)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()

# Reuse the rig's own Hair material so the app's recolor-by-name reaches the bun.
bun.data.materials.append(hair_mesh.material_slots[hair_slot].material)

# Weight every bun vertex fully to the Head bone and attach to the armature, so
# the bun rides the skull through every animation clip.
group = bun.vertex_groups.new(name="Head")
group.add(list(range(len(bun.data.vertices))), 1.0, "REPLACE")
modifier = bun.modifiers.new("Armature", "ARMATURE")
modifier.object = armature
bun.parent = armature

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True)
print("BRIDE EXPORTED ->", GLB, flush=True)
