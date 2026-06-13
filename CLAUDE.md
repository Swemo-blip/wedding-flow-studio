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
- Do not add backend, authentication, payments, paid APIs, real music streaming, or database work unless explicitly requested.
- Do not scatter mock data across components.
- Do not add more cards, badges, buttons, or explanatory text when the page already feels busy.
- Prefer one clear focal surface, one primary action, and secondary details in drawers.

## Current Design Direction

The app uses a "light gallery, dark jewel" design language: airy warm-light chrome with a small number of deep evening-green jewel surfaces. Keep that contrast rhythm.

- Chrome and working surfaces: warm light gallery (`#fffdf8`-`#f2ebdb` family), ink text `#211d14`, bronze hairlines (`rgba(146, 118, 73, …)`), very soft warm shadows.
- Jewel surfaces stay dark evening-green: the icon sidebar, the 3D canvas, and the Preview cinema stage. Primary buttons are champagne-gold gradients with dark text; secondary buttons are quiet outlines.
- The shell follows the reference dashboard: gold WF serif monogram + lucide icon nav + "Digital Twin Active" callout + planner chip in the sidebar; a light header with couple names, saved status, Share Studio, and gold Preview Day; a tab bar for planning sections.
- The home route is an Overview dashboard: large 3D venue hero with scene dropdown, 2D/3D toggle, fullscreen, zoom, and an "Edit in 3D Studio" drawer; four glance cards (timeline, guest donut, seating dots, style tiles); a right rail with wedding facts, plan-readiness donut, and cue-sheet meter.
- Typography discipline: Cormorant Garamond (`--font-serif`, via `next/font`) only for couple names and one display headline per surface; Inter (`--font-sans`) for everything else. Eyebrow labels are rare, small, tracked, muted — no decorative rules or gold dashes on labels.
- Text restraint: no paragraph under a headline if one line works; command-surface descriptions clamp to one line; avoid stat strips and repeated meta. The couple's names, date, venue, and guest count are the emotional anchor — ops language stays out of first viewports.
- One-surface principle: the home route is a single framed atelier panel (dark hero band, light control/stage/next-move zones split by hairlines). Prefer zones within one surface over new cards. One primary CTA per surface ("Preview the day" on home).
- The 3D studio scene is an evening/golden-hour mood: dark venue palettes, glow halo, lantern poles with catenary string lights, candle stands, flower arch on a dais, drifting gold dust motes, slow camera drift in 3D view.
- Exports remain paper-like sheets (light background, dark ink); print styles force dark text on white.

## Best Next Work

1. Continue dark-theme QA on less-visited surfaces (drawers, dialogs, deep states) and fix any remaining light-on-light leaks.
2. Verify 3D scene performance on real mobile hardware; reduce dust motes or string-light bulbs if needed.
3. Keep expanding useful 3D planning interactions without turning the app into a scattered control panel.
4. Lift the `/studio` workspace and remaining modules to the same compositional level as the home atelier.
5. Prepare a clean commit only after lint, typecheck, build, and browser QA pass.

## Verification

Run relevant checks before reporting:

```bash
npm run lint
npm run typecheck
npm run build
```

Run the language scan documented in `AGENTS.md` and keep any hits intentional.
