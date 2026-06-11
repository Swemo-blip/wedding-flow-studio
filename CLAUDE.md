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

- All product UI, documentation, comments, mock data, accessibility labels, and route copy must be in English.
- Keep the app a premium visual wedding-day production studio, not a checklist app, marketplace, registry, or generic dashboard.
- Do not add backend, authentication, payments, paid APIs, real music streaming, or database work unless explicitly requested.
- Do not scatter mock data across components.
- Do not add more cards, badges, buttons, or explanatory text when the page already feels busy.
- Prefer one clear focal surface, one primary action, and secondary details in drawers.

## Current Design Direction

The app is moving toward a cleaner “studio workbench” style:

- Sharper corners, fewer pill-shaped badges.
- Calm ivory, stone, sage, champagne, and charcoal palette.
- Large visual scene first, supporting controls second.
- Fewer competing CTAs.
- Route frames and scene surfaces should feel consistent across modules.

## Best Next Work

1. Continue visual QA route by route.
2. Simplify any first viewport that still feels text-heavy.
3. Keep expanding useful 3D planning interactions without turning the app into a scattered control panel.
4. Improve mobile order and density so the scene appears early.
5. Prepare a clean commit only after lint, typecheck, build, and browser QA pass.

## Verification

Run relevant checks before reporting:

```bash
npm run lint
npm run typecheck
npm run build
```

Run the language scan documented in `AGENTS.md` and keep any hits intentional.
