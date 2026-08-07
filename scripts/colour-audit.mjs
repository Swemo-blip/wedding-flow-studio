// Every colour literal in the stylesheet that a token change would NOT reach.
//
//   node scripts/colour-audit.mjs            summary
//   node scripts/colour-audit.mjs --list     every literal, grouped by role
//   node scripts/colour-audit.mjs --role=ink just one role
//
// Why this exists. `:root` defines 51 custom properties, but the stylesheet
// carries hundreds more colour literals outside that block, plus a handful in
// components. Re-pointing the tokens alone therefore repaints only part of the
// app — which is exactly why every previous palette change shipped looking
// half-finished. This turns "sweep the hardcoded colours" from a guess into a
// reviewable list: each literal with the selector and property it sits on, and
// the role it is playing, so a migration can be checked rather than eyeballed.
//
// It classifies by the PROPERTY the colour is set on, not by the colour itself.
// A warm beige is a surface in one rule and a hairline in another; only the
// property says which. Anything it cannot place lands in `unclassified`, and
// that bucket is the point — it is the list a human still has to read.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = join(here, "..", "app", "globals.css");

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;

// Property → the role that colour is playing. Ordered: first match wins, so the
// more specific patterns come before the generic ones.
const ROLES = [
  [/^--/, "token-alias"],
  [/(^|-)color$/, "ink"],
  [/^background/, "surface"],
  [/^border.*color$|^border(-(top|right|bottom|left))?$|^outline/, "line"],
  [/^box-shadow|^text-shadow|^filter|^drop-shadow/, "shadow"],
  [/^fill$|^stroke$/, "icon"],
  [/^accent-color$|^caret-color$/, "control"],
  [/gradient/, "surface"]
];

function roleFor(property, declaration) {
  if (/gradient\(/.test(declaration)) return "surface";
  for (const [pattern, role] of ROLES) {
    if (pattern.test(property)) return role;
  }
  return "unclassified";
}

const css = readFileSync(cssPath, "utf8");

// Strip comments first, or a hex mentioned in prose counts as a declaration.
const clean = css.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));

// The :root block is the token definition itself and is excluded by design —
// those are the values a palette change edits directly.
const rootMatch = clean.match(/:root\s*\{[\s\S]*?\n\}/);
const rootRange = rootMatch ? [rootMatch.index, rootMatch.index + rootMatch[0].length] : [-1, -1];

// Walk the file character by character rather than line by line. A line-based
// reader silently drops every declaration that wraps — multi-line box-shadows,
// gradients broken across lines — and the first version of this script lost 149
// of 468 literals that way, a 32% undercount that reported itself as a complete
// list. Tracking brace depth and buffering to the semicolon catches all of them.
const findings = [];
const stack = [];
let buffer = "";
let line = 1;
let blockStart = 1;

function lineOf(position) {
  return clean.slice(0, position).split("\n").length;
}

function record(declaration, atLine) {
  const match = declaration.match(/^\s*(--[\w-]+|[-a-zA-Z]+)\s*:\s*([\s\S]+)$/);
  if (!match) return;
  const [, property, value] = match;
  const colours = value.match(COLOUR);
  if (!colours) return;
  const selector = stack[stack.length - 1] ?? "(top level)";
  for (const colour of colours) {
    findings.push({
      colour: colour.toLowerCase().replace(/\s+/g, ""),
      line: atLine,
      property,
      role: roleFor(property, value),
      selector
    });
  }
}

for (let index = 0; index < clean.length; index += 1) {
  const char = clean[index];
  if (char === "\n") line += 1;

  if (char === "{") {
    stack.push(buffer.trim().replace(/\s+/g, " ") || "(anonymous)");
    buffer = "";
    blockStart = line;
    continue;
  }

  if (char === "}") {
    // A declaration may run right up to the closing brace with no semicolon.
    if (buffer.trim() && !(index >= rootRange[0] && index < rootRange[1])) {
      record(buffer, blockStart);
    }
    stack.pop();
    buffer = "";
    continue;
  }

  if (char === ";") {
    if (index >= rootRange[0] && index < rootRange[1]) {
      buffer = "";
      continue;
    }
    record(buffer, lineOf(index));
    buffer = "";
    continue;
  }

  buffer += char;
}

const byRole = new Map();
for (const finding of findings) {
  if (!byRole.has(finding.role)) byRole.set(finding.role, []);
  byRole.get(finding.role).push(finding);
}

const args = process.argv.slice(2);
const wantList = args.includes("--list");
const roleFilter = args.find((a) => a.startsWith("--role="))?.slice(7);

console.log(`app/globals.css — ${findings.length} colour literals outside :root\n`);

const ordered = [...byRole.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [role, items] of ordered) {
  const distinct = new Set(items.map((i) => i.colour)).size;
  console.log(`  ${role.padEnd(14)} ${String(items.length).padStart(4)}  (${distinct} distinct)`);
}

if (rootMatch) {
  const tokens = (rootMatch[0].match(/--[a-z0-9-]+\s*:/g) ?? []).length;
  console.log(`\n  :root defines ${tokens} tokens. A palette change that edits only those`);
  console.log(`  leaves ${findings.length} values in this file untouched.`);
}

if (wantList || roleFilter) {
  for (const [role, items] of ordered) {
    if (roleFilter && role !== roleFilter) continue;
    console.log(`\n=== ${role} (${items.length}) ===`);
    for (const item of items) {
      console.log(`  ${String(item.line).padStart(5)}  ${item.colour.padEnd(24)} ${item.property.padEnd(18)} ${item.selector}`);
    }
  }
} else {
  console.log(`\n  --list for every literal, --role=<name> for one group.`);
}


// --- check mode ------------------------------------------------------------
// `node scripts/colour-audit.mjs --check` — the audit that can FAIL, rather than
// only describe. It exists because a focus ring measured 1.36:1 for months while
// this script happily listed it as one of 468 literals: a list nobody has to act on
// is not a floor.
//
// CALIBRATION, deliberately conservative. A stylesheet cannot tell you what is
// actually behind a rule, and guessing wrong is how a sweep produces phantom
// findings — the failure mode this project has hit four times. So a colour is only
// failed when it misses the floor against ALL THREE light page surfaces, i.e. when
// it cannot possibly pass anywhere on warm paper. Anything that clears even one
// surface is left for a human.
//
// Only the roles with an unambiguous floor are checked:
//   a colour on a :focus rule  — the boundary that identifies a control, 3:1
//   accent-color / caret-color — the control's own painted parts, 3:1
//   color                      — text, 4.5:1
// The `line` role at large is NOT checked: --line separates regions and owes
// nothing, --line-strong bounds a control and owes 3:1, and the property alone
// cannot tell them apart.
function channel(value) {
  const part = value / 255;
  return part <= 0.04045 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

const luminanceOf = luminance;

const SURFACES = [
  ["surface", "#f9f7f3"],
  ["sunken", "#eeebe4"],
  ["canvas", "#e7e4dd"]
];

// TWO CORRECTIONS from this check's own first run, which failed fifteen colours of
// which eleven were phantoms. Both are recorded here because both are the kind of
// mistake that looks like a result.
//
// 1. A BACKGROUND on a :focus rule is not the boundary that identifies the control —
//    the border or outline is. Testing `background: rgba(255,255,255,0.92)` against
//    3:1 flagged a hover fill that was never claiming to be a boundary.
// 2. A LIGHT ink is text on something dark: an overlay on the render, a chip, glass.
//    Measuring it against warm paper says 1.1:1 and means nothing. A selector
//    allowlist was tried first and was immediately too narrow — five separate
//    overlays it had never heard of. So the rule is now a property of the colour
//    rather than a guess about the page: anything lighter than the darkest page
//    surface cannot be judged from the stylesheet, and is COUNTED AND NAMED rather
//    than either failed or silently dropped. Silence is what let 1.36:1 live.
const UNJUDGEABLE_ABOVE = luminanceOf("#e7e4dd");

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// rgba has to be composited before it can be measured. Reading the alpha channel as
// if it were opaque is the mistake that once reported cream-on-scrim as 1.01:1.
function resolve(colour, background) {
  if (colour.startsWith("#")) {
    const hex = colour.length === 4 ? `#${[...colour.slice(1)].map((c) => c + c).join("")}` : colour;
    return hex.length === 9 ? blend(hex.slice(0, 7), parseInt(hex.slice(7), 16) / 255, background) : hex.slice(0, 7);
  }

  const parts = colour.match(/-?[\d.]+/g);
  if (!parts || parts.length < 3) {
    return null;
  }

  const [r, g, b] = parts.map(Number);
  const alpha = parts.length > 3 ? Number(parts[3]) : 1;
  const hex = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  return alpha >= 1 ? hex : blend(hex, alpha, background);
}

function blend(hex, alpha, background) {
  const front = parseInt(hex.slice(1), 16);
  const back = parseInt(background.slice(1), 16);
  const mix = (shift) => Math.round((((front >> shift) & 255) * alpha) + (((back >> shift) & 255) * (1 - alpha)));
  return `#${[16, 8, 0].map((shift) => mix(shift).toString(16).padStart(2, "0")).join("")}`;
}

// The component a rule belongs to: the first two hyphen segments of its first class.
// The first class alone is too narrow — `.scene-boot-monogram` and `.scene-boot-label`
// are the same dark loading screen and were being judged separately, which failed the
// gold monogram against paper it never touches. Two segments group a component's parts
// without merging unrelated ones (`.shared-meta` stays distinct from `.shared-time`,
// and those are on a light page anyway).
function baseOf(selector) {
  const match = selector.match(/\.[\w-]+/);
  if (!match) {
    return selector;
  }

  return match[0].split("-").slice(0, 2).join("-");
}

if (args.includes("--check")) {
  const failures = [];
  const unjudged = [];
  let checked = 0;

  // One pass to decide which components live on something dark, before judging any
  // of them. A component holding even one ink lighter than the darkest page surface
  // is drawn over the render, over glass, or on a dark chip, and nothing in this
  // stylesheet can tell this script which — so it declines to judge the component at
  // all rather than measure it against paper it is not on.
  const DARK_COMPONENTS = new Set();
  for (const finding of findings) {
    if (finding.property !== "color") {
      continue;
    }

    const opaque = resolve(finding.colour, "#ffffff");
    if (opaque && luminance(opaque) > UNJUDGEABLE_ABOVE) {
      DARK_COMPONENTS.add(baseOf(finding.selector));
    }
  }

  for (const finding of findings) {
    const isFocus = /:focus/.test(finding.selector);
    const isControl = finding.role === "control";
    const isInk = finding.role === "ink" && finding.property === "color";
    if (!isFocus && !isControl && !isInk) {
      continue;
    }

    if (finding.colour === "transparent" || /gradient/.test(finding.property)) {
      continue;
    }

    // A background is not a boundary; see correction 1 above.
    if (isFocus && !isControl && !isInk && /^background/.test(finding.property)) {
      continue;
    }

    const floor = isInk ? 4.5 : 3;
    const measured = SURFACES.map(([name, background]) => {
      const resolved = resolve(finding.colour, background);
      return resolved ? { name, ratio: contrast(resolved, background) } : null;
    }).filter(Boolean);

    if (!measured.length) {
      continue;
    }

    // Correction 2, and then a THIRD correction on top of it. Judging each colour on
    // its own lightness split components down the middle: .preview-state-line has
    // three tones, two of them light enough to skip and one just under the line, so
    // the same component got two verdicts. A component is on paper or it is not. So
    // the decision is made per component (see DARK_COMPONENTS) and one light ink
    // anywhere in it settles the whole thing.
    if (DARK_COMPONENTS.has(baseOf(finding.selector))) {
      unjudged.push(finding);
      continue;
    }

    checked += 1;
    const best = measured.reduce((a, b) => (a.ratio >= b.ratio ? a : b));
    if (best.ratio < floor) {
      failures.push({ ...finding, best, floor });
    }
  }

  console.log(`\nchecked ${checked} colour(s) that carry a measurable floor`);
  for (const failure of failures) {
    console.log(
      `  FAIL  line ${String(failure.line).padStart(5)}  ${failure.selector.slice(0, 52)}\n` +
        `        ${failure.property}: ${failure.colour} — best ${failure.best.ratio.toFixed(2)}:1 ` +
        `on ${failure.best.name}, needs ${failure.floor}:1`
    );
  }
  if (!failures.length) {
    console.log("  no colour with a measurable floor misses it on every light surface");
  } else {
    process.exitCode = 1;
  }
  if (unjudged.length) {
    console.log(
      `\n${unjudged.length} light value(s) not judged — they sit on something dark this file cannot see:`
    );
    for (const finding of unjudged) {
      console.log(`        line ${String(finding.line).padStart(5)}  ${finding.selector.slice(0, 48)} ${finding.property}: ${finding.colour}`);
    }
  }
}
