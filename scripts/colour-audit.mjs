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
