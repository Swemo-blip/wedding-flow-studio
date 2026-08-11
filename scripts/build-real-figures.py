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
        "hand_gap": 0.1,
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
        "hand_gap": 0.125,
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
        "suit_blackout": True,
        "vestments": True,
        "prayer_book": True,
        "hand_gap": 0.125,
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


def _blackout_pixels(match, level=0.12):
    """Multiply EVERY pixel down, highlights included. The luma-ramped darken
    deliberately preserves a white shirt and a striped tie — right for a groom,
    wrong for an officiant, where they fight the clerical collar. Black torso,
    one white band: that is what a priest looks like."""
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
            pixels[:, :3] *= level
            image.pixels.foreach_set(pixels.ravel())
            image.pack()


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
    if recipe.get("suit_blackout"):
        _blackout_pixels("elegantsuit")
        _matte_materials("elegantsuit")
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
    # Hands must NOT meet. At 11 cm apart the palms interpenetrated into one
    # mangled lump of fingers — what the owner saw. Interlaced fingers cannot be
    # authored blind; separated hands with something between them can.
    gap = RECIPES[FIGURE].get("hand_gap", 0.115)
    targets = {
        "l": Vector((gap, -0.185, clasp * height)),
        "r": Vector((-gap, -0.185, clasp * height)),
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
    bpy.ops.object.mode_set(mode="OBJECT")
    curl_fingers(degrees=26)


def curl_fingers(degrees=30, thumb_degrees=16):
    """Curl the fingers around their OWN bone axis. World-axis rotation is
    wrong for finger joints: each finger points a different way, so one shared
    world axis splays them sideways instead of closing them — which is why the
    hands read as spread claws. A pose bone's local X IS the curl axis on this
    rig, so setting rotation_euler.x closes every joint correctly regardless of
    which way the finger points."""
    armature = _find_armature()
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        name = pose_bone.name
        if not any(name.startswith(f"{finger}_0") for finger in ("index", "middle", "ring", "pinky", "thumb")):
            continue
        pose_bone.rotation_mode = "XYZ"
        amount = thumb_degrees if name.startswith("thumb") else degrees
        pose_bone.rotation_euler.z = math.radians(amount if name.endswith("_l") else -amount)
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")




def freeze(keep_armature=False):
    """Apply every mesh's modifier stack (mask, subdiv, armature) so the pose
    becomes plain static geometry, then drop the armature.

    keep_armature leaves the rig and the Armature modifiers in place, which is
    what the walking variants need: a static export loses the figure entirely
    the moment the app has to animate it, and the couple were reverting to the
    old stylized rigs mid-aisle — losing face, hair and gown for the whole
    processional."""
    for obj in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.context.view_layer.objects.active = obj
        # MakeHuman's targets live on as shape keys, and a mesh with shape keys
        # refuses modifier_apply — bake the current mix down first.
        if obj.data.shape_keys is not None:
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
        for modifier in list(obj.modifiers):
            if keep_armature and modifier.type == "ARMATURE":
                continue
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
    if keep_armature:
        return
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
    # The bodice is a COPY of the body's own faces, so its inner wall is exactly
    # coincident with the skin and the two z-fight — the breasts came through the
    # satin as skin-toned bumps. Push the copy out along its normals first so
    # there is real air between body and cloth, then thicken it.
    lift = duplicate.modifiers.new("lift", "DISPLACE")
    lift.mid_level = 0.0
    lift.strength = 0.005
    solidify = duplicate.modifiers.new("shell", "SOLIDIFY")
    solidify.thickness = 0.005
    solidify.offset = 1.0
    bpy.context.view_layer.objects.active = duplicate
    bpy.ops.object.modifier_apply(modifier="lift")
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

    # THE defect the owner reported twice and I misread twice: the skirt's
    # ellipse is centred on the WAIST's centre line, but the buttocks bulge
    # behind the HIP's centre line — so the body pushed straight through the
    # back of the gown and she stood in the aisle with a bare seat. Measure the
    # body's real extent at every height and force the cloth outside it. No
    # silhouette tuning can substitute for this clamp.
    extent_bins = 96
    body_half_x = [0.0] * (extent_bins + 1)
    body_back = [0.0] * (extent_bins + 1)
    body_front = [0.0] * (extent_bins + 1)
    body_bmesh = bmesh.new()
    body_bmesh.from_mesh(body.data)
    body_layer = body_bmesh.verts.layers.deform.active
    for vert in body_bmesh.verts:
        if arm_weight_of(vert, body_layer) > 0.2:
            continue
        position = vert.co
        if position.z > waist_z + 0.05 or position.z < 0.0:
            continue
        index = min(extent_bins, max(0, int(position.z / max(1e-6, waist_z + 0.05) * extent_bins)))
        body_half_x[index] = max(body_half_x[index], abs(position.x))
        body_back[index] = max(body_back[index], position.y - waist_y)
        body_front[index] = max(body_front[index], waist_y - position.y)
    body_bmesh.free()

    def body_at(z):
        index = min(extent_bins, max(0, int(z / max(1e-6, waist_z + 0.05) * extent_bins)))
        window = range(max(0, index - 1), min(extent_bins, index + 1) + 1)
        return (
            max(body_half_x[i] for i in window),
            max(body_back[i] for i in window),
            max(body_front[i] for i in window),
        )

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
        # clear the body wherever it is wider or deeper than the drape wants
        skin_x, skin_back, skin_front = body_at(z)
        base_x = max(base_x, skin_x + 0.013)
        base_y = max(base_y, skin_front + 0.013)
        # The BACK is a single straight line from the waist to the hem: a body-
        # following back profile has a slope break at the hip ring that shades
        # exactly like a seat under tight fabric — "man ser en rumpa", the
        # owner said, and he was right. Fabric spans from the waist over the
        # seat's widest point and falls straight into the train; it never
        # curves back in. The line clears the measured hip depth by a few mm
        # because the hem is far behind the body.
        t_linear = (top_z - z) / (top_z - hem_z)
        back_hem = floor_radius * 1.32  # the train's reach, and the line's end
        back_straight = (waist_y_half + EASE) + (back_hem - waist_y_half - EASE) * t_linear
        back_straight = max(back_straight, skin_back + 0.016)
        # drape folds: a whisper above the knee, deep at the hem
        drop = max(0.0, (hip_z - z) / (hip_z - hem_z))
        below_knee = max(0.0, (knee_z - z) / (knee_z - hem_z))
        fold_amp = 0.006 * drop + 0.034 * below_knee**1.4
        for segment in range(segments):
            angle = 2 * math.pi * segment / segments
            fold = 1.0 + fold_amp * math.sin(angle * FOLDS) / max(0.05, mean_radius)
            # +y is behind the figure: blend from the body-following depth at
            # the sides to the straight back line at the centre back.
            behind = max(0.0, math.sin(angle))
            depth = base_y + (max(back_straight, base_y) - base_y) * behind**1.5
            verts.append((
                centre.x + base_x * fold * math.cos(angle),
                centre.y + depth * fold * math.sin(angle),
                z,
            ))
    for ring in range(rings):
        for segment in range(segments):
            a = ring * segments + segment
            b = ring * segments + (segment + 1) % segments
            c = (ring + 1) * segments + (segment + 1) % segments
            d = (ring + 1) * segments + segment
            faces.append((a, b, c, d))
    # Seeded at -inf, not 0: a max() seeded at zero can never report a passing
    # (negative) clearance, so the guard would have "found" a 0.0 mm violation
    # on a gown that fits perfectly — and a guard that fails on success gets
    # deleted rather than trusted.
    worst = float("-inf")
    for ring_index in range(rings + 1):
        z = top_z * (1 - ring_index / rings) + hem_z * (ring_index / rings)
        skin_x, skin_back, skin_front = body_at(z)
        ring_verts = verts[ring_index * segments:(ring_index + 1) * segments]
        cloth_x = max(abs(v[0]) for v in ring_verts)
        cloth_back = max(v[1] - centre.y for v in ring_verts)
        worst = max(worst, skin_x - cloth_x, skin_back - cloth_back)
    print(f"GOWN clearance: worst body-outside-cloth {worst * 1000:.1f} mm (want negative)", flush=True)
    if worst > -0.002:
        raise RuntimeError(f"the body pokes through the gown by {worst * 1000:.1f} mm")

    skirt_mesh.from_pydata(verts, [], faces)
    skirt_mesh.update()
    skirt = bpy.data.objects.new("gown.skirt", skirt_mesh)
    bpy.context.collection.objects.link(skirt)
    skirt.data.materials.append(satin)
    for poly in skirt.data.polygons:
        poly.use_smooth = True


def build_vestments(body):
    """Black suit + WHITE CLERICAL COLLAR + a small pectoral cross. That is the
    whole priest, and it is deliberately small.

    Two larger ideas were built and thrown away. An alb lathed as a loose robe
    became a white barrel that swallowed the shoulders and left the arms outside
    it. A stole — first as boxes, then as ribbons measured onto the jacket's own
    front surface — kept rendering as two slabs floating in front of the arms,
    occluding the hands. Both failures are the same one: large cloth needs
    simulation, not procedural geometry. Two small correct props beat one large
    wrong one, and the collar is the signal people actually read.

    The collar is sized from the JACKET's collar ring, not from the neck: a band
    matched to the neck's own diameter sits inside the skin and renders as
    nothing, which is exactly what the first two attempts did."""
    import numpy as np

    height = visible_top(body)

    def ring_extent(obj, at_z, tolerance):
        ring = [
            (obj.matrix_world @ v.co).copy()
            for v in obj.data.vertices
            if abs((obj.matrix_world @ v.co).z - at_z) < tolerance
        ]
        if len(ring) < 6:
            return None
        centre_y = float(np.mean([v.y for v in ring]))
        return max(abs(v.x) for v in ring), max(abs(v.y - centre_y) for v in ring), centre_y

    suit = next((o for o in bpy.data.objects if o.type == "MESH" and "elegantsuit" in o.name.lower()), None)
    if suit is None:
        raise RuntimeError("no suit to hang the vestments on")
    suit_top = max((suit.matrix_world @ v.co).z for v in suit.data.vertices)
    collar_ring = ring_extent(suit, suit_top - 0.02, 0.02)
    if collar_ring is None:
        raise RuntimeError("no jacket collar ring found")
    print(
        f"VESTMENTS height {height:.3f} suit_top {suit_top:.3f} "
        f"jacket collar {collar_ring[0]:.3f}x{collar_ring[1]:.3f} centre_y {collar_ring[2]:.3f}",
        flush=True,
    )

    linen = bpy.data.materials.new("vestment_collar")
    linen.use_nodes = True
    linen_bsdf = next(n for n in linen.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    linen_bsdf.inputs["Base Color"].default_value = (0.9, 0.895, 0.875, 1.0)
    linen_bsdf.inputs["Roughness"].default_value = 0.66

    gold = bpy.data.materials.new("pectoral_cross")
    gold.use_nodes = True
    gold_bsdf = next(n for n in gold.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    gold_bsdf.inputs["Base Color"].default_value = (0.42, 0.31, 0.11, 1.0)
    gold_bsdf.inputs["Roughness"].default_value = 0.34
    gold_bsdf.inputs["Metallic"].default_value = 0.75

    # --- the clerical collar: the white tab in the black V ------------------
    # A ring around the neck cannot work on this figure: the jacket collar
    # reaches 1.574 and the jaw starts around 1.59, so a band sized to the neck
    # is swallowed by one or the other — four placements proved it. What a
    # viewer actually reads on a priest from the front is the white TAB sitting
    # in the dark V of the collar, and that has a clear, measurable home.
    tab_z = suit_top - 0.072
    front_candidates = [
        (suit.matrix_world @ v.co)
        for v in suit.data.vertices
        if abs((suit.matrix_world @ v.co).z - tab_z) < 0.022 and abs((suit.matrix_world @ v.co).x) < 0.03
    ]
    tab_y = min((v.y for v in front_candidates), default=-0.12)
    print(f"VESTMENTS tab at z {tab_z:.3f} y {tab_y:.3f}", flush=True)

    bpy.ops.mesh.primitive_cube_add(size=1.0)
    collar = bpy.context.active_object
    collar.name = "vestment.collar"
    collar.scale = (0.023, 0.008, 0.034)
    collar.location = (0.0, tab_y - 0.003, tab_z)
    collar.rotation_euler = (math.radians(-6), 0.0, 0.0)
    collar.data.materials.append(linen)

    # --- the pectoral cross: small, on the chest, on a chain ----------------
    chest_z = 0.70 * height
    chest = ring_extent(suit, chest_z, 0.04)
    front_y = (chest[2] - chest[1]) if chest else -0.15
    arm_length = 0.036
    for axis_scale, offset_z in (((0.008, 0.006, arm_length), 0.0), ((arm_length * 0.62, 0.006, 0.008), arm_length * 0.34)):
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        bar = bpy.context.active_object
        bar.name = "cross.bar"
        bar.scale = axis_scale
        bar.location = (0.0, front_y - 0.008, chest_z + offset_z)
        bar.data.materials.append(gold)

    # A torus here read as a hoop lying on his chest. A chain is two cords
    # running up from the cross to the back of the neck, so that is what it is.
    cord_top_z = suit_top - 0.05
    cord_top_x = 0.055
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0032, depth=1.0)
        cord = bpy.context.active_object
        cord.name = "cross.chain"
        top = (side * cord_top_x, front_y + 0.03, cord_top_z)
        bottom = (0.0, front_y - 0.006, chest_z + arm_length + 0.02)
        span = (bottom[0] - top[0], bottom[1] - top[1], bottom[2] - top[2])
        length = math.sqrt(sum(component * component for component in span))
        cord.scale = (1.0, 1.0, length)
        cord.location = tuple((top[i] + bottom[i]) / 2 for i in range(3))
        cord.rotation_euler = (
            math.acos(span[2] / length),
            0.0,
            math.atan2(-span[0], span[1]),
        )
        cord.data.materials.append(gold)


def build_prayer_book(body):
    """A closed book held at waist height between the hands. It fills the gap
    the separated hands leave, covers the fingertips — the weakest geometry on
    the figure — and reads as the liturgy he is reading from."""
    height = visible_top(body)
    clasp = RECIPES[FIGURE].get("clasp_height", 0.62)
    centre_z = clasp * height

    leather = bpy.data.materials.new("book_leather")
    leather.use_nodes = True
    leather_bsdf = next(n for n in leather.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    # A black book on a black suit is not a book, it is a hole. Oxblood.
    leather_bsdf.inputs["Base Color"].default_value = (0.115, 0.035, 0.03, 1.0)
    leather_bsdf.inputs["Roughness"].default_value = 0.55

    pages = bpy.data.materials.new("book_pages")
    pages.use_nodes = True
    pages_bsdf = next(n for n in pages.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    pages_bsdf.inputs["Base Color"].default_value = (0.82, 0.79, 0.72, 1.0)
    pages_bsdf.inputs["Roughness"].default_value = 0.85

    bpy.ops.mesh.primitive_cube_add(size=1.0)
    cover = bpy.context.active_object
    cover.name = "book.cover"
    cover.scale = (0.16, 0.115, 0.032)
    cover.location = (0.0, -0.205, centre_z)
    cover.rotation_euler = (math.radians(-18), 0.0, 0.0)
    cover.data.materials.append(leather)

    bpy.ops.mesh.primitive_cube_add(size=1.0)
    block = bpy.context.active_object
    block.name = "book.pages"
    # the page block stands proud of the boards at the fore-edge, or it is
    # sealed inside the cover and never renders
    block.scale = (0.148, 0.121, 0.026)
    block.location = (0.004, -0.206, centre_z + 0.001)
    block.rotation_euler = (math.radians(-18), 0.0, 0.0)
    block.data.materials.append(pages)


def bind_to_armature(names):
    from mathutils import Matrix

    """Parent the procedurally built garments and props to the rig so they walk
    with the figure. The gown and the prayer book are rigid relative to the
    pelvis and the hands respectively — a lathe skirt given automatic weights
    tears at the knee, while a rigid bind reads as stiff cloth, which at a
    walking pace and this distance is the better trade."""
    armature = _find_armature()
    if armature is None:
        return
    bone_for = {
        "gown.skirt": "pelvis",
        "gown.bodice": "spine_02",
        "vestment.collar": "spine_03",
        "vestment.stole": "spine_03",
        "cross": "spine_03",
        "book": "spine_02",
    }
    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            continue
        match = next((prefix for prefix in bone_for if obj.name.startswith(prefix)), None)
        if match is None or obj.name not in names:
            continue
        bone_name = bone_for[match]
        if bone_name not in armature.pose.bones:
            continue
        obj.parent = armature
        obj.parent_type = "BONE"
        obj.parent_bone = bone_name
        # parent_set to a bone puts the child at the bone's TAIL, so the
        # inverse has to be captured explicitly or the gown jumps to the hips
        obj.matrix_parent_inverse = (
            armature.matrix_world @ armature.pose.bones[bone_name].matrix @ Matrix.Translation((0, armature.pose.bones[bone_name].length, 0))
        ).inverted()


def bake_walk_clip(frames=32, stride_degrees=26, arm_degrees=17):
    """A plain walk cycle authored on the rig: thighs and upper arms swing in
    opposite phase, calves fold on the back swing, and the pelvis bobs twice per
    cycle. Two keys per extreme with Blender's bezier interpolation is enough —
    at the distance the processional plays, the read is the swing, not the
    footfall."""
    from mathutils import Matrix, Vector

    armature = _find_armature()
    if armature is None:
        return
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frames
    rest = {bone.name: bone.matrix_basis.copy() for bone in armature.pose.bones}

    def swing(bone_name, degrees):
        pose_bone = armature.pose.bones.get(bone_name)
        if pose_bone is None:
            return
        pivot = pose_bone.matrix.translation.copy()
        axis = (armature.matrix_world.inverted().to_3x3() @ Vector((1, 0, 0))).normalized()
        pose_bone.matrix = (
            Matrix.Translation(pivot)
            @ Matrix.Rotation(math.radians(degrees), 4, axis)
            @ Matrix.Translation(-pivot)
        ) @ pose_bone.matrix

    for frame in range(1, frames + 1):
        scene.frame_set(frame)
        phase = 2 * math.pi * (frame - 1) / frames
        for bone in armature.pose.bones:
            bone.matrix_basis = rest[bone.name].copy()
        bpy.context.view_layer.update()

        swing("thigh_l", stride_degrees * math.sin(phase))
        swing("thigh_r", stride_degrees * math.sin(phase + math.pi))
        swing("calf_l", -max(0.0, -math.sin(phase)) * stride_degrees * 1.5)
        swing("calf_r", -max(0.0, -math.sin(phase + math.pi)) * stride_degrees * 1.5)
        swing("upperarm_l", arm_degrees * math.sin(phase + math.pi))
        swing("upperarm_r", arm_degrees * math.sin(phase))

        pelvis = armature.pose.bones.get("pelvis")
        if pelvis is not None:
            bob = 0.012 * math.cos(2 * phase)
            local = (armature.matrix_world.inverted().to_3x3() @ Vector((0, 0, bob)))
            pelvis.matrix = Matrix.Translation(local) @ pelvis.matrix

        for bone in armature.pose.bones:
            bone.keyframe_insert(data_path="location", frame=frame)
            bone.rotation_mode = bone.rotation_mode
            bone.keyframe_insert(
                data_path="rotation_quaternion" if bone.rotation_mode == "QUATERNION" else "rotation_euler",
                frame=frame,
            )
    if armature.animation_data and armature.animation_data.action:
        armature.animation_data.action.name = "walk"
    bpy.ops.object.mode_set(mode="OBJECT")
    scene.frame_set(1)


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
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        # export_apply bakes modifiers, which DESTROYS an armature deform:
        # the walking figures would export as a static T-pose mesh with an
        # unused skeleton. Off whenever a rig is going along.
        export_apply=not any(o.type == "ARMATURE" for o in bpy.data.objects),
        export_animations=True,
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

    # 900 W blew every surface past 1.0 radiance, and AgX desaturates blown
    # highlights toward white: a dark brown stole rendered pale sand and the
    # gown rendered flat white, so two rounds of colour work were judged on an
    # over-exposed frame. These levels keep a white gown just under clipping.
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 240
    key.size = 2.5
    key.color = (1.0, 0.94, 0.85)
    key_obj = bpy.data.objects.new("key", key)
    key_obj.location = (1.6, -2.2, height + 0.4)
    key_obj.rotation_euler = (math.radians(55), 0.0, math.radians(35))
    bpy.context.collection.objects.link(key_obj)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 85
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
elif MODE == "handprobe":
    # One build answers which bone-local axis curls a finger: left hand about
    # local X, right hand about local Z, both hard over. Guessing the axis cost
    # a full rebuild once already.
    pose_altar_ik()
    armature = _find_armature()
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")
    for pose_bone in armature.pose.bones:
        name = pose_bone.name
        if not any(name.startswith(f"{f}_0") for f in ("index", "middle", "ring", "pinky", "thumb")):
            continue
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler.z = math.radians(55 if name.endswith("_l") else -55)
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")
    freeze()
    body = _body_object()
    frame_full_body(body)
    camera = bpy.context.scene.camera
    body_height = visible_top(body)
    clasp = RECIPES[FIGURE].get("clasp_height", 0.62)
    camera.location = (0.0, -0.95, body_height * clasp)
    camera.rotation_euler = (math.radians(90), 0.0, 0.0)
    camera.data.lens = 110
    render(OUT, samples=48, x=700, y=700)
elif MODE == "posecheck":
    # the gownless build: when arms disappear, this frame says whether the pose
    # buried them or the gown swallowed them
    pose_altar_ik()
    curl_fingers()
    freeze()
    body = _body_object()
    frame_full_body(body)
    render(OUT, samples=48, x=560, y=1000)
elif MODE == "walk":
    # The SAME figure as `full`, but rigged and carrying a walk clip, so the
    # processional keeps the couple's own face, hair and gown instead of
    # reverting to the stylized rigs halfway up the aisle.
    pose_altar_ik()
    curl_fingers()
    freeze(keep_armature=True)
    body = _body_object()
    built = set()
    before = {o.name for o in bpy.data.objects}
    if RECIPES[FIGURE].get("gown"):
        build_gown(body)
    if RECIPES[FIGURE].get("vestments"):
        build_vestments(body)
    if RECIPES[FIGURE].get("prayer_book"):
        build_prayer_book(body)
    built = {o.name for o in bpy.data.objects} - before
    bind_to_armature(built)
    bake_walk_clip()
    canonicalize_materials()
    frame_full_body(body)
    render(OUT + ".check.png", samples=48, x=560, y=1000)
    export_glb(OUT, cap=RECIPES[FIGURE].get("texture_cap", 1024))
elif MODE == "full":
    if RECIPES[FIGURE].get("seated"):
        pose_seated()
    else:
        pose_altar_ik()
        curl_fingers()
    freeze()
    body = _body_object()
    if RECIPES[FIGURE].get("gown"):
        build_gown(body)
    if RECIPES[FIGURE].get("vestments"):
        build_vestments(body)
    if RECIPES[FIGURE].get("prayer_book"):
        build_prayer_book(body)
    canonicalize_materials()
    frame_full_body(body)
    render(OUT + ".check.png", samples=64, x=560, y=1000)
    # second angle: the owner judges the gown from the side-rear quarter, so
    # the check must too — a skirt can pass head-on and still be a cone in profile
    camera = bpy.context.scene.camera
    body_height = visible_top(body)
    # REAR quarter, tilted down like the app camera: the seat and the back
    # profile are only visible from behind, and a front-quarter check passed a
    # gown the owner then photographed from behind with a visible seat.
    camera.location = (2.3, 2.0, body_height * 0.78)
    camera.rotation_euler = (math.radians(79), 0.0, math.radians(131))
    render(OUT + ".side.png", samples=64, x=560, y=1000)
    # hands close-up: fingers are 2 cm of geometry that the full-body frame
    # cannot resolve, and the owner reads them at conversational distance
    clasp = RECIPES[FIGURE].get("clasp_height", 0.62)
    camera.location = (0.0, -0.95, body_height * clasp)
    camera.rotation_euler = (math.radians(90), 0.0, 0.0)
    camera.data.lens = 110
    render(OUT + ".hands.png", samples=64, x=700, y=700)
    if RECIPES[FIGURE].get("vestments"):
        camera.location = (0.0, -0.8, body_height * 0.86)
        camera.rotation_euler = (math.radians(88), 0.0, 0.0)
        camera.data.lens = 95
        render(OUT + ".collar.png", samples=64, x=700, y=700)
    export_glb(OUT, cap=RECIPES[FIGURE].get("texture_cap", 1024))
else:
    raise SystemExit(f"unknown mode {MODE}")
