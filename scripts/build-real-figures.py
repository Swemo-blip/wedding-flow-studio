# Generate REALISTIC wedding figures with MPFB (MakeHuman-in-Blender) — CC0 assets.
#
#   /Applications/Blender.app/Contents/MacOS/Blender --background \
#     --python scripts/build-real-figures.py -- bride portrait /path/out.png
#
# Modes:
#   portrait  — build the figure and render a Cycles head-and-shoulders portrait
#               so the FACE can be judged before anything touches the app.
#   full      — build, pose, dress, and export a GLB for the scene (added once the
#               portrait passes judgement — do not export an unjudged face).
#
# Requires: the MPFB extension (blender_org.mpfb, GPLv3) and the MakeHuman system
# asset pack (CC0) unpacked into MPFB's user data dir. Both were installed
# 2026-08-10; see the session notes. Nothing here is paid.
import math
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
FIGURE = ARGS[0] if ARGS else "bride"
MODE = ARGS[1] if len(ARGS) > 1 else "portrait"
OUT = ARGS[2] if len(ARGS) > 2 else "/tmp/figure.png"

# MPFB ships as a Blender extension, so its import root is bl_ext.<repo>.<id>.
try:
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.objectservice import ObjectService
except ModuleNotFoundError:  # older packaging fallback
    from mpfb.services.humanservice import HumanService
    from mpfb.services.objectservice import ObjectService

# Wipe the default cube/camera/light.
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------------------
# Figure recipes. Phenotype values are MakeHuman macro sliders in 0..1.
# gender: 0 = female, 1 = male. All assets below exist in the CC0 system pack.
# ---------------------------------------------------------------------------
RECIPES = {
    "bride": {
        "name": "bride",
        "phenotype": {
            "gender": 0.0,
            "age": 0.42,
            "muscle": 0.45,
            "weight": 0.42,
            "proportions": 0.72,
            "height": 0.52,
            "cupsize": 0.45,
            "firmness": 0.6,
            "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0},
        },
        "rig": "game_engine",
        "eyes": "high-poly.mhclo",
        "eyebrows": "eyebrow010.mhclo",
        "eyelashes": "eyelashes02.mhclo",
        "teeth": "teeth_base.mhclo",
        "hair": "braid01.mhclo",
        "skin_mhmat": "young_caucasian_female.mhmat",
        "eye_color": "blue_eye.png",
        "hair_shades": ((0.28, 0.185, 0.075), (0.9, 0.75, 0.42)),  # golden blonde: shadow tone -> highlight tone
        "skin_tint": (1.0, 0.95, 0.9),  # takes the porcelain edge off
        "gown": True,
    },
    "groom": {
        "name": "groom",
        "phenotype": {
            "gender": 1.0,
            "age": 0.45,
            "muscle": 0.55,
            "weight": 0.5,
            "proportions": 0.7,
            "height": 0.58,
            "cupsize": 0.5,
            "firmness": 0.5,
            "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0},
        },
        "rig": "game_engine",
        "eyes": "high-poly.mhclo",
        "eyebrows": "eyebrow006.mhclo",
        "eyelashes": "eyelashes04.mhclo",
        "teeth": "teeth_base.mhclo",
        "hair": "short02.mhclo",
        "skin_mhmat": "young_caucasian_male.mhmat",
        "clothes": ["male_elegantsuit01.mhclo", "shoes04.mhclo"],
        "eye_color": "brownlight_eye.png",
        "hair_tint": (0.38, 0.26, 0.16),
        "skin_tint": (1.0, 0.95, 0.9),
        "clasp_height": 0.56,
        "suit_darken": True,
    },
    "officiant": {
        "name": "officiant",
        "phenotype": {
            "gender": 1.0,
            "age": 0.62,
            "muscle": 0.45,
            "weight": 0.55,
            "proportions": 0.6,
            "height": 0.55,
            "cupsize": 0.5,
            "firmness": 0.5,
            "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0},
        },
        "rig": "game_engine",
        "eyes": "high-poly.mhclo",
        "eyebrows": "eyebrow001.mhclo",
        "eyelashes": "eyelashes04.mhclo",
        "teeth": "teeth_base.mhclo",
        "hair": "short01.mhclo",
        "skin_mhmat": "middleage_caucasian_male.mhmat",
        "clothes": ["male_elegantsuit01.mhclo", "shoes04.mhclo"],
        "eye_color": "grey_eye.png",
        "hair_tint": (0.55, 0.53, 0.5),
        "skin_tint": (1.0, 0.95, 0.9),
        "clasp_height": 0.63,
        "suit_darken": True,
    },
    # Congregation variants: seated guests for the pews. No shoes — the pew
    # fronts hide the feet — and half-size textures; there will be many clones.
    "congregant_f1": {
        "name": "congregant_f1",
        "phenotype": {"gender": 0.0, "age": 0.5, "muscle": 0.4, "weight": 0.5, "proportions": 0.55, "height": 0.5, "cupsize": 0.5, "firmness": 0.5,
                      "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}},
        "rig": "game_engine",
        "eyes": "low-poly.mhclo", "eyebrows": "eyebrow008.mhclo", "eyelashes": "eyelashes03.mhclo",
        "hair": "bob01.mhclo", "skin_mhmat": "middleage_caucasian_female.mhmat",
        "clothes": ["female_casualsuit01.mhclo"],
        "eye_color": "green_eye.png", "hair_tint": (0.42, 0.3, 0.19), "skin_tint": (1.0, 0.95, 0.9),
        "clothes_tint": (0.34, 0.38, 0.31), "seated": True, "no_subdiv": True, "texture_cap": 512,
    },
    "congregant_m1": {
        "name": "congregant_m1",
        "phenotype": {"gender": 1.0, "age": 0.55, "muscle": 0.5, "weight": 0.55, "proportions": 0.5, "height": 0.55, "cupsize": 0.5, "firmness": 0.5,
                      "race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}},
        "rig": "game_engine",
        "eyes": "low-poly.mhclo", "eyebrows": "eyebrow002.mhclo", "eyelashes": "eyelashes04.mhclo",
        "hair": "short03.mhclo", "skin_mhmat": "middleage_caucasian_male.mhmat",
        "clothes": ["male_casualsuit03.mhclo"],
        "eye_color": "brown_eye.png", "hair_tint": (0.3, 0.22, 0.15), "skin_tint": (1.0, 0.95, 0.9),
        "clothes_tint": (0.3, 0.31, 0.36), "seated": True, "no_subdiv": True, "texture_cap": 512,
    },
    "congregant_f2": {
        "name": "congregant_f2",
        "phenotype": {"gender": 0.0, "age": 0.35, "muscle": 0.45, "weight": 0.45, "proportions": 0.6, "height": 0.48, "cupsize": 0.45, "firmness": 0.6,
                      "race": {"asian": 0.35, "caucasian": 0.65, "african": 0.0}},
        "rig": "game_engine",
        "eyes": "low-poly.mhclo", "eyebrows": "eyebrow005.mhclo", "eyelashes": "eyelashes03.mhclo",
        "hair": "long01.mhclo", "skin_mhmat": "young_asian_female.mhmat",
        "clothes": ["female_casualsuit01.mhclo"],
        "eye_color": "brown_eye.png", "hair_tint": (0.2, 0.15, 0.12), "skin_tint": (1.0, 0.95, 0.9),
        "clothes_tint": (0.42, 0.24, 0.26), "seated": True, "no_subdiv": True, "texture_cap": 512,
    },
    "congregant_m2": {
        "name": "congregant_m2",
        "phenotype": {"gender": 1.0, "age": 0.4, "muscle": 0.55, "weight": 0.5, "proportions": 0.6, "height": 0.6, "cupsize": 0.5, "firmness": 0.5,
                      "race": {"asian": 0.0, "caucasian": 0.7, "african": 0.3}},
        "rig": "game_engine",
        "eyes": "low-poly.mhclo", "eyebrows": "eyebrow007.mhclo", "eyelashes": "eyelashes04.mhclo",
        "hair": "short04.mhclo", "skin_mhmat": "young_african_male.mhmat",
        "clothes": ["male_casualsuit05.mhclo"],
        "eye_color": "deepblue_eye.png", "hair_tint": (0.16, 0.13, 0.11), "skin_tint": (1.0, 0.95, 0.9),
        "clothes_tint": (0.24, 0.27, 0.38), "seated": True, "no_subdiv": True, "texture_cap": 512,
    },
}


def build(figure_key):
    recipe = dict(RECIPES[figure_key])
    human_info = {
        "name": recipe["name"],
        "phenotype": recipe["phenotype"],
        "rig": recipe.get("rig", "game_engine"),
        "eyes": recipe.get("eyes"),
        "eyebrows": recipe.get("eyebrows"),
        "eyelashes": recipe.get("eyelashes"),
        "teeth": recipe.get("teeth"),
        "hair": recipe.get("hair"),
        "skin_mhmat": recipe.get("skin_mhmat", ""),
        # GAMEENGINE keeps the skin a plain Principled+texture tree, which is the
        # only kind of material a GLB export can carry. ENHANCED_SSS is prettier
        # in Cycles but would silently export as grey.
        "skin_material_type": "GAMEENGINE",
        "eyes_material_type": "MAKESKIN",
        "clothes_material_type": "MAKESKIN",
        "clothes": recipe.get("clothes", []),
    }
    settings = HumanService.get_default_deserialization_settings()
    settings["subdiv_levels"] = 1
    basemesh = HumanService.deserialize_from_dict(human_info, settings)
    return basemesh


def _tint_image_pixels(match, tint):
    """Multiply a tint into the texture PIXELS themselves. The glTF exporter only
    understands simple material trees, so tinting via extra mix nodes would render
    correctly in Cycles and then silently export untinted. Baking into the pixels
    gives the render and the GLB one shared truth."""
    import numpy as np

    tinted = set()
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE" or not node.image:
                continue
            image = node.image
            if match not in image.filepath.lower() or image.name in tinted:
                continue
            tinted.add(image.name)
            buffer = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
            image.pixels.foreach_get(buffer)
            pixels = buffer.reshape(-1, 4)
            pixels[:, :3] *= np.asarray(tint, dtype=np.float32)
            image.pixels.foreach_set(pixels.ravel())
            image.pack()


def _recolor_hair_pixels(match, dark, light):
    """Recolour hair by LUMA REMAP, not multiply: a multiply can only darken,
    so no tint could ever make the mid-grey strands blonde. Shadow pixels take
    the dark tone, highlights take the light tone, everything between blends —
    contrast survives, colour is fully replaced."""
    import numpy as np

    done = set()
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE" or not node.image:
                continue
            image = node.image
            if match not in image.filepath.lower() or image.name in done:
                continue
            done.add(image.name)
            buffer = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
            image.pixels.foreach_get(buffer)
            pixels = buffer.reshape(-1, 4)
            luma = pixels[:, :3].max(axis=1)
            scale = max(1e-6, float(np.percentile(luma[pixels[:, 3] > 0.5], 92))) if (pixels[:, 3] > 0.5).any() else 1.0
            mix = np.clip(luma / scale, 0.0, 1.0)[:, None]
            dark_tone = np.asarray(dark, dtype=np.float32)
            light_tone = np.asarray(light, dtype=np.float32)
            pixels[:, :3] = dark_tone + (light_tone - dark_tone) * mix
            image.pixels.foreach_set(pixels.ravel())
            image.pack()


def _darken_suit_pixels(match):
    """Turn the grey CC0 suit charcoal-black while keeping the shirt and the
    tie's light stripes: dark and mid pixels are pushed toward black on a luma
    ramp, bright pixels pass through."""
    import numpy as np

    done = set()
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "TEX_IMAGE" or not node.image:
                continue
            image = node.image
            if match not in image.filepath.lower() or image.name in done:
                continue
            done.add(image.name)
            buffer = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
            image.pixels.foreach_get(buffer)
            pixels = buffer.reshape(-1, 4)
            luma = pixels[:, :3].max(axis=1)
            print(f"SUIT DARKEN: {image.name} luma p10 {np.percentile(luma,10):.2f} p50 {np.percentile(luma,50):.2f} p90 {np.percentile(luma,90):.2f}", flush=True)
            # below 0.45 luma -> x0.18 (charcoal); above 0.75 -> x1.0; ramp between
            factor = 0.18 + 0.82 * np.clip((luma - 0.45) / 0.3, 0.0, 1.0)
            pixels[:, :3] *= factor[:, None]
            image.pixels.foreach_set(pixels.ravel())
            image.pack()
    # The texture is only one path to Base Color: MAKESKIN routes it through a
    # diffuseIntensity MIX whose flat Color1 wins at low factors. Darken every
    # unlinked colour input on the way so no path keeps the suit grey.
    for material in bpy.data.materials:
        if match not in material.name.lower() or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "MIX_RGB":
                for socket in (node.inputs["Color1"], node.inputs["Color2"]):
                    if not socket.is_linked:
                        r, g, b, a = socket.default_value
                        socket.default_value = (r * 0.2, g * 0.2, b * 0.22, a)
            if node.type == "BSDF_PRINCIPLED" and not node.inputs["Base Color"].is_linked:
                r, g, b, a = node.inputs["Base Color"].default_value
                node.inputs["Base Color"].default_value = (r * 0.2, g * 0.2, b * 0.22, a)


def _matte_materials(match):
    """Hair strips ship glossy; under white key lights the specular sheen buries
    any base colour in silver — proven by the red-tint test."""
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        has_match = any(
            n.type == "TEX_IMAGE" and n.image and match in n.image.filepath.lower()
            for n in material.node_tree.nodes
        )
        if not has_match:
            continue
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                node.inputs["Roughness"].default_value = 0.62
                specular = node.inputs.get("Specular IOR Level") or node.inputs.get("Specular")
                if specular is not None:
                    specular.default_value = 0.12


def _swap_eye_texture(color_png):
    """Point the eye material's image node at a different CC0 eye texture.
    The default renders albino-red; the pack ships nine proper colours."""
    import os
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService

    user_data = LocationService.get_user_data()
    new_path = os.path.join(user_data, "eyes", "materials", color_png)
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "TEX_IMAGE" and node.image and "_eye" in node.image.filepath.lower():
                node.image = bpy.data.images.load(new_path)


def beautify(recipe):
    if recipe.get("eye_color"):
        _swap_eye_texture(recipe["eye_color"])
    if recipe.get("hair_shades"):
        _recolor_hair_pixels("/hair/", *recipe["hair_shades"])
        _matte_materials("/hair/")
    elif recipe.get("hair_tint"):
        # one matcher is enough: every hair texture lives under data/hair/
        _tint_image_pixels("/hair/", recipe["hair_tint"])
        _matte_materials("/hair/")
    if recipe.get("clothes_tint"):
        _tint_image_pixels("casualsuit", recipe["clothes_tint"])
        _matte_materials("casualsuit")
    if recipe.get("suit_darken"):
        _darken_suit_pixels("elegantsuit")
        # the charcoal read as light grey in two renders running — it was
        # specular sheen on the fabric, not colour; wool is matte
        _matte_materials("elegantsuit")
    if recipe.get("skin_tint"):
        # matches young_LIGHTSKINNED_female_diffuse.png and its male sibling —
        # never the hair textures, which also end in _diffuse
        _tint_image_pixels("skinned_", recipe["skin_tint"])


# ---------------------------------------------------------------------------
# full mode: pose -> freeze -> gown -> canonical materials -> GLB
# ---------------------------------------------------------------------------
def _find_armature():
    return next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)


def pose_altar_ik():
    """Place the hands where a bouquet is held — navel height, in front of the
    body — and let Blender's IK solver find the arm angles. Four rounds of
    hand-tuned FK signs put the arms behind the back, under the bust, anywhere
    but right; a solver with a world-space target cannot get the side wrong."""
    from mathutils import Vector

    armature = _find_armature()
    body = _body_object()
    height = visible_top(body)
    # figure faces -Y; hands almost touching at the centreline, a hand's depth
    # in front of the belly
    clasp = RECIPES[FIGURE].get("clasp_height", 0.62)
    targets = {
        "l": Vector((0.055, -0.185, clasp * height)),
        "r": Vector((-0.055, -0.185, clasp * height)),
    }
    helpers = []
    for side, position in targets.items():
        target = bpy.data.objects.new(f"ik_target_{side}", None)
        target.location = position
        bpy.context.collection.objects.link(target)
        helpers.append(target)
        lowerarm = armature.pose.bones[f"lowerarm_{side}"]
        constraint = lowerarm.constraints.new("IK")
        constraint.target = target
        constraint.chain_count = 2
    bpy.context.view_layer.update()

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.visual_transform_apply()
    for side in targets:
        lowerarm = armature.pose.bones[f"lowerarm_{side}"]
        for constraint in list(lowerarm.constraints):
            lowerarm.constraints.remove(constraint)
    bpy.ops.object.mode_set(mode="OBJECT")
    for helper in helpers:
        bpy.data.objects.remove(helper, do_unlink=True)
    bpy.context.view_layer.update()


def pose_seated():
    """Sit the figure on a virtual pew bench: drop the pelvis to seat height,
    fold the legs (thighs forward, calves down), rest the hands toward the lap.
    All axes world-space through the same conversion the altar pose uses."""
    from mathutils import Matrix, Vector

    armature = _find_armature()
    body = _body_object()
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    to_armature = armature.matrix_world.inverted().to_3x3()

    # Pew seat surface in the scene measures 0.4415 m; the hip joint sits a bit
    # above where the body meets the bench.
    pelvis = armature.pose.bones["pelvis"]
    pelvis_height = (armature.matrix_world @ pelvis.matrix.translation).z
    drop = pelvis_height - 0.53
    delta = to_armature @ Vector((0.0, 0.0, -drop))
    pelvis.matrix = Matrix.Translation(delta) @ pelvis.matrix
    bpy.context.view_layer.update()

    world_axes = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}

    def rotate(bone_name, axis, degrees):
        pose_bone = armature.pose.bones.get(bone_name)
        if pose_bone is None:
            print("MISSING BONE", bone_name, flush=True)
            return
        pivot = pose_bone.matrix.translation.copy()
        armature_axis = (to_armature @ world_axes[axis]).normalized()
        pose_bone.matrix = (
            Matrix.Translation(pivot)
            @ Matrix.Rotation(math.radians(degrees), 4, armature_axis)
            @ Matrix.Translation(-pivot)
        ) @ pose_bone.matrix
        bpy.context.view_layer.update()

    for side in ("l", "r"):
        rotate(f"thigh_{side}", "X", -84)
        rotate(f"calf_{side}", "X", 82)
        rotate(f"upperarm_{side}", "Y", 68 if side == "l" else -68)
        rotate(f"lowerarm_{side}", "X", -28)
    for finger in ("index", "middle", "ring", "pinky"):
        for joint in (1, 2):
            rotate(f"{finger}_{joint:02d}_l", "Z", -18)
            rotate(f"{finger}_{joint:02d}_r", "Z", 18)
    bpy.ops.object.mode_set(mode="OBJECT")


def pose_altar(pose_spec):
    """Rotate pose bones about world axes at their own heads. The rig is the
    game_engine (UE-mannequin) rig; the figure faces -Y, arms along +/-X."""
    from mathutils import Matrix, Vector

    armature = _find_armature()
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    # Axes are given in WORLD space and converted per call: the armature object
    # carries its own rotation, so armature-local "Y" turned out to be the world
    # VERTICAL axis — posing against local axes swung the arms behind the back.
    world_axes = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}
    to_armature = armature.matrix_world.inverted().to_3x3()
    for bone_name, axis, degrees in pose_spec:
        pose_bone = armature.pose.bones.get(bone_name)
        if pose_bone is None:
            print("MISSING BONE", bone_name, flush=True)
            continue
        pivot = pose_bone.matrix.translation.copy()
        armature_axis = (to_armature @ world_axes[axis]).normalized()
        rotation = (
            Matrix.Translation(pivot)
            @ Matrix.Rotation(math.radians(degrees), 4, armature_axis)
            @ Matrix.Translation(-pivot)
        )
        pose_bone.matrix = rotation @ pose_bone.matrix
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")


# Arms down to the sides, forearms raised to meet in front (bouquet height).
# a soft two-joint curl per finger; the bouquet hides most of the hand,
# but rigid spread fingers read as mannequin even at distance
ALTAR_POSE = (
    [(f"{finger}_{joint:02d}_l", "Z", -25) for finger in ("index", "middle", "ring", "pinky") for joint in (1, 2)]
    + [(f"{finger}_{joint:02d}_r", "Z", 25) for finger in ("index", "middle", "ring", "pinky") for joint in (1, 2)]
)


def freeze():
    """Apply every mesh's modifier stack (mask, subdiv, armature) so the pose
    becomes plain static geometry, then drop the armature."""
    for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.context.view_layer.objects.active = obj
        # MakeHuman's targets live on as shape keys, and a mesh with shape keys
        # refuses modifier_apply — bake the current mix down first.
        if obj.data.shape_keys is not None:
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
        for modifier in list(obj.modifiers):
            if modifier.type == "SUBSURF":
                # keep render-level subdivision on the BODY (the face needs it);
                # flat hair strips and lash cards only get heavier, not better
                if obj.name.endswith(".body") and not RECIPES[FIGURE].get("no_subdiv"):
                    modifier.levels = modifier.render_levels
                    modifier.show_viewport = True
                else:
                    obj.modifiers.remove(modifier)
                    continue
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError as error:
                print("MODIFIER SKIPPED", obj.name, modifier.name, error, flush=True)
    armature = _find_armature()
    if armature is not None:
        bpy.data.objects.remove(armature, do_unlink=True)


def _body_object():
    return next(o for o in bpy.data.objects if o.type == "MESH" and o.name.endswith(".body"))


def build_gown(body):
    """A strapless ivory gown built from the body's own measurements: a fitted
    bodice copied out of the torso geometry, and an A-line skirt lathed from the
    measured waist ring down to the floor. No downloaded clothes asset fits a
    bride, so the gown is constructed, not imported."""
    import bmesh
    import numpy as np
    from mathutils import Vector

    height = visible_top(body)
    waist_z = 0.60 * height
    chest_z = 0.745 * height

    # --- bodice: the torso's own faces, thickened ---------------------------
    # Fingers carry their own weight groups (index_01_l, thumb_02_r, ...) — an
    # "arm" filter that stops at hand_l dresses the fingers in satin mittens.
    ARM_KEYWORDS = ("upperarm", "lowerarm", "hand", "index_", "middle_", "pinky_", "ring_", "thumb_")
    arm_groups = {g.index for g in body.vertex_groups if any(k in g.name for k in ARM_KEYWORDS)}

    def arm_weight_of(vert, layer):
        return sum(w for gi, w in vert[layer].items() if gi in arm_groups) if layer else 0.0
    duplicate = body.copy()
    duplicate.data = body.data.copy()
    duplicate.name = "gown.bodice"
    bpy.context.collection.objects.link(duplicate)
    mesh = bmesh.new()
    mesh.from_mesh(duplicate.data)
    layer = mesh.verts.layers.deform.active
    doomed = []
    for vert in mesh.verts:
        z = vert.co.z
        if z < waist_z - 0.055 or z > chest_z or arm_weight_of(vert, layer) > 0.3:
            doomed.append(vert)
    for vert in doomed:
        mesh.verts.remove(vert)
    mesh.to_mesh(duplicate.data)
    mesh.free()
    solidify = duplicate.modifiers.new("shell", "SOLIDIFY")
    solidify.thickness = 0.0045
    solidify.offset = 1.0
    bpy.context.view_layer.objects.active = duplicate
    bpy.ops.object.modifier_apply(modifier="shell")

    satin = bpy.data.materials.new("gown_satin")
    satin.use_nodes = True
    principled = next(n for n in satin.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (0.902, 0.87, 0.796, 1.0)
    principled.inputs["Roughness"].default_value = 0.42
    sheen = principled.inputs.get("Sheen Weight")
    if sheen is not None:
        sheen.default_value = 0.3
    duplicate.data.materials.clear()
    duplicate.data.materials.append(satin)

    # --- skirt: hip-fitted, draped, with a small train ----------------------
    # Measured on TORSO vertices only: the pose hangs arms and hands at waist
    # height, and including them once made the skirt as wide as the arm span.
    # The first version interpolated waist->floor directly, which rendered as a
    # smooth cone — a lampshade, the owner said. A gown follows the HIP before
    # it flares, drapes in vertical folds that deepen toward the hem, and
    # trails into a train at the back.
    hip_z = 0.52 * height

    # Cross-sections are ELLIPSES measured per axis, not circles: a body is
    # wider side-to-side than front-to-back, and a circular skirt sized to the
    # widest point stands off the body front and back — from the app's slightly
    # elevated camera the 12 mm stand-off read as an open-topped cylinder with
    # a visible rim (the owner's third screenshot). Flush at the top, elliptical
    # through the fall, blending to a circle only in the flare.
    def torso_ring_extents(at_z):
        body_bmesh = bmesh.new()
        body_bmesh.from_mesh(body.data)
        body_layer = body_bmesh.verts.layers.deform.active
        ring = [
            v.co.copy()
            for v in body_bmesh.verts
            if abs(v.co.z - at_z) < 0.03 and arm_weight_of(v, body_layer) < 0.2
        ]
        body_bmesh.free()
        centre_y = float(np.mean([v.y for v in ring]))
        half_x = max(abs(v.x) for v in ring)
        half_y = max(abs(v.y - centre_y) for v in ring)
        return half_x, half_y, centre_y

    waist_x, waist_y_half, waist_y = torso_ring_extents(waist_z)
    hip_x, hip_y_half, _ = torso_ring_extents(hip_z)
    centre = Vector((0.0, waist_y, 0.0))

    segments = 64
    rings = 26
    floor_radius = 0.30
    hem_z = 0.012
    FOLDS = 13
    # A skirt that eases outward from the hip in one sweep is a CONE from the
    # side — the owner flagged it twice. Real fabric falls almost vertically
    # over the thighs and flares from around the knee: fitted to the hip,
    # near-straight fall to the knee, then an accelerating trumpet flare.
    knee_z = 0.28 * height
    # 6.5 mm over the skin: the bodice shell is 4.5 mm, so the skirt lies flush
    # against it instead of leaving a rim to look into
    EASE = 0.0065
    skirt_mesh = bpy.data.meshes.new("gown.skirt")
    verts = []
    faces = []
    top_z = waist_z + 0.02
    for ring in range(rings + 1):
        t = ring / rings
        z = top_z * (1 - t) + hem_z * t
        if z >= hip_z:
            # fitted section: follow the body from waist out to the hip
            s = (top_z - z) / (top_z - hip_z)
            base_x = (waist_x + EASE) * (1 - s) + (hip_x + EASE) * s
            base_y = (waist_y_half + EASE) * (1 - s) + (hip_y_half + EASE) * s
            circle_mix = 0.0
        elif z >= knee_z:
            # the fall: barely widening from hip to knee
            s = (hip_z - z) / (hip_z - knee_z)
            base_x = hip_x + EASE + 0.03 * s
            base_y = hip_y_half + EASE + 0.03 * s
            circle_mix = 0.25 * s
        else:
            # the trumpet: accelerate outward from the knee to the hem,
            # relaxing the ellipse into a circle as the fabric leaves the body
            s = (knee_z - z) / (knee_z - hem_z)
            flare = s**1.7
            base_x = (hip_x + EASE + 0.03) + (floor_radius - hip_x - EASE - 0.03) * flare
            base_y = (hip_y_half + EASE + 0.03) + (floor_radius - hip_y_half - EASE - 0.03) * flare
            circle_mix = 0.25 + 0.75 * s
        mean_radius = (base_x + base_y) / 2
        base_x = base_x * (1 - circle_mix) + mean_radius * circle_mix
        base_y = base_y * (1 - circle_mix) + mean_radius * circle_mix
        # drape folds: a whisper above the knee, deep at the hem
        drop = max(0.0, (hip_z - z) / (hip_z - hem_z))
        below_knee = max(0.0, (knee_z - z) / (knee_z - hem_z))
        fold_amp = 0.006 * drop + 0.034 * below_knee**1.4
        for segment in range(segments):
            angle = 2 * math.pi * segment / segments
            fold = 1.0 + fold_amp * math.sin(angle * FOLDS) / max(0.05, mean_radius)
            # train: the back hem (+y is behind the figure) reaches further out
            behind = max(0.0, math.sin(angle))
            train = 1.0 + 0.36 * below_knee**2.0 * behind**2
            verts.append((
                centre.x + base_x * fold * train * math.cos(angle),
                centre.y + base_y * fold * train * math.sin(angle),
                z,
            ))
    for ring in range(rings):
        for segment in range(segments):
            a = ring * segments + segment
            b = ring * segments + (segment + 1) % segments
            c = (ring + 1) * segments + (segment + 1) % segments
            d = (ring + 1) * segments + segment
            faces.append((a, b, c, d))
    skirt_mesh.from_pydata(verts, [], faces)
    skirt_mesh.update()
    skirt = bpy.data.objects.new("gown.skirt", skirt_mesh)
    bpy.context.collection.objects.link(skirt)
    skirt.data.materials.append(satin)
    for poly in skirt.data.polygons:
        poly.use_smooth = True


def canonicalize_materials():
    """Rewire every image material to the one shape the glTF exporter is
    guaranteed to understand: image -> Base Color, image alpha -> Alpha (as
    alpha-clip), scalar values elsewhere. MPFB's extra mix nodes would export
    as untextured grey."""
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        tree = material.node_tree
        principled = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        image_node = next((n for n in tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
        if principled is None or image_node is None:
            continue
        alpha_was_linked = principled.inputs["Alpha"].is_linked
        for link in list(tree.links):
            if link.to_node == principled and link.to_socket.name in ("Base Color", "Alpha"):
                tree.links.remove(link)
        tree.links.new(image_node.outputs["Color"], principled.inputs["Base Color"])
        if alpha_was_linked:
            tree.links.new(image_node.outputs["Alpha"], principled.inputs["Alpha"])
            material.blend_method = "CLIP"
            if hasattr(material, "alpha_threshold"):
                material.alpha_threshold = 0.35


def shrink_images(cap=1024):
    """The raw export weighs 13.5 MB against the scene's other figures at 200 KB,
    almost all of it the 4K skin diffuse. At scene distances 1K skin is
    indistinguishable; smaller detail maps go to 512."""
    for image in bpy.data.images:
        if not image.size[0]:
            continue
        limit = cap if "skinned_" in image.filepath.lower() else min(512, cap)
        if max(image.size) > limit:
            factor = limit / max(image.size)
            image.scale(max(1, round(image.size[0] * factor)), max(1, round(image.size[1] * factor)))


def export_glb(path, cap=1024):
    shrink_images(cap)
    for obj in bpy.data.objects:
        obj.select_set(obj.type == "MESH")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_image_format="AUTO",
    )
    print("EXPORTED ->", path, flush=True)


def frame_full_body(body):
    height = visible_top(body)
    bpy.ops.object.camera_add(location=(0.0, -3.4, height * 0.52))
    camera = bpy.context.active_object
    camera.rotation_euler = (math.radians(90), 0.0, 0.0)
    camera.data.lens = 50
    bpy.context.scene.camera = camera

    key = bpy.data.lights.new("key", "AREA")
    key.energy = 900
    key.size = 2.5
    key.color = (1.0, 0.94, 0.85)
    key_obj = bpy.data.objects.new("key", key)
    key_obj.location = (1.6, -2.2, height + 0.4)
    key_obj.rotation_euler = (math.radians(55), 0.0, math.radians(35))
    bpy.context.collection.objects.link(key_obj)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 300
    fill.size = 3.5
    fill.color = (0.92, 0.94, 1.0)
    fill_obj = bpy.data.objects.new("fill", fill)
    fill_obj.location = (-1.8, -2.4, height * 0.6)
    fill_obj.rotation_euler = (math.radians(75), 0.0, math.radians(-38))
    bpy.context.collection.objects.link(fill_obj)


def visible_top(basemesh):
    """Highest z of the EVALUATED mesh — the raw vertices include MakeHuman's
    helper cage, which floats above the skull and wrecks any bound taken from
    basemesh.data directly."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = basemesh.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    top = max((evaluated.matrix_world @ v.co).z for v in mesh.vertices)
    evaluated.to_mesh_clear()
    return top


def frame_face(basemesh):
    """Point a portrait camera at the head using the mesh's real bounds."""
    top = visible_top(basemesh)
    face_z = top - 0.12  # eye line sits roughly 12 cm under the crown
    bpy.ops.object.camera_add(location=(0.0, -0.75, face_z))
    camera = bpy.context.active_object
    camera.rotation_euler = (math.radians(90), 0.0, 0.0)
    camera.data.lens = 85  # portrait lens: flat, flattering perspective
    bpy.context.scene.camera = camera

    # Key + fill + rim, warm like the church.
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 320
    key.size = 1.2
    key.color = (1.0, 0.95, 0.88)
    key_obj = bpy.data.objects.new("key", key)
    key_obj.location = (0.9, -0.9, face_z + 0.35)
    key_obj.rotation_euler = (math.radians(65), 0.0, math.radians(45))
    bpy.context.collection.objects.link(key_obj)

    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 90
    fill.size = 2.0
    fill.color = (0.9, 0.93, 1.0)
    fill_obj = bpy.data.objects.new("fill", fill)
    fill_obj.location = (-1.1, -0.8, face_z)
    fill_obj.rotation_euler = (math.radians(80), 0.0, math.radians(-55))
    bpy.context.collection.objects.link(fill_obj)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 140
    rim.size = 0.8
    rim_obj = bpy.data.objects.new("rim", rim)
    rim_obj.location = (0.2, 0.9, face_z + 0.4)
    rim_obj.rotation_euler = (math.radians(-70), 0.0, 0.0)
    bpy.context.collection.objects.link(rim_obj)


def render(path, samples=96, x=760, y=950):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.render.resolution_x = x
    scene.render.resolution_y = y
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("RENDERED ->", path, flush=True)


basemesh = build(FIGURE)
beautify(RECIPES[FIGURE])

if MODE == "bones":
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            print("ARMATURE", obj.name, "scale", tuple(round(s, 3) for s in obj.scale), flush=True)
            for bone in obj.data.bones:
                print("BONE", bone.name, flush=True)
elif MODE == "linkdump":
    for material in bpy.data.materials:
        if "braid" not in material.name.lower() and "elegantsuit" not in material.name.lower():
            continue
        for link in material.node_tree.links:
            print(
                f"LINK {link.from_node.type}({link.from_node.name}).{link.from_socket.name}"
                f" -> {link.to_node.type}({link.to_node.name}).{link.to_socket.name}",
                flush=True,
            )
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                base = node.inputs["Base Color"]
                print(f"PRINCIPLED base_color linked={base.is_linked} value={tuple(round(v,2) for v in base.default_value)}", flush=True)
                alpha = node.inputs["Alpha"]
                print(f"PRINCIPLED alpha linked={alpha.is_linked} value={round(alpha.default_value,2)}", flush=True)
elif MODE == "matdump":
    for material in bpy.data.materials:
        nodes = material.node_tree.nodes if material.use_nodes else []
        images = [n.image.filepath.split("/")[-1] for n in nodes if n.type == "TEX_IMAGE" and n.image]
        groups = [n.node_tree.name for n in nodes if n.type == "GROUP" and n.node_tree]
        print(f"MAT {material.name} :: nodes={sorted({n.type for n in nodes})} images={images} groups={groups}", flush=True)
elif MODE == "portrait":
    frame_face(basemesh)
    render(OUT)
elif MODE == "posecheck":
    # the gownless build: when arms disappear, this frame says whether the pose
    # buried them or the gown swallowed them
    pose_altar_ik()
    pose_altar(ALTAR_POSE)
    freeze()
    body = _body_object()
    frame_full_body(body)
    render(OUT, samples=48, x=560, y=1000)
elif MODE == "full":
    if RECIPES[FIGURE].get("seated"):
        pose_seated()
    else:
        pose_altar_ik()
        pose_altar(ALTAR_POSE)
    freeze()
    body = _body_object()
    if RECIPES[FIGURE].get("gown"):
        build_gown(body)
    canonicalize_materials()
    frame_full_body(body)
    render(OUT + ".check.png", samples=64, x=560, y=1000)
    # second angle: the owner judges the gown from the side-rear quarter, so
    # the check must too — a skirt can pass head-on and still be a cone in profile
    camera = bpy.context.scene.camera
    body_height = visible_top(body)
    camera.location = (2.4, -2.0, body_height * 0.78)
    camera.rotation_euler = (math.radians(79), 0.0, math.radians(50))
    render(OUT + ".side.png", samples=64, x=560, y=1000)
    export_glb(OUT, cap=RECIPES[FIGURE].get("texture_cap", 1024))
else:
    raise SystemExit(f"unknown mode {MODE}")
