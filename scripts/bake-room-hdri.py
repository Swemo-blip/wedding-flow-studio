# Render each room's OWN environment map, from inside the room it belongs to.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python scripts/bake-room-hdri.py -- church public/hdr/church-room.hdr
#
# Why this matters more than it sounds: the app lights its DYNAMIC layer — the
# couple, the officiant, the brass, the glass, the candlesticks — with an HDRI of
# somebody else's building (church_museum_2k.hdr). Every reflection and every
# ambient tint on those objects therefore comes from a room they are not standing
# in. That mismatch is one of the quiet reasons baked walls and live figures read
# as two layers rather than one photograph.
#
# This renders an equirectangular panorama from the middle of the SAME geometry
# and the SAME emitters the shell bake uses, so the couple's gown picks up the
# actual window glow and the brass reflects the actual vault.
#
# The room construction is imported from the shell scripts rather than duplicated:
# one definition of the room, two products (a lightmap and an environment).
import importlib.util
import math
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1 :]
ROOM = ARGS[0]
OUT = ARGS[1]

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(HERE, "bake-church-shell.py" if ROOM == "church" else "bake-hall-shell.py")

# The shell scripts build geometry + lights at import time and then bake. Baking is
# the expensive part and is not wanted here, so the module is executed with a flag
# it checks before the bake loop.
os.environ["WFS_SKIP_BAKE"] = "1"
spec = importlib.util.spec_from_file_location("shell", SOURCE)
module = importlib.util.module_from_spec(spec)
sys.argv = ["blender", "--", os.path.join(HERE, "..", "scratch-bakes", f"{ROOM}-hdri-scratch.glb")]
try:
    spec.loader.exec_module(module)
except SystemExit:
    # Expected: the shell script raises SystemExit at its skip-bake hook once the
    # room is fully built. The geometry and emitters are in bpy.data by then, which
    # is everything this renderer needs.
    pass

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 256

# An equirectangular camera at standing eye height on the room's own axis. 1.62 m
# is FIRST_PERSON_EYE_Y (1.02 scene units), so the environment is sampled from
# where a person actually stands rather than from the ceiling.
bpy.ops.object.camera_add(location=(0, 0, 1.62))
camera = bpy.context.active_object
camera.data.type = "PANO"
try:
    camera.data.panorama_type = "EQUIRECTANGULAR"
except AttributeError:
    # Blender 4.3+ moved panorama_type onto the cycles sub-struct.
    camera.data.cycles.panorama_type = "EQUIRECTANGULAR"
camera.rotation_euler = (math.radians(90), 0, 0)
scene.camera = camera

scene.render.resolution_x = 1024
scene.render.resolution_y = 512
scene.render.image_settings.file_format = "HDR"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("HDRI RENDERED ->", OUT, flush=True)
