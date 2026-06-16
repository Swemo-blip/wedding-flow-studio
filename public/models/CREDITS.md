# 3D model credits

All models below are licensed **CC0 1.0** (public domain) via [Poly Pizza](https://poly.pizza).
The seated congregation meshes are baked (sitting pose, merged to a single
vertex-colored static mesh) from these source characters for instancing:

| File | Source character | Author | License |
| --- | --- | --- | --- |
| `man_seated.glb` | "Man" (animated) | Quaternius | CC0 1.0 |
| `woman_seated.glb` | "Woman" (animated) | Quaternius | CC0 1.0 |
| `woman_dress_seated.glb` | "Woman in Dress" (animated) | Quaternius | CC0 1.0 |

Bake step: load the animated source, sample the `Sitting` clip, skin-transform
the vertices into a static pose, merge primitives to one geometry, carry each
material's base color as a per-vertex `COLOR_0` attribute. No textures, no rig,
no animation — so the whole congregation renders as a few instanced draw calls.

## Ceremony figures (animated)

Used for the priest, the processional bride + groom, and the optional singer.
Cloned per role (SkeletonUtils), recolored by material name (suit, white dress,
dark vestments), and driven by their own `Walk` / `Idle` clips.

| File | Source character | Author | License |
| --- | --- | --- | --- |
| `figure_man.glb` | "Man" (animated) | Quaternius | CC0 1.0 |
| `figure_woman.glb` | "Woman in Dress" (animated) | Quaternius | CC0 1.0 |

## Dais props

Loaded as-is and size-normalized at runtime; used at the ceremony focal point.

| File | Source model | Author | License |
| --- | --- | --- | --- |
| `altar_vase.glb` | "Chalice" | Quaternius | CC0 1.0 |
| `altar_candlestick.glb` | "Candlestick" | CreativeTrio | CC0 1.0 |

The altar flower arrangement is the real `altar_vase.glb` holding the in-engine
ivory bloom cluster (the bare CC0 flower meshes read as loose stems, so the
vase + stylized blooms gives a cleaner wedding arrangement).
