# Bake the church nave shell with Cycles global illumination, headless.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python scripts/bake-church-shell.py -- public/models/venues/church-baked.glb
#
# Geometry is derived from components/wedding-studio/church-scene.tsx, in the
# interior group's LOCAL units (world z = local + INTERIOR_Z, applied by the app):
#   side walls   boxes 0.2 x 5.6 x 12.4 at x +-4.95, z centre 0.1
#   east wall    10.1 x 7.5 x 0.22 at z -5.85 (wallHeight 5.6 + 1.9 gable)
#   west wall    piers 4.45 wide at x -+2.825 + lintel over a 1.2 x 1.4 portal, z 6.3
#   ceiling      flat at y 5.6, separate object named "Ceiling" so the app can hide
#                it in the top-down plan view (mirrors RoomFrame's showCeiling)
#   floor        OMITTED on purpose — the app keeps its PBR + reflector floor
#   side windows x +-4.79, y 2.576, z {-3.2, -0.7, 1.8}, 1.0 x 2.4
#   east lancets x +-2.5, y 2.3, 0.8 x 1.7; clerestory x +-2.9, y 4.94, 0.7 x 0.9
#
# The windows stay app-drawn emissive lancets ON TOP of the baked wall; here they
# are AREA LIGHTS just inside each opening, angled into the room, which is what
# prints the warm raking pools onto the baked plaster. Coordinates map
# app (x, y, z) -> Blender (x, -z, y); the glTF exporter's Y-up conversion maps
# them back exactly.
import sys

import bpy
from mathutils import Euler

OUT = sys.argv[sys.argv.index("--") + 1]

WALL_ALBEDO = (0.76, 0.7, 0.585, 1.0)
CEILING_ALBEDO = (0.86, 0.81, 0.71, 1.0)
WARM = (1.0, 0.83, 0.6)
SHELL_RES = 2048
CEILING_RES = 1024
SAMPLES = 512

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
# Metal GPU if the machine offers it; CPU otherwise. Either way it is the owner's
# machine doing the hours, not tokens.
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
    box.scale = (sx, sz, sy)  # app depth(z) becomes Blender y
    bpy.ops.object.transform_apply(scale=True)
    return box


# --- geometry, straight from the scene constants -----------------------------
parts = [
    add_box("WallL", (-4.95, 2.8, 0.1), (0.2, 5.6, 12.4)),
    add_box("WallR", (4.95, 2.8, 0.1), (0.2, 5.6, 12.4)),
    add_box("WallEast", (0, 3.75, -5.85), (10.1, 7.5, 0.22)),
    add_box("PierL", (-2.825, 3.75, 6.3), (4.45, 7.5, 0.22)),
    add_box("PierR", (2.825, 3.75, 6.3), (4.45, 7.5, 0.22)),
    add_box("Lintel", (0, (1.4 + 7.5) / 2, 6.3), (1.2, 7.5 - 1.4, 0.22)),
]

for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
shell = bpy.context.active_object
shell.name = "Shell"

ceiling = add_box("Ceiling", (0, 5.61, 0.1), (9.9, 0.06, 12.6))


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


# --- light rig: one area light per window opening, angled into the nave ------
def add_area(name, center, size, rotation, power, color=WARM):
    bpy.ops.object.light_add(type="AREA", location=app_to_blender(*center))
    light = bpy.context.active_object
    light.name = name
    light.data.shape = "RECTANGLE"
    light.data.size = size[0]
    light.data.size_y = size[1]
    light.data.energy = power
    light.data.color = color
    light.rotation_euler = Euler(rotation)
    return light


import math

# BAKE #2 CORRECTION: plain area lights at 320W blew the interior faces past 1.0,
# which an 8-bit PNG clips to flat white — and an unlit baked wall can no longer
# receive the app's stained-glass gobo spotlights, so the lattice character died
# with it. Both fixed the same way: the windows become PATTERNED EMISSIVE PLANES.
# Cycles samples textured emission as light, so the mosaic prints itself into the
# plaster with real bounce — the lattice is IN the bake now, not painted on after.


def add_window_emitter(name, center, size, yaw_axis, strength):
    bpy.ops.mesh.primitive_plane_add(size=1, location=app_to_blender(*center))
    plane = bpy.context.active_object
    plane.name = name
    plane.scale = (size[0], size[1], 1)
    # A default plane faces Blender +Z. Stand it upright facing the nave.
    if yaw_axis == "left":
        plane.rotation_euler = Euler((0, math.radians(90), 0))
    elif yaw_axis == "right":
        plane.rotation_euler = Euler((0, math.radians(-90), 0))
    else:
        plane.rotation_euler = Euler((math.radians(-90), 0, 0))
    bpy.ops.object.transform_apply(scale=True, rotation=True)

    material = bpy.data.materials.new(f"{name}Mat")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    # Leaded-mosaic light: voronoi cells in warm golds with muted rose/sage notes,
    # matching the app's own stained-glass palette.
    voronoi = nodes.new("ShaderNodeTexVoronoi")
    voronoi.inputs["Scale"].default_value = 9.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (1.0, 0.78, 0.45, 1.0)
    ramp.color_ramp.elements[1].color = (0.85, 0.62, 0.5, 1.0)
    mid = ramp.color_ramp.elements.new(0.55)
    mid.color = (0.97, 0.9, 0.68, 1.0)
    links.new(voronoi.outputs["Distance"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emission.inputs["Color"])
    emission.inputs["Strength"].default_value = strength
    links.new(emission.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(material)
    # Emitters are light sources for the bake, not exported geometry.
    plane.hide_render = False
    return plane


emitters = []
for app_z in (-3.2, -0.7, 1.8):
    emitters.append(add_window_emitter(f"WinL{app_z}", (-4.72, 2.576, app_z), (1.0, 2.4), "left", 22))
    emitters.append(add_window_emitter(f"WinR{app_z}", (4.72, 2.576, app_z), (1.0, 2.4), "right", 14))
for app_x in (-2.5, 2.5):
    emitters.append(add_window_emitter(f"East{app_x}", (app_x, 2.3, -5.62), (0.8, 1.7), "flat", 10))
for app_x in (-2.9, 2.9):
    emitters.append(add_window_emitter(f"Clere{app_x}", (app_x, 4.94, -5.62), (0.7, 0.9), "flat", 6))

# Soft daylight through the west portal, and a whisper of warm ambient so no
# corner goes to black — the reference's shadows sit near L* 35, never 0.
add_area("Portal", (0, 2.4, 6.1), (1.6, 2.6), (math.radians(80), 0, 0), 55, (1.0, 0.93, 0.8))
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.86, 0.78, 0.66, 1.0)
bg.inputs[1].default_value = 0.1

# --- bake: diffuse direct+indirect+color = the finished unlit surface --------
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = True
scene.render.bake.margin = 8

for obj in (shell, ceiling):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    print(f"BAKING {obj.name}…", flush=True)
    bpy.ops.object.bake(type="DIFFUSE")
    print(f"BAKED {obj.name}", flush=True)

# Rewire each material so the BAKED image is the base colour the exporter embeds,
# with the principled surface left on defaults (the app forces MeshBasicMaterial
# at load, per docs/blender-baked-venue.md).
for obj, image in ((shell, shell_img), (ceiling, ceiling_img)):
    material = obj.data.materials[0]
    nodes = material.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    tex = nodes.active
    material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

# PACK the baked images or the exporter embeds NOTHING: a generated image with no
# filepath exports as an empty reference, the app's MeshBasicMaterial gets a null
# map, and the whole room renders as white void. Found the hard way on bake #1.
# Also save PNG copies so the bake can be inspected DIRECTLY as image files —
# cheaper than a browser round, and it separates "bad bake" from "bad export".
import os
inspect_dir = os.path.join(os.path.dirname(os.path.abspath(OUT)), "..", "..", "..", "scratch-bakes")
os.makedirs(inspect_dir, exist_ok=True)
for image, label in ((shell_img, "shell"), (ceiling_img, "ceiling")):
    image.filepath_raw = os.path.join(inspect_dir, f"{label}.png")
    image.file_format = "PNG"
    image.save()
    image.pack()

bpy.ops.object.select_all(action="DESELECT")
shell.select_set(True)
ceiling.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print("SHELL EXPORTED ->", OUT, flush=True)
