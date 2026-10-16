// Measures the mobile hero layout in a screenshot and in the approved reference with the same
// pixel analysis, and prints both with the difference.
//   node scripts/reference/measure-hero.mjs <screenshot.png> [--json out.json]
//
// Both images are normalised to 390px wide. The reference's drawn status bar (top 47px at 390px)
// is removed, so positions are “px below the top of the page”, as a phone browser shows it.
// Detection: light text = bright, low-saturation pixels; button = wine-coloured fill. Vertical
// positions are also given as a share of the visible height, which is the fairer comparison when
// screen heights differ (reference 770px vs 812/844px phones).

import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { PANELS, REFERENCE_IMAGE } from "./regions.mjs";

const STATUS_BAR = 47;
const W = 390;

const { positionals, values } = parseArgs({ allowPositionals: true, options: { json: { type: "string" } } });
if (!positionals[0]) {
  console.error("Usage: node scripts/reference/measure-hero.mjs <screenshot.png> [--json out.json]");
  process.exit(1);
}

async function load(input, cropTop) {
  const meta = await sharp(input).metadata();
  const height = Math.round((meta.height * W) / meta.width);
  const { data } = await sharp(input)
    .resize(W, height, { kernel: "lanczos3" })
    .extract({ left: 0, top: cropTop, width: W, height: height - cropTop })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, h: height - cropTop };
}

function analyse({ data, h }) {
  const px = (x, y) => {
    const i = (y * W + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const isText = ([r, g, b]) => Math.max(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 110;
  const isWine = ([r, g, b]) => r > 70 && r < 190 && r > g * 2.6 && r > b * 2.2;

  const runs = (x0, x1, y0, y1, min, test = isText, mergeGap = 3) => {
    const out = [];
    let start = -1;
    let lastOn = -10;
    for (let y = y0; y < y1; y++) {
      let c = 0;
      for (let x = x0; x < x1; x++) if (test(px(x, y))) c++;
      if (c >= min) {
        if (start < 0) start = y;
        else if (y - lastOn > mergeGap) {
          out.push([start, lastOn]);
          start = y;
        }
        lastOn = y;
      }
    }
    if (start >= 0) out.push([start, lastOn]);
    return out;
  };
  const xRange = (x0, x1, y0, y1, test = isText) => {
    let a = W;
    let b = -1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x < x1; x++) if (test(px(x, y))) { a = Math.min(a, x); b = Math.max(b, x); }
    return [a, b];
  };

  const m = { height: h };
  // Header icons (centre lines)
  const menu = runs(15, 70, 0, 80, 1, isText, 6);
  if (menu.length) m.menuIcon = { y: [menu[0][0], menu.at(-1)[1]], x: xRange(15, 70, menu[0][0], menu.at(-1)[1]) };
  const search = runs(320, 385, 0, 80, 1, isText, 6);
  if (search.length) m.searchIcon = { y: [search[0][0], search.at(-1)[1]], x: xRange(320, 385, search[0][0], search.at(-1)[1]) };

  // Logo: centre column above the headline
  // Lenient test here: the tagline is tiny, so its anti-aliased strokes are dimmer.
  const logoInk = (p) => (Math.max(...p) > 140 && Math.max(...p) - Math.min(...p) < 110) || (p[0] > 170 && p[0] > p[2] * 1.4);
  const logo = runs(120, 270, 0, 140, 2, logoInk, 2);
  const named = ["logoMark", "wordmark", "tagline"];
  logo.slice(0, 3).forEach((r, i) => (m[named[i]] = { y: r, x: xRange(120, 270, r[0], r[1], logoInk) }));

  // Copy column: headline lines are the tall bands, description the short ones after them.
  // Rows are detected in x 40–270 only, which keeps the petal (x > 280) out; extents use 40–335.
  const bands = runs(40, 270, 150, Math.round(h * 0.75), 3).filter(([a, b]) => b - a >= 6);
  const tall = bands.filter(([a, b]) => b - a >= 24).slice(0, 3);
  tall.forEach((r, i) => (m[`headline${i + 1}`] = { y: r, x: xRange(40, 335, r[0], r[1]) }));
  const afterHeadline = tall.length ? tall.at(-1)[1] : 0;
  bands
    .filter(([a, b]) => a > afterHeadline && b - a < 24)
    .slice(0, 2)
    .forEach((r, i) => (m[`lead${i + 1}`] = { y: r, x: xRange(40, 335, r[0], r[1]) }));

  // Button: wine fill measured down a column inside the pill, and across a row through it
  const col = 80;
  const wine = runs(col, col + 1, Math.round(h * 0.45), Math.round(h * 0.85), 1, isWine, 2).sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  if (wine) {
    // Read the width just below the top edge, above the label text.
    const edgeY = wine[0] + 5;
    let right = col;
    while (right < W - 1 && (isWine(px(right + 1, edgeY)) || isWine(px(right + 2, edgeY)))) right++;
    let left = col;
    while (left > 0 && isWine(px(left - 1, edgeY))) left--;
    m.button = { y: wine, x: [left, right] };
  }
  return m;
}

const reference = analyse(
  await load(
    await sharp(REFERENCE_IMAGE).extract({ left: PANELS["mobile-home"].rect[0], top: PANELS["mobile-home"].rect[1], width: PANELS["mobile-home"].rect[2], height: PANELS["mobile-home"].rect[3] }).png().toBuffer(),
    STATUS_BAR,
  ),
);
const shot = analyse(await load(positionals[0], 0));

const rows = [];
for (const key of ["menuIcon", "searchIcon", "logoMark", "wordmark", "tagline", "headline1", "headline2", "headline3", "lead1", "lead2", "button"]) {
  const r = reference[key];
  const s = shot[key];
  if (!r || !s) {
    rows.push({ key, missing: !r ? "reference" : "screenshot" });
    continue;
  }
  rows.push({
    key,
    refY: r.y, shotY: s.y, dTop: s.y[0] - r.y[0], dHeight: s.y[1] - s.y[0] - (r.y[1] - r.y[0]),
    refTopPct: +((r.y[0] / reference.height) * 100).toFixed(1), shotTopPct: +((s.y[0] / shot.height) * 100).toFixed(1),
    refX: r.x, shotX: s.x, dLeft: s.x[0] - r.x[0], dWidth: s.x[1] - s.x[0] - (r.x[1] - r.x[0]),
  });
}

console.log(`Reference content height ${reference.height}px · screenshot ${shot.height}px (both at 390px wide)\n`);
console.log("element      ref y      shot y     Δtop Δh   ref%  shot%   ref x      shot x     Δleft Δw");
for (const r of rows) {
  if (r.missing) {
    console.log(`${r.key.padEnd(12)} not detected in ${r.missing}`);
    continue;
  }
  const f = (a) => `${a[0]}–${a[1]}`.padEnd(10);
  const n = (v) => String(v >= 0 ? `+${v}` : v).padStart(4);
  console.log(`${r.key.padEnd(12)} ${f(r.refY)} ${f(r.shotY)} ${n(r.dTop)} ${n(r.dHeight)}  ${String(r.refTopPct).padStart(5)} ${String(r.shotTopPct).padStart(5)}   ${f(r.refX)} ${f(r.shotX)} ${n(r.dLeft)} ${n(r.dWidth)}`);
}
if (values.json) await fs.writeFile(values.json, JSON.stringify({ reference, screenshot: shot, rows }, null, 2));
