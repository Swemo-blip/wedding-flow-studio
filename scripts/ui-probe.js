// Paste this whole file into the browser console on any route, at any width.
// It reports the defects a screenshot cannot show you: real horizontal overflow,
// text below the contrast floor, hit areas too small for a thumb, the display
// serif set below the size where it is a drawing, and uppercase that survived.
//
//   node has no browser here — there is no puppeteer or playwright in this project
//   and adding one is a 300MB decision nobody has made. So this is a paste, not a
//   `npm run` script. Open the route, paste, read the JSON.
//
// FOUR CORRECTIONS ARE BAKED IN. Every one of them was a false result this probe
// produced before it produced a true one, on 2026-08-03. Do not "simplify" them
// back out:
//
//   1. Backgrounds are COMPOSITED through translucent layers. Walking up to the
//      first background with alpha >= 0.95 reported cream text on a 62% dark scrim
//      as 1.01:1 — invisible — when the real composite is fine. Three of four
//      findings on the first route were phantoms.
//   2. Children of real scrollers are NOT overflow. A horizontal scroller is a
//      legitimate pattern for wide content, and its scrolled-out children sit
//      outside the viewport by design. Reporting them looked exactly like content
//      silently clipped, and nearly caused a working component to be rebuilt.
//   3. Text over a canvas or an <img> is reported SEPARATELY, never scored. CSS
//      cannot know what is behind it.
//   4. Clamped font sizes must be judged at their MINIMUM. On a narrow viewport
//      every clamp collapses to its lower bound, so a rule that "can reach 2rem"
//      tells you nothing about what a phone actually renders. Run this at 390px.
//
// And the discipline that produced them: cross-check any count against a second,
// differently-shaped measurement before believing it. This file's own totals were
// wrong twice.
(() => {
  const DELIBERATE = [
    // Kept small on purpose. If one of these shows up, it is not a finding.
    { why: "destroys a row — a harder target is protection", match: /^Remove / },
    { why: "once-a-session act, not done mid-service", match: /^(EN|SV)$/ },
    { why: "reads as a row; shrinking the row is worse", match: /^(3D Studio|Plan View|Overview|From entrance|2D|3D)$/ }
  ];

  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const parse = (s) => {
    const m = s && s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b), hi = Math.max(x, y), lo = Math.min(x, y);
    return (hi + 0.05) / (lo + 0.05);
  };

  // Correction 1.
  const bgOf = (el) => {
    const layers = [];
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 0.99) break;
      }
      node = node.parentElement;
    }
    layers.push({ r: 255, g: 255, b: 255, a: 1 });
    let acc = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i -= 1) {
      const t = layers[i];
      acc = {
        r: t.r * t.a + acc.r * (1 - t.a),
        g: t.g * t.a + acc.g * (1 - t.a),
        b: t.b * t.a + acc.b * (1 - t.a),
        a: 1
      };
    }
    return acc;
  };

  // Correction 3.
  const overUnknown = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      if (s.backgroundImage && s.backgroundImage !== "none") return true;
      if (node.querySelector && node.querySelector(":scope > canvas, :scope > img")) return true;
      node = node.parentElement;
    }
    return false;
  };

  // Correction 2.
  const inScroller = (el) => {
    let node = el.parentElement;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 1) return true;
      node = node.parentElement;
    }
    return false;
  };

  const excused = (label) => DELIBERATE.some((rule) => rule.match.test(label));

  // Open every disclosure: collapsed CSS is the CSS nobody checks.
  const drawers = [...document.querySelectorAll("details")];
  drawers.forEach((d) => { d.open = true; });

  const out = {
    route: location.pathname,
    width: innerWidth,
    drawersOpened: drawers.length,
    documentOverflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    overflowing: [],
    lowContrast: [],
    textOverImagery: 0,
    smallTargets: [],
    smallSerif: [],
    uppercase: []
  };

  const limit = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.right <= limit + 1) continue;
    const s = getComputedStyle(el);
    if (s.position === "fixed" || s.overflowX === "auto" || s.overflowX === "scroll") continue;
    if (inScroller(el)) continue;
    out.overflowing.push(`${el.tagName.toLowerCase()}.${(typeof el.className === "string" && el.className.split(" ")[0]) || "?"} +${Math.round(r.right - limit)}px`);
  }
  out.overflowing = [...new Set(out.overflowing)].slice(0, 8);

  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length) continue;
    const text = (el.textContent || "").trim();
    if (!text) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || +s.opacity < 0.5) continue;
    const fg = parse(s.color);
    if (!fg || fg.a < 0.9) continue;
    const px = parseFloat(s.fontSize);
    const large = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700);
    const floor = large ? 3 : 4.5;
    const r = ratio(fg, bgOf(el));
    if (r >= floor) continue;
    if (overUnknown(el)) { out.textOverImagery += 1; continue; }
    const key = s.color + text.slice(0, 16);
    if (seen.has(key)) continue;
    seen.add(key);
    out.lowContrast.push(`${text.slice(0, 30)} — ${r.toFixed(2)}:1 needs ${floor} @${Math.round(px)}px`);
  }
  out.lowContrast = out.lowContrast.slice(0, 10);

  for (const el of document.querySelectorAll("button, a[href], summary, [role=button]")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.height >= 32 && r.width >= 24) continue;
    const label = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 24);
    if (excused(label)) continue;
    out.smallTargets.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  out.smallTargets = [...new Set(out.smallTargets)].slice(0, 10);

  // Correction 4 — this is a measurement of what RENDERED, so run it at 390px.
  const serif = new Map();
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (!/Cormorant/i.test(s.fontFamily)) continue;
    const px = parseFloat(s.fontSize);
    if (px >= 28) continue;
    const text = (el.textContent || "").trim();
    if (!text || el.children.length) continue;
    if (!serif.has(text)) serif.set(text, `${text.slice(0, 24)} @${Math.round(px)}px`);
  }
  out.smallSerif = [...serif.values()].slice(0, 8);

  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length) continue;
    if (getComputedStyle(el).textTransform !== "uppercase") continue;
    const text = (el.textContent || "").trim();
    if (text) out.uppercase.push(text.slice(0, 24));
  }
  // The wordmark, the sidebar group labels and the printed sheets keep their capitals.
  out.uppercase = [...new Set(out.uppercase)].slice(0, 8);

  return JSON.stringify(out, null, 1);
})();
