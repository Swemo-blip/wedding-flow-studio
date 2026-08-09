# HDRI credits

- `church_museum_2k.hdr` — "Church Museum" by Dario Barresi / Poly Haven.
  License: CC0 (public domain). Source: https://polyhaven.com/a/church_museum
  Lights the church venue: a real sunlit church interior with stained glass,
  so reflections and ambient color match the room the viewer stands in.
- `lythwood_room_1k.hdr` — "Lythwood Room" by Greg Zaal / Poly Haven.
  License: CC0 (public domain). Source: https://polyhaven.com/a/lythwood_room
  Lights the open venues (garden/beach/hall) with a warm interior probe.

Used for image-based lighting in the 3D ceremony scene
(`components/wedding-studio/church-scene.tsx`, `HdrEnvironment`), loaded and
cached through `components/wedding-studio/scene-boot.tsx`.

## church-room.hdr, hall-room.hdr

Rendered in-project by scripts/bake-room-hdri.py: an equirectangular Cycles panorama
shot from 1.62 m eye height inside the SAME Blender room the baked shell is made of,
so the dynamic layer reflects its own venue. No external assets. CC0.
