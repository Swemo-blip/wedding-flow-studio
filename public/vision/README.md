# Vision renders — the photoreal hero of each studio

The Ceremony and Reception studios open on a **"Vision"** tab: a full-bleed,
photorealistic render of the room. This is the sellable "wow" — the realistic
look real-time 3D can't reach. There are two ways to set it; both are local-only
(no backend).

## Easiest: upload in the app
On the Vision tab, click **Upload vision**, pick your render, and it's saved in
your browser (localStorage) and shown immediately. "Replace vision" swaps it, the
"×" removes it. Uploads live per-browser on this device.

## Or: commit a file here (shared with everyone who runs the app)
Drop a JPG at the matching path and it appears automatically, no code change:

- `ceremony.jpg` — the photoreal ceremony render
- `reception.jpg` — the photoreal reception render

Generate these from your style references (e.g. Midjourney / DALL·E / Sora-image)
using the prompts in `public/style-references/README.md`. Landscape ~3:2, ≥1400px
wide, exported under ~1 MB. Until a file or upload exists, the tab shows an
elegant placeholder prompting you to add one.
