# Bake the dinner hall shell with Cycles GI, headless — the DUSK room.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python scripts/bake-hall-shell.py -- public/models/venues/hall-baked.glb
#
# Geometry from RoomFrame (church-scene.tsx), interior-local units:
#   back wall   9.8 x 3.8 x 0.2  at z -5.75
#   side walls  0.18 x 3.8 x 11.8 at x +-4.9, z 0.1
#   ceiling     plane at y 3.78, named "Ceiling" (hidden in plan view by the app)
#   floor       OMITTED — the app keeps its honey-tinted PBR floor
#   back panes  x {-3.2,-1.05,1.05,3.2}, y 1.9, 0.72 x 2.3, at z -5.62
#   side panes  z {-3.4,0.1,3.6}, x +-4.81, 0.9 x 2.1, y 2
#   pendants    cups at x +-1.7, z {-3.2,-1,1.2,3.2}, cup y 2.42 (drop 1.36)
#
# Dusk light: warm amber glow IN the window panes (emissive planes), and each
# pendant is a small warm emitter that prints its own pool on the ceiling above —
# the room the couple dines in at 19:00, not a daylit gallery.
import math
import os
import sys

import bpy
from mathutils import Euler

OUT = sys.argv[sys.argv.index("--") + 1]

WALL_ALBEDO = (0.72, 0.655, 0.535, 1.0)
CEILING_ALBEDO = (0.8, 0.74, 0.63, 1.0)
SHELL_RES = 2048
CEILING_RES = 1024
SAMPLES = 512

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True
    scene.cycles.device = "GPU"
except Exception:
    scene.cycles.device = "CPU"


def app_to_blender(x, y, z):
    return (x, -z, y)


def add_box(name, center, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=app_to_blender(*center))
    box = bpy.context.active_object
    box.name = name
    sx, sy, sz = size
    box.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(scale=True)
    return box


parts = [
    add_box("WallBack", (0, 1.9, -5.75), (9.8, 3.8, 0.2)),
    add_box("WallL", (-4.9, 1.9, 0.1), (0.18, 3.8, 11.8)),
    add_box("WallR", (4.9, 1.9, 0.1), (0.18, 3.8, 11.8)),
    # The entrance end: the hall is open toward +z in the app (the camera lives
    # there); a wall at 6.0 closes the light so the bake does not bleed out, and
    # the app camera at z 7.6 sits OUTSIDE it — so it must never render. It is
    # deleted before export below.
    add_box("WallEntrance", (0, 1.9, 6.0), (9.8, 3.8, 0.2)),
]
for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
shell = bpy.context.active_object
shell.name = "Shell"


# V2, same discipline as the church: the window panes become REAL OPENINGS, so the
# dusk glow reaches the room through apertures and every reveal edge bakes its own
# shadow. Cutters run thicker than the wall; EXACT solver; deleted after use.
def cut_opening(target, center, size, depth_axis):
    cutter_size = (size[0], size[1], 0.6) if depth_axis == "z" else (0.6, size[1], size[0])
    cutter = add_box("Cutter", center, cutter_size)
    modifier = target.modifiers.new("cut", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier="cut")
    bpy.ops.object.select_all(action="DESELECT")
    cutter.select_set(True)
    bpy.ops.object.delete()


for app_x in (-3.2, -1.05, 1.05, 3.2):
    cut_opening(shell, (app_x, 1.9, -5.75), (0.72, 2.3), "z")
for app_z in (-3.4, 0.1, 3.6):
    cut_opening(shell, (-4.9, 2.0, app_z), (0.9, 2.1), "x")
    cut_opening(shell, (4.9, 2.0, app_z), (0.9, 2.1), "x")

# V2 ceiling: a shallow COFFERED plane rather than a flat slab — a 0.12-deep
# recess inset 0.6 from each wall, so the eight pendant pools land inside a
# panel with its own shadowed edge instead of on a blank lid. Two boxes, no
# booleans: the recess is a smaller box lifted above the border ring.
ceiling = add_box("Ceiling", (0, 3.79, 0.1), (9.9, 0.06, 11.9))
recess = add_box("CeilingRecess", (0, 3.87, 0.1), (8.7, 0.06, 10.7))
bpy.ops.object.select_all(action="DESELECT")
ceiling.select_set(True)
recess.select_set(True)
bpy.context.view_layer.objects.active = ceiling
bpy.ops.object.join()
ceiling = bpy.context.active_object
ceiling.name = "Ceiling"


def make_material(name, albedo, image):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = albedo
    bsdf.inputs["Roughness"].default_value = 0.9
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    material.node_tree.nodes.active = node
    return material


shell_img = bpy.data.images.new("shell_bake", SHELL_RES, SHELL_RES)
ceiling_img = bpy.data.images.new("ceiling_bake", CEILING_RES, CEILING_RES)
shell.data.materials.append(make_material("ShellMat", WALL_ALBEDO, shell_img))
ceiling.data.materials.append(make_material("CeilingMat", CEILING_ALBEDO, ceiling_img))

for obj in (shell, ceiling):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def add_emitter_plane(name, center, size, facing, color, strength):
    bpy.ops.mesh.primitive_plane_add(size=1, location=app_to_blender(*center))
    plane = bpy.context.active_object
    plane.name = name
    plane.scale = (size[0], size[1], 1)
    if facing == "left":
        plane.rotation_euler = Euler((0, math.radians(90), 0))
    elif facing == "right":
        plane.rotation_euler = Euler((0, math.radians(-90), 0))
    else:
        plane.rotation_euler = Euler((math.radians(-90), 0, 0))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    material = bpy.data.materials.new(f"{name}Mat")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*color, 1.0)
    emission.inputs["Strength"].default_value = strength
    material.node_tree.links.new(emission.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(material)
    return plane


def add_pendant_glow(name, center, strength):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=app_to_blender(*center))
    sphere = bpy.context.active_object
    sphere.name = name
    material = bpy.data.materials.new(f"{name}Mat")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (1.0, 0.72, 0.42, 1.0)
    emission.inputs["Strength"].default_value = strength
    material.node_tree.links.new(emission.outputs["Emission"], out.inputs["Surface"])
    sphere.data.materials.append(material)
    return sphere


emitters = []
# Back window panes — the dusk glow of the room.
for app_x in (-3.2, -1.05, 1.05, 3.2):
    emitters.append(add_emitter_plane(f"Back{app_x}", (app_x, 1.9, -5.6), (0.72, 2.3), "flat", (1.0, 0.85, 0.6), 7))
# Side panes, softer.
for app_z in (-3.4, 0.1, 3.6):
    emitters.append(add_emitter_plane(f"SideL{app_z}", (-4.79, 2.0, app_z), (0.9, 2.1), "left", (1.0, 0.86, 0.62), 5))
    emitters.append(add_emitter_plane(f"SideR{app_z}", (4.79, 2.0, app_z), (0.9, 2.1), "right", (1.0, 0.86, 0.62), 5))
# The eight pendants: candle-warm, each prints a pool on the ceiling above it and
# a soft one on the tables below. Flame sits ~0.18 above the cup base at y 2.42.
for app_x in (-1.7, 1.7):
    for app_z in (-3.2, -1, 1.2, 3.2):
        emitters.append(add_pendant_glow(f"Pend{app_x}_{app_z}", (app_x, 2.6, app_z), 60))

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.45, 0.42, 0.5, 1.0)
bg.inputs[1].default_value = 0.05

scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = True
scene.render.bake.margin = 8

# scripts/bake-room-hdri.py imports this module to reuse the room construction —
# same geometry, same emitters — and renders a panorama instead of a lightmap. It
# sets WFS_SKIP_BAKE so it does not pay for a bake it will not use.
if os.environ.get("WFS_SKIP_BAKE") == "1":
    print("SKIP BAKE (room reused for HDRI)", flush=True)
    raise SystemExit(0)

for obj in (shell, ceiling):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    print(f"BAKING {obj.name}…", flush=True)
    bpy.ops.object.bake(type="DIFFUSE")
    print(f"BAKED {obj.name}", flush=True)

# The entrance wall existed only to keep the bake's light in the room. The app's
# camera lives beyond it — delete it from the shell before export.
bpy.ops.object.select_all(action="DESELECT")
shell.select_set(True)
bpy.context.view_layer.objects.active = shell
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
# Delete the entrance wall by FACE, not by vertex. Selecting every vertex in the
# band app z 5.85..6.15 also caught the last vertex ring of the two SIDE walls,
# and deleting a vertex deletes every face touching it — so the side walls lost
# their whole final segment and the baked hall ended at app z 4.05 instead of
# 6.05. Six preview cameras and the dance floor then sat outside their own room,
# which is the "cameras start outside" the owner reported. A face whose centre
# lies in the band belongs to the entrance wall alone.
mesh = shell.data
for polygon in mesh.polygons:
    polygon.select = -6.15 <= polygon.center.y <= -5.85
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_mode(type="FACE")
bpy.ops.mesh.delete(type="FACE")
bpy.ops.object.mode_set(mode="OBJECT")
kept = max((v.co.y for v in shell.data.vertices), default=0.0)
print(f"HALL SHELL: walls now reach app z {-min(v.co.y for v in shell.data.vertices):.2f} .. {-kept:.2f}", flush=True)

for obj, image in ((shell, shell_img), (ceiling, ceiling_img)):
    # Boolean/join edits can leave empty slots; find the real material rather than
    # trusting index 0 (trusting it crashed the church's V2 bake).
    material = next((slot for slot in obj.data.materials if slot is not None), None)
    if material is None:
        raise RuntimeError(f"{obj.name} lost its material")
    nodes = material.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    tex = nodes.active
    material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

inspect_dir = os.path.join(os.path.dirname(os.path.abspath(OUT)), "..", "..", "..", "scratch-bakes")
os.makedirs(inspect_dir, exist_ok=True)
for image, label in ((shell_img, "hall-shell"), (ceiling_img, "hall-ceiling")):
    image.filepath_raw = os.path.join(inspect_dir, f"{label}.png")
    image.file_format = "PNG"
    image.save()
    image.pack()

bpy.ops.object.select_all(action="DESELECT")
shell.select_set(True)
ceiling.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print("HALL EXPORTED ->", OUT, flush=True)
