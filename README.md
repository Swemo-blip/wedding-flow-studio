# Wedding Flow Studio

Wedding Flow Studio is a premium visual wedding-day production studio. It turns the ceremony, reception, seating, speeches, music cues, vendor roles, and run of show into one connected digital twin of the wedding day.

Core product promise:

> Don't just plan your wedding. Preview the day before it unfolds.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Three.js via React Three Fiber for the multi-stage 3D Wedding Planning Studio, with @react-three/drei (contact shadows) and @react-three/postprocessing (bloom, vignette) for the cinematic evening look
- Tailwind CSS foundation with custom premium design tokens
- Local mock data for the MVP
- No backend, authentication, paid APIs, or music streaming in this first pass

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Main Modules

- Guided Studio Canvas on the home route with step-based planning, one centered 3D planning experience, quick controls, plan health, and one recommended next decision
- Wedding Planning Studio with responsive 3D scenes for church, garden, beach, and hall settings, plus guest-count controls, accessibility seats, style/decor/color direction, capacity modeling, optional zone editing, local layout persistence, and a concise AI assistant foundation
- Generated Project Integration that maps the saved intake project into the home Studio Canvas, updates guest count, venue type, style, color direction, and decor level, and provides a local start-over path for testing
- Route-aware studio shell with persistent navigation, mobile section switching, and a compact current-layer ribbon across the app
- Connected Planning Toolkit linking guest intelligence, floor plan editing, vendor fit, and export settings without turning the studio into a generic dashboard
- Focused command surfaces across Reception, Vendor Sourcing, Music, Speeches, Director, and Exports so each module presents one active decision before deeper detail
- Wedding Producer Intake 1.1 with a five-question first-use wizard, generated digital twin preview, local project creation, and save-to-preview/save-to-flow actions
- Studio Workspace on `/studio` with preview scene, readiness, role handoff, moment rail, and one unified next action
- Studio Guide 1.0 with plain-English guidance, one best next move, confidence scoring, and a guided Preview-to-Brief path
- Production Brain 1.0 with Wedding Graph context, impact preview, affected roles, affected briefs, dependency path, and rehearsal gate logic
- Rehearsal Simulator 1.0 with scenario presets, delay propagation, day-feel scoring, role load, cue confidence, guest journey impact, brief impact, and recovery planning
- Recovery Orchestrator 1.0 with one-click recovery updates, role dispatch, brief deltas, patch previews, and a local decision log
- Vendor Intelligence 1.0 with location-aware sourcing, saved candidates, readiness scoring, quote progress, and one best next vendor decision
- Editable Visual Day Flow with local browser persistence
- Day Flow Intelligence Mode with moment readiness badges, a focused fix queue, and selected-moment intelligence
- Editable Music Cue Studio with local browser persistence
- Editable Speech Studio and Secret Layers with local browser persistence
- Editable Reception & Guest Journey Studio with local browser persistence
- Preview Wedding Day Command Center with phase intelligence, one recommended next move, scene context, role handoff, and connected risk resolution
- Moment Intelligence Layer for readiness scoring, missing signals, affected roles, affected briefs, guest journey impact, rehearsal notes, and decision queues
- Unified Action Engine for shared best-next-move actions that can update timeline, music, guest, speech, and risk state from one focused control
- Resolve Mode for turning preview risks into focused Day Flow actions
- Guided Studio Workflow
- Ceremony Layout
- Reception & Guest Journey Studio
- Speech Studio and Secret Layers
- Music Cue Studio
- Director Mode 2.0 live role production board with role deep links from Preview
- Export previews
- Copyable role and export briefs
- Focused Brief Builder for one export at a time

## Current MVP Limitations

- Uses one coherent sample wedding project for Emma & James.
- Wedding Producer Intake can generate and save a local first-pass wedding project in the browser.
- Day Flow, Music Cue, Speech, Guest, and Reception edits autosave locally in the browser for MVP testing.
- Resolve Mode stores local risk resolutions in the browser.
- Recovery Orchestrator stores applied recovery decisions locally in the browser.
- Vendor Intelligence stores local shortlist candidates and decision status, but does not yet verify vendor profiles, quotes, availability, contracts, or bookings.
- Export previews can be copied as focused text briefs; generated PDF files are still future work.
- Ceremony and reception planning includes multi-stage 3D studio previews, selectable zones, optional direct drag, nudge-based zone placement, and interactive-looking HTML/CSS planning tools; it is not yet a full drag-and-drop venue editor.
- Director Mode simulates role-specific views without real permissions.
- Music cues store metadata only and do not stream or embed music.

## Roadmap

- Supabase/Postgres persistence
- Authentication and real role-based permissions
- Multi-user collaboration
- Venue templates and planner portals
- Verified vendor sourcing, preferred vendor directories, quote tracking, and availability checks
- Real PDF generation
- Drag-and-drop seating and room setup
- Animated day simulation
- AI Wedding Producer
- Guest portal and QR table finder
- Mobile day-of mode
- Afterglow archive for memories, speeches, vows, songs, and guest notes
