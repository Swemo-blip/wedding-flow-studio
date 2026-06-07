# Wedding Flow Studio Agent Guide

## Project Overview

Wedding Flow Studio is a premium visual wedding-day production studio. It helps couples, planners, venues, toastmasters, photographers, DJs, caterers, officiants, and other collaborators preview and coordinate the full wedding day before it unfolds.

The product category is **Wedding Day Digital Twin**. It is not a checklist app, marketplace, registry, generic SaaS dashboard, or simple seating chart.

Core promise: **Don't just plan your wedding. Preview the day before it unfolds.**

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Three.js through React Three Fiber for the multi-stage 3D Wedding Planning Studio
- Tailwind CSS foundation with custom CSS design tokens in `app/globals.css`
- Local mock data and browser localStorage persistence for MVP state
- No backend, real authentication, paid APIs, payment integration, or music streaming in the current MVP

## Language Requirement

All product UI, mock data, route labels, documentation, comments, component names, accessibility labels, export previews, warnings, and user-facing text must be written in English.

Do not introduce Swedish copy into the product, code comments, docs, routes, mock data, accessibility text, or UI.

## Important Folders And Files

- `app/` - Next.js App Router pages, layout, and global styles.
- `app/page.tsx` - Focused Studio Canvas home route.
- `app/vendors/page.tsx` - Production Sourcing and Vendor Intelligence route.
- `app/globals.css` - Main visual system, responsive rules, print styles, and component styling.
- `components/app-shell/` - Persistent shell, navigation, and top bar.
- `components/studio/studio-workspace.tsx` - Unified studio cockpit used by the `/studio` route.
- `components/wedding-studio/` - 3D Wedding Planning Studio, controls, capacity summary, and stage-aware scene components.
- `components/vendors/vendor-sourcing-studio.tsx` - Vendor sourcing, shortlist, readiness, and candidate decision UI.
- `components/preview/` - Preview Wedding Day experience.
- `components/day-flow/` - Editable timeline and Day Flow repair surface.
- `components/director/` - Role-specific production boards.
- `components/exports/` - Export preview and copyable brief surfaces.
- `components/ui/` - Reusable UI primitives.
- `lib/wedding-types.ts` - Central domain model.
- `lib/wedding-studio-plan.ts` - Deterministic 3D studio plan, planning steps, and chapel capacity logic.
- `lib/wedding-data.ts` - Central sample wedding data.
- `lib/local-project-store.ts` - Browser persistence helpers.
- `lib/use-local-project.ts` - Local wedding project state hook.
- `lib/risk-analysis.ts` - Rule-based flow analysis.
- `lib/moment-intelligence.ts` - Moment readiness and decision logic.
- `lib/vendor-sourcing.ts` - Sourcing categories and location-aware search links.
- `lib/vendor-intelligence.ts` - Vendor candidate scoring, readiness, and next-decision logic.
- `docs/skills/wedding-studio-ux.md` - Project UX skill guide for premium first-viewport and screenshot review discipline.
- `README.md` - User-facing project overview and run instructions.

## Commands

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

Lint:

```bash
npm run lint
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Start a production build:

```bash
npm run start
```

There is no dedicated test script yet. When adding tests, update `package.json`, this file, and `README.md`.

## Verification Requirements

Before a final report, run the relevant checks for the change:

- Always run `npm run lint` and `npm run typecheck` for TypeScript, React, or styling work.
- Run `npm run build` for route changes, App Router changes, data model changes, or anything that may affect production rendering.
- For frontend changes, open the affected route in the browser and check visible behavior, responsive layout when relevant, and console errors.
- For product copy or documentation changes, run a search for Swedish characters and forbidden Swedish terms:

```bash
rg -n "\\x{00E5}|\\x{00E4}|\\x{00F6}|\\x{00C5}|\\x{00C4}|\\x{00D6}|Swedish" app components lib README.md AGENTS.md package.json
```

Report any verification that could not be run and explain why.

## Code Standards

- Use TypeScript and keep domain types explicit.
- Prefer centralized domain logic in `lib/` over scattered calculations inside components.
- Keep mock data centralized in `lib/wedding-data.ts`.
- Keep risk analysis centralized in `lib/risk-analysis.ts`.
- Keep vendor sourcing and vendor intelligence logic centralized in `lib/vendor-sourcing.ts` and `lib/vendor-intelligence.ts`.
- Reuse existing UI primitives and local patterns before creating new abstractions.
- Keep components focused, readable, and accessible.
- Use semantic HTML, clear labels, keyboard-friendly controls, and visible focus states.
- Do not introduce fake API keys, real paid APIs, backend requirements, authentication, payment flows, or music streaming unless explicitly requested.
- Do not add dependencies unless they materially improve the MVP and are justified.
- Keep edits scoped to the requested work. Avoid unrelated refactors.
- Preserve existing user or generated changes. Do not revert files unless explicitly asked.

## Design Principles

- Before major UI work, review `docs/skills/wedding-studio-ux.md`.
- The app must feel elegant, warm, calm, editorial, premium, and operationally useful.
- Build a visual studio experience, not a generic SaaS dashboard.
- Favor one guided Studio Workflow over scattered action buttons.
- Each screen should have one clear primary path and only contextual controls where they genuinely help.
- Each first viewport should feel like one composed product surface, not a collection of unrelated cards.
- Keep the first viewport to one primary visual scene, one primary decision/action, and at most three visible supporting panels.
- Avoid “card soup”: do not solve hierarchy problems by adding more cards, badges, metrics, or explanatory boxes.
- Move secondary reasoning, confidence scores, vendor details, graph context, and operational metadata into drawers or details blocks.
- Use visual assets sparingly but meaningfully. A premium image should anchor a scene or venue mood; it must not become decorative clutter.
- If a screenshot looks busy, text-heavy, or visually fragmented, simplify before adding new functionality.
- Use refined wedding production terminology: Ceremony, Reception, Run of Show, Cue Sheet, Director Mode, Secret Layers, Guest Journey, Vendor Brief, Production Sourcing, and Wedding Day Digital Twin.
- Treat the home experience as a focused Studio Canvas: one active 3D stage, one contextual control panel, and one best next decision.
- Treat Preview Wedding Day as the central emotional command center.
- Treat Day Flow as the repair surface for moment risks and readiness issues.
- Treat Director Mode as a live role production board.
- Treat Vendor Intelligence as a decision layer, not a marketplace. It should help users find, shortlist, compare, and track real-world services while staying connected to the wedding digital twin.
- Avoid cheap wedding cliches, cartoon icons, harsh colors, clutter, dense enterprise tables, and scattered button-heavy UI.
- Prefer calm color, clear hierarchy, generous spacing, fine borders, readable typography, and polished responsive behavior.

## What Codex May Change

Codex may change:

- App routes in `app/` that are relevant to the requested feature.
- Components in `components/` that are relevant to the requested feature.
- Domain types, utilities, mock data, and local persistence in `lib/` when needed.
- Styling in `app/globals.css` when needed for layout, responsive behavior, accessibility, or visual quality.
- `README.md` and `AGENTS.md` when project behavior or workflow changes.
- `package.json` only when scripts or dependencies genuinely need to change.

## What Codex Must Not Change Without Explicit Request

Codex must not:

- Add a backend, database, authentication, payments, paid APIs, or real music streaming.
- Convert the product into a marketplace, registry, checklist app, or generic dashboard.
- Replace the stack or restructure the whole app without a clear reason.
- Scatter mock data across components.
- Introduce Swedish text into product UI, code comments, mock data, docs, or accessibility labels.
- Remove existing MVP features while implementing a new one.
- Revert unrelated user changes.
- Use destructive commands such as `git reset --hard` or broad file deletion unless explicitly requested and approved.

## Definition Of Done

### Frontend Changes

- The route or component renders correctly in the browser.
- Layout works on desktop and is usable on smaller screens.
- Text does not overlap, overflow awkwardly, or obscure important controls.
- Controls are keyboard-friendly and have meaningful labels.
- The UI follows the premium studio design language.
- `npm run lint`, `npm run typecheck`, and relevant browser QA have passed.

### Backend Or Persistence Changes

- Domain types are updated in `lib/wedding-types.ts`.
- Persistence changes are handled through existing local project storage patterns unless a backend is explicitly requested.
- New stored data has validation or safe fallback behavior.
- Existing localStorage state remains compatible where practical.
- `npm run typecheck` and `npm run build` pass.

### Design Changes

- The change improves clarity, calmness, hierarchy, and usability.
- The page still feels like a premium wedding-day production studio.
- The design avoids clutter, cheap cliches, harsh colors, and button sprawl.
- The first viewport has a clear focal point and one obvious next action.
- No major text, badges, scene markers, or cards overlap in screenshots.
- A human screenshot review has been performed for affected routes; if the page still looks busy, continue simplifying.
- Responsive behavior is checked.
- Accessibility basics are preserved.

### Documentation Changes

- Documentation is fully in English.
- Commands and module descriptions match the current project.
- Any new scripts, routes, or major features are reflected in `README.md` and this guide when relevant.

## Reporting

Final reports should be concise and include:

- What changed.
- Key files changed.
- Verification commands run.
- Any remaining limitations or follow-up recommendations.

Always preserve the core promise: Wedding Flow Studio lets people see the wedding day before it unfolds.
