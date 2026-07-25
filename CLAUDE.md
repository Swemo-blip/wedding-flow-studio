# Claude Handoff Guide

## Project

Wedding Flow Studio is a premium visual wedding-day production studio. The product should feel like a calm, elegant, operational planning studio where users can preview the wedding day before it unfolds.

Core promise: **Don't just plan your wedding. Preview the day before it unfolds.**

## First Step

Before editing, confirm the working directory:

```bash
pwd
git status --short
```

The expected project path is:

```text
/Users/johanlarsson/Documents/WEDDING
```

Then read:

- `AGENTS.md`
- `README.md`
- `docs/skills/wedding-studio-ux.md`

## Stack

- Next.js App Router
- React
- TypeScript
- Three.js through React Three Fiber
- Tailwind CSS foundation plus custom CSS in `app/globals.css`
- Local mock data and localStorage persistence

## Non-Negotiables

- The product is bilingual: English is the default and Swedish is available via the header EN/SV toggle. Write all source strings, docs, comments, and mock data in English; add Swedish only as translations in `lib/i18n.tsx` (`useTranslation`/`t()`), where missing keys fall back to English.
- Keep the app a premium visual wedding-day production studio, not a checklist app, marketplace, registry, or generic dashboard.
- A **free, no-card backend is now allowed** (decided 2026-06-27): Supabase (auth + Postgres + realtime + storage) powers accounts, cloud sync, and sharing. It must stay on the free tier — **no payments, no paid APIs, no card-on-file** (the original "no paid services" rule still holds). localStorage stays as the offline cache + the fallback when Supabase isn't configured, so the app always runs with zero setup. Still no real music streaming.
- Do not scatter mock data across components.
- Do not add more cards, badges, buttons, or explanatory text when the page already feels busy.
- Prefer one clear focal surface, one primary action, and secondary details in drawers.

## Current Design Direction

The palette is **LOCKED** (chosen from the couple's own reference dashboard): warm
cream canvas, deep forest-green as the single primary accent, gold as a small
metallic detail only. Lavender/peach and plum were tried and rejected — do not
reintroduce them. The tokens in `app/globals.css` `:root` are the source of truth.

- Canvas and surfaces: warm cream `--background` / `--canvas` `#f4efe3`, white
  cards `--surface`, warm off-white `--surface-soft` `#fbf8f1`; ink text `--ink`
  `#2b2d24`; warm hairlines `--line` `rgba(120, 106, 74, 0.16)`; soft warm shadows.
- Primary accent is forest green `--accent` `#414c37`: primary buttons are a solid
  green fill with cream text (`.button-primary`), plus active nav and focus rings.
  Secondary buttons are quiet outlines on near-white. Gold `--gilt` `#b39152` is a
  restrained metallic detail (monogram, small accents) — **not** a button fill.
- Typography: **Fraunces** (`--font-display` → `--font-serif`, via `next/font`)
  only for couple names and one display headline per surface; **Inter**
  (`--font-body` → `--font-sans`) for everything else. Eyebrow labels are rare,
  small, tracked, muted — no decorative rules or gold dashes on labels.
- Shell: sidebar with the gold WF serif monogram and a grouped lucide icon nav
  (Plan / Details / Output — see `components/app-shell/navigation.tsx`, the single
  source of truth for routes); a light header with couple names, saved status,
  Share Studio, and the Preview Day CTA.
- The home route (`/`) is a focused **3D studio workspace**: an Edit/Preview
  switch, a tool rail, an inspector, and one playback bar — not a dashboard of
  glance cards. See `components/overview/overview-dashboard.tsx`.
- Text restraint: no paragraph under a headline if one line works; command-surface
  descriptions clamp to one line; avoid stat strips and repeated meta. The
  couple's names, date, venue, and guest count are the emotional anchor — ops
  language stays out of first viewports.
- One-surface principle: prefer zones within one framed surface over new cards.
  One primary CTA per surface.
- Everything shown must be **real**: no sample data presented as the couple's, no
  dead controls, no invented percentages. A control that cannot do anything yet
  must not ship — this is what previously made the product feel fake.
- The 3D renders exactly **two scenes**: the warm church ceremony and the indoor
  candlelit dinner hall (`components/wedding-studio/church-scene.tsx`).
  `venueOptions` offers only Church and `getVenueTypeFromWedding` always returns
  `"church"`, so the `garden`/`beach` branches in the scene are unreachable legacy
  paths — do not build on them, and do not re-expose outdoor venues.
  Camera motion is a locked-axis dolly (wedding-videography grammar); the old
  sin/cos hover that read as a drone was deliberately removed — don't bring it back.
- Exports remain paper-like sheets (light background, dark ink); print styles force
  dark text on white.

## Best Next Work

1. The remaining 3D jump is the Blender baked-GI venue shell — spec'd in
   `docs/blender-baked-venue.md`. This is skilled manual 3D work (Johan or an
   artist), not an agent task; the agent's job is the wire-in and the fallback.
2. Cheaper 3D wins that come first: stained-glass light shafts, and the figure
   silhouette (a rigged CC0 character swap — taste-sensitive, show a still first).
3. Cloud sync / share link / RSVP / collaboration still need the Supabase backend
   wired (allowed, free tier). Keep localStorage as the offline fallback so the app
   always runs with zero setup.
4. QA less-visited surfaces (drawers, dialogs, deep states) at mobile widths.
5. Prepare a clean commit only after lint, typecheck, build, and browser QA pass.

## Verification Traps (learned the hard way)

- **The 3D HD/postprocessing path renders blank in the agent's preview sandbox.**
  Never ship a change to the 3D *look* that could not be verified — verify it on
  the live deploy instead, or don't make it. Reverting an unverifiable 3D change is
  the correct call.
- **`wedding-flow-studio.layout.v1` is shared** by the home studio and
  `/ceremony`. Always persist the *live hydrated* `sceneEdits`, and never
  re-derive style fields from `wedding.style` once a layout is saved — both
  mistakes silently wiped the couple's edits before.
- `rg` is not always on PATH here; a scan written as `rg … || echo CLEAN` will
  report a false pass. Use `grep -rn '[åäöÅÄÖ]'` and check the real output.

## Verification

Run relevant checks before reporting:

```bash
npm run lint
npm run typecheck
npm run build
```

Run the language scan documented in `AGENTS.md` and keep any hits intentional.
