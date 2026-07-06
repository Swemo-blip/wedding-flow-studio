# Texture credits

All CC0 (public domain) scanned PBR sets from Poly Haven (https://polyhaven.com),
downscaled to 1k JPG (diffuse + normal-GL + roughness):

- `wall_*` — "Plastered Stone Wall" (https://polyhaven.com/a/plastered_stone_wall) — church nave walls.
- `floor_*` — "Marble 01" (https://polyhaven.com/a/marble_01) — polished nave floor.
- `pew_*` — "Oak Veneer 01" (https://polyhaven.com/a/oak_veneer_01) — pews.

Loaded in `components/wedding-studio/church-scene.tsx` via drei `useTexture`
(`useSurfaceMaps`), preloaded so the scene-boot gate waits for them.
