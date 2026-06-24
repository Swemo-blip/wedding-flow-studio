# Style references — add your photoreal / AI-generated images

The Ceremony studio shows a "Style references" gallery. There are two ways to add
images; both are local-only (no backend).

## Easiest: upload in the app
Each tile has an **Upload** button. Click it, pick your image, and it's saved in
your browser (localStorage) and shown immediately — nothing to commit. "Replace"
swaps it, the "×" removes it. Uploads live per-browser on this device.

## Or: commit files here (shared with everyone who runs the app)
Each tile falls back to a gradient placeholder until a real image exists at the
matching path below — then it appears automatically, no code change needed.

Generate photoreal / AI images (e.g. Midjourney, DALL·E, Sora-image) from your
reference look and save them here with these exact names (JPG or swap the
extension in `components/wedding/style-references.tsx`):

- `ceremony-floral-arch.jpg` — the white floral arch / altar florals
- `ceremony-candlelit-aisle.jpg` — the candlelit aisle down to the altar
- `ceremony-stained-glass.jpg` — stained-glass windows + light
- `ceremony-palette.jpg` — palette, linens, table/altar details

Tips: landscape ~4:3, ≥1000px wide, keep each file well under ~1 MB (export at
~80% quality) so the page stays fast. To add more tiles or change names, edit
`CEREMONY_REFERENCES` in `components/wedding/style-references.tsx`.
