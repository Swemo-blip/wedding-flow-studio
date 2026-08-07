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

**WARM PAPER, COLD INK** (2026-08-03). The cream stays — it is the owner's own
choice from his own reference — but the previous "LOCKED" green-and-gold palette
was measured and found to be the mechanism behind his verdict that the app "looks
like a magazine". Three findings drove the change, and re-introducing any of them
undoes it:

1. **The chrome was drawn from the render's material list.** `--gilt` `#b39152`
   was *byte-identical* to the brass in the church scene; `--accent` `#414c37` sat
   3 degrees of hue and 1.2 dE from the pews at `#3c4a33`; `--canvas` was the
   limestone. Pulling the page palette out of the photograph is how a magazine
   spread is built, and it removes the categorical difference that makes a control
   read as a control. **No UI token may match a scene material.**
2. **The card fill was invisible.** `--surface` measured 1.11:1 against `--canvas`,
   so every box was drawn purely by a 1px outline, a 10px gutter and a rounded
   corner — plates separated by gutters. The plane step is now 1.19:1.
3. **`--muted` (3.86:1) and `--subtle` (2.46:1) were below the accessibility floor**
   while carrying 161 colour declarations. Both now resolve to `--ink-faint`.

Current tokens (`app/globals.css` `:root` is the source of truth):

- Page: `--canvas` `#e7e4dd`, `--surface` `#f9f7f3`, `--surface-sunken` `#eeebe4`.
- Ink: `--ink` `#1b1d21`, `--ink-soft` `#4a4d53`, `--ink-faint` `#5d6067`.
- **Accent is a blue-black** `--accent` `#1e2733` — printer's ink is cold, and
  nothing in a church interior is blue-black, so a control can never be mistaken
  for a material. Forest green survives as `--success`; `--gilt` dropped to
  `#6f5e33` so it reads as printed foil rather than lit brass.
- Rules are **solid, never rgba**: `--line` `#dad6cd` separates regions;
  `--line-strong` `#827d71` bounds a **control** and clears 3:1.
- **Cold is for marks, never for paper.** Selected rows stay warm
  (`--accent-soft` `#e4e0d5`); a cool tint under a row reads as the lilac this
  project has rejected twice. "All clear" has its own `--positive-soft`.
- Lavender/peach and plum were tried and rejected — do not reintroduce them.

Never nudge a hex by eye. Text must clear 4.5:1 and **any boundary that
identifies a control must clear 3:1** — the floor all three candidate directions
failed. Re-measure before and after.

**A token change reaches less than you think.** `:root` defines ~57 properties,
but the stylesheet carries 467 more colour literals outside that block. Run
`node scripts/colour-audit.mjs --list` — it groups every one by the role its
property implies. This is why earlier palette changes shipped looking half-done.

`npm run check:colour` (`--check`) is the half of that audit which can FAIL. It
measures only the roles with an unambiguous floor — a colour on a `:focus` rule
(3:1, because a focus ring IS the boundary that identifies a control),
`accent-color`/`caret-color` (3:1), and `color` (4.5:1) — and it fails a value only
when it misses against ALL THREE light page surfaces, so it cannot invent a finding
about a background it cannot see. Light values are **named, not dropped**: 31 of
them sit on the render or on glass and the stylesheet cannot say which, so the
check declines to judge them out loud rather than in silence. Silence is what let a
1.36:1 focus ring live for months. It took three corrections to calibrate — a
background on a focus rule is not a boundary, a light ink is text on something
dark, and the light/dark decision belongs to the COMPONENT (`.scene-boot-monogram`
and `.scene-boot-label` are one dark screen) — all recorded in the script.

What it found on its first real run, all now fixed: every gold focus ring in the
app was under 3:1, the worst at 1.36:1; the `/shared` page — **the only surface a
guest ever opens** — had never received the palette pass and carried its secondary
text as warm ink at 50-60% alpha (3.22:1) with gold times and links at 3.63:1; and
`.digital-twin-node` was a button whose resting boundary measured 1.13:1.

Structure: the studio is **one chassis, not floating plates**. `gap: 0`,
`--radius-panel: 0`, and each cell carries a rule on ONE facing edge so no seam
doubles. The stage bleeds — no frame, no radius, nothing pale touching it, because
a render inside a rounded card on a tinted page *is* a photograph in a layout.
Radii mean something: 0 on chassis panels, `--radius-control` 6px in the flow of a
panel, `--radius-float` 10px only on something absolutely positioned that can be
dismissed. A shadow is permitted **only** on something dismissable.

- Typography: **Cormorant Garamond** (`--font-display` → `--font-serif`, via
  `next/font`) only for couple names, one display headline per surface, and
  printed sheets. **Never below 1.75rem** — it is a narrow Garamond and at 16-24px
  its character is lost to anti-aliasing and reads as a magazine subhead. It was
  on 61 call sites, 45 of them under 24px; one rule sprayed it across 24 selectors
  with no size condition at all. When raising the floor, check the clamp
  **minimum**, not the maximum: on a narrow viewport every clamp collapses to its
  lower bound, and some sizes are set in a media query that never mentions the
  font. Fraunces was used until 2026-08-02 and rejected: it ships a literal "wonk"
  axis and read as playful on a product where couples commit six figures.
- **Labels do not shout.** `.eyebrow` is 0.76rem/500/0.01em sentence case — larger
  type that sets 30-48% narrower in Swedish, because uppercase disables every kern
  pair and this product sets å ä ö constantly. 49 uppercase rules are down to 9;
  capitals survive only on the wordmark, the sidebar group labels and the printed
  sheets. Font sizes follow a 13-step scale (0.6 → 3rem); snap to the nearest step
  rather than adding a size. **Inter** for everything else.
- Shell: sidebar with the WF serif monogram and a grouped lucide icon nav
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
4. QA less-visited surfaces (drawers, dialogs, deep states) at mobile widths. The
   2026-08-03 sweep covered 14 routes at 1400px and the key surfaces at 390px, so
   the deep states and the remaining routes are still unmeasured. Reuse the probe
   pattern (composite backgrounds, real navigation — `history.pushState` does NOT
   drive the Next router and will measure the same page repeatedly).
5. **Guest allergies, accessibility notes and tags are read everywhere and writable
   nowhere** (`components/guests/guests-view.tsx`). This is why `/menu`'s
   allergy-conflict feature is permanently dead — the column shows "—" for every
   guest. Size M, and the highest-value honesty fix left.
6. The scene drag itself: `EditableSceneObject` accepts `onMoveObject` /
   `onSelectObject` / `selectedObjectId` and uses none of them. The lying "or drag
   it in the scene" hint was removed; the capability is still missing.
7. Toastmaster live-run mode — Johan calls this one of his strongest ideas.
   `/director` and `lib/risk-analysis.ts` are already half of it. **Design note
   agreed with him: a struck moment must be marked struck, never deleted** — he has
   to be able to change his mind at 19:00, and the exports must still show the
   planned day.
8. Prepare a clean commit only after lint, typecheck, build, and browser QA pass.

**Decided 2026-08-03 (delegated): the language follows the BROWSER, the currency
stays independent.** A Swedish browser gets a Swedish interface; a stored toggle
choice returns early and beats the locale, so one tap is permanent. Tying language
to currency was rejected — plenty of Swedes plan in English and plenty of English
speakers pay in kronor, so that would be a guess about the person, while a browser
locale is a signal they set on purpose. `lib/i18n.tsx` `LanguageProvider`.

## Verification Traps (learned the hard way)

- **The default church render measures L\* ~73 — it is a BRIGHT daylight interior,
  not a dark candlelit one.** Sampled 2026-08-04 out of the preserved drawing
  buffer: mean RGB [186, 180, 161], darkest 22, brightest 244. The chrome sits at
  L\* 97 (panel) and 92 (desk), so the render-to-chrome gap is about 24 points, not
  the 40-55 an earlier analysis asserted from an assumed candlelit scene. Do not
  reason about this render's luminance from the lighting you imagine; sample it.
- **You cannot get a rendered frame from a tab you opened yourself.** Tested three
  ways: the agent's own preview pane, a tab created via the Chrome extension, and a
  re-navigated existing tab. All report `visibilityState: "hidden"` with 0 frames in
  a second and a canvas stuck at its 300x150 default, because a tab only lays out
  and renders once it has actually been the visible tab. The one real frame this
  session came from a tab the OWNER had been looking at — and because the canvas
  keeps `preserveDrawingBuffer`, that frame stays readable afterwards even when the
  tab goes hidden. So: ask him to visit the view once, then measure the buffer for
  the rest of the session. Do not burn his time trying to force it.
- **The reason is layout, not the frame loop, and that closes the door harder than it
  looks.** Tested six ways on 2026-08-04/06, including a dev-only `RenderBridge` that
  drives frames from `setInterval` instead of rAF specifically to sidestep the hidden-
  tab throttle. It never ran, because R3F's `Canvas` sizes itself through a
  `ResizeObserver` and a background tab is never handed a measurement — so the canvas
  stays at its 300x150 default and the whole scene, bridge included, never mounts. It
  failed even in a tab whose *document* had real layout (`clientWidth` 1470), which is
  what ruled out every simpler explanation. There is no flag, no query parameter and
  no fibre-tree walk that gets around this. One visit from the owner is the only key.
  `components/wedding-studio/render-bridge.tsx` is still worth keeping: once the scene
  HAS mounted it can draw a fresh frame on demand from a hidden tab, so state changed
  after his visit is still measurable instead of leaving only a stale buffer.
- **3D geometry can be verified without any render at all, and should be.** A GLB is a
  JSON chunk plus a binary chunk: the bone hierarchy, the rest transforms and the
  animation samplers are all readable in plain Node, which is enough to rebuild the
  skeleton and evaluate a pose by forward kinematics. `scripts/figure-pose-probe.mjs`
  does exactly that — `npm run check:figures` — and on its first real use it found
  three defects that had shipped and survived every visual pass:
  the officiant's stole sat at z 0.062 while the alb's own lathe profile puts its front
  surface at 0.094-0.116, so the stole and its neck band were *inside the robe* and he
  rendered as a featureless ivory cone; the psalter sat 0.25 units — 40 cm — in front
  of his hands, in mid-air, because the original derivation forgot the interior's
  `+0.25` z offset; and the couple's palms were 0.712 m and 0.737 m apart, the same
  defect that had been diagnosed and fixed for the officiant alone. It cross-checks
  against the live-measured `NECK_Y` to within 0.003. `--check` exits non-zero, and it
  was proven in both directions: it fails when the three defects are put back.
  Solve pose numbers with `--solve <pose> <target gap>`, never by eye, and solve the
  bride on `figure_woman.glb` — the two rigs differ.
- **A blank 3D frame usually means the pane is hidden, not that the render broke.**
  When the preview pane is hidden `document.visibilityState` becomes `"hidden"`,
  which pauses `requestAnimationFrame`, which stops the scene rendering — so
  screenshots and `toDataURL` both return the un-rendered loading state. This has
  now been misdiagnosed three times, twice as a WebGL or postprocessing failure.
  **Check `document.visibilityState` before concluding anything about the render.**
  Also: `toDataURL` on a canvas without `preserveDrawingBuffer` must be read inside
  the same frame as the draw, or it returns a cleared buffer.
- Never ship a change to the 3D *look* that could not be verified — verify it on
  the live deploy instead, or don't make it. Reverting an unverifiable 3D change is
  the correct call, and was taken again on 2026-08-03 for a west-facing arrival shot.
- **Scene units are not metres.** The measured standing figure is 1.10 units for a
  1.75 m person. The west portal is 1.2 x 1.4, i.e. about 2.2 m of real door — so a
  camera at the walkthrough's usual 1.85-1.95 is standing near 2.9 m, *above the
  lintel*. Derive any new figure from the figure height, never from what the real
  object measures. Also: the whole interior sits in `<group position={[0, 0, 0.25]}>`
  but the camera does not, so every `WEST_WALL_Z` / `PROCESSION_*_Z` constant is
  local and world z = local + 0.25.
- **A scene unit is 1.591 m, and `church-scene.tsx` has a comment claiming 0.63.** That
  note (near `PROCESSION_DURATION`) is the INVERSE of the truth and is the root cause of
  a whole family of shipped bugs: anyone reasoning from it wrote a metre value into a
  unit field. It produced a first-person camera at 2.39 m eye height, 0.64 m above the
  crown of the bride it was supposed to be, and a couple photo disc floating clear of
  their hair. The note is kept in place with a correction beside it precisely so the next
  reader sees the trap rather than the claim. `npm run check:figures` now asserts that
  any constant placing something at a figure stays below that figure's crown.
- **The 2026-08-06 scene audit is in `docs/scene-geometry-audit-2026-08-06.md`** — 43
  measured findings that survived an adversarial pass, ranked, with five fixed. Read its
  warning first: the defects are usually real but **the magnitudes and the stated causes
  often are not**. Two claims blamed a bounding box "half empty air"; the GLBs measure
  100% visible mesh. The candle flame floats 0.22 m, not the claimed 0.70. The biggest
  single group — thirteen findings saying the seat surface sits 12-16 cm too high — is
  **wrong in kind, and must not be acted on**; see the next entry.
- **Do not "lower the seat by 12-16 cm".** Measured 2026-08-06 with
  `scripts/seat-contact-probe.mjs` (`npm run check:seats`). Those numbers came from a
  `min()` over the seated model's rear, which returns whatever narrow thing hangs lowest:
  on `cg_man_0` that is y 0.1941, a feature 11 vertices wide, while his lowest hip-wide
  slice is 0.274 and the pew cushion tops out at 0.2775 — within 3.5 mm of it. Neither
  number is trustworthy anyway: these meshes are coarse enough that occupancy is 1-2 of 6
  columns in nearly every 5 mm slice, so "where the body rests" has no stable answer, and
  the three variants differ by 6 cm.
  **The defect is real but it is a DEPTH problem.** The definition-free test — count body
  vertices inside the furniture volume — gives 623-889 inside the pew bench, 256-353 in
  the cushion, 198-269 in the chair seat, 60-126 in the chair back. Sweeping the figure up
  bottoms out at 179 and then rises again, because 173 of those verts sit AHEAD of the
  figure's origin: shins and calves, which belong in front of the bench's front face. The
  bench is a solid 0.34-deep, 0.16-thick box centred on the figure's own origin. Fixing it
  means redesigning the bench section and the figure's z, which changes the look and must
  not ship unseen. `check:seats` therefore ratchets rather than asserts: it fails only if
  the intersection gets WORSE.
- **`wedding-flow-studio.layout.v1` is shared** by the home studio and
  `/ceremony`. Always persist the *live hydrated* `sceneEdits`, and never
  re-derive style fields from `wedding.style` once a layout is saved — both
  mistakes silently wiped the couple's edits before.
- `rg` is not always on PATH here; a scan written as `rg … || echo CLEAN` will
  report a false pass. Use `grep -rn '[åäöÅÄÖ]'` and check the real output.

## Verification

Run relevant checks before reporting:

```bash
npm run check:figures
npm run check:seats
npm run check:colour
npm run lint
npm run typecheck
npm run build
```

Run the language scan documented in `AGENTS.md` and keep any hits intentional.
