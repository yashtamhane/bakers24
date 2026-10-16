// Compares a browser screenshot with the matching panel of the approved reference.
//   npm run ref:compare -- --panel mobile-home --shot .reference-output/shots/home-390.png
//   options: --crop-top <px>  remove the mockup's drawn status bar (px at viewport width, e.g. 47)
//            --stretch        scale the screenshot to the panel's height as well (for layouts
//                             positioned proportionally on a taller/shorter screen)
//
// The panel is scaled to the viewport width it represents; the screenshot is scaled to the same
// width and cropped to the panel's height (top of page). Outputs, in .reference-output/compare/:
//   <name>-side.png     reference | screenshot | 50% overlay, with guide lines every 10% of height
//   <name>-diff.png     per-pixel difference (bright = different)
//   <name>-tone.png     tonal layout grid: mean colour per cell for each image and ΔE heat map
// and prints the mean/max tonal ΔE. Photography will differ, so judge layout, proportion and
// tone with these, not a pixel-perfect score.

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { OUTPUT_DIR, PANELS, REFERENCE_IMAGE } from "./regions.mjs";

const { values } = parseArgs({
  options: {
    panel: { type: "string" },
    shot: { type: "string" },
    name: { type: "string" },
    cols: { type: "string", default: "6" },
    "crop-top": { type: "string", default: "0" },
    stretch: { type: "boolean", default: false },
    rows: { type: "string", default: "12" },
  },
});

const panel = PANELS[values.panel ?? ""];
if (!panel || !values.shot) {
  console.error(`Usage: npm run ref:compare -- --panel <${Object.keys(PANELS).join("|")}> --shot <png> [--name out]`);
  process.exit(1);
}

const name = values.name ?? `${values.panel}-vs-${path.basename(values.shot, ".png")}`;
const outDir = path.join(OUTPUT_DIR, "compare");
await fs.mkdir(outDir, { recursive: true });

const W = panel.viewportWidth;
const [left, top, width, height] = panel.rect;
const cropTop = Number(values["crop-top"]);
const fullH = Math.round((height * W) / width);
const H = fullH - cropTop;

const reference = await sharp(
  await sharp(REFERENCE_IMAGE).extract({ left, top, width, height }).resize(W, fullH, { kernel: "lanczos3" }).removeAlpha().png().toBuffer(),
)
  .extract({ left: 0, top: cropTop, width: W, height: H })
  .png()
  .toBuffer();

const shotMeta = await sharp(values.shot).metadata();
const scaledHeight = values.stretch ? H : Math.round((shotMeta.height * W) / shotMeta.width);
const shotScaled = await sharp(values.shot).resize(W, scaledHeight, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
if (scaledHeight < H) console.warn(`Screenshot is shorter than the panel (${scaledHeight}px < ${H}px); padding with black.`);
const shot = await sharp(shotScaled)
  .extend({ bottom: Math.max(0, H - scaledHeight), background: "#000" })
  .extract({ left: 0, top: 0, width: W, height: H })
  .removeAlpha()
  .png()
  .toBuffer();

// ---------- side by side with guides ----------

const GAP = 24;
const guides = Array.from({ length: 9 }, (_, i) => {
  const y = Math.round((H * (i + 1)) / 10);
  return `<line x1="0" x2="${W * 3 + GAP * 2}" y1="${y}" y2="${y}" stroke="#00ff88" stroke-opacity="0.45" stroke-dasharray="6 6"/><text x="4" y="${y - 4}" fill="#00ff88" font-family="Helvetica" font-size="12">${(i + 1) * 10}%</text>`;
}).join("");
const overlay = await sharp(reference).composite([{ input: await sharp(shot).ensureAlpha(0.5).png().toBuffer(), blend: "over" }]).png().toBuffer();

await sharp({ create: { width: W * 3 + GAP * 2, height: H, channels: 3, background: "#111" } })
  .composite([
    { input: reference, left: 0, top: 0 },
    { input: shot, left: W + GAP, top: 0 },
    { input: overlay, left: (W + GAP) * 2, top: 0 },
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * 3 + GAP * 2}" height="${H}">${guides}</svg>`), left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(outDir, `${name}-side.png`));

// ---------- difference ----------

await sharp(reference).composite([{ input: shot, blend: "difference" }]).png().toFile(path.join(outDir, `${name}-diff.png`));

// ---------- tonal layout grid ----------

const cols = Number(values.cols);
const rows = Number(values.rows);
const cell = async (buf) => (await sharp(buf).resize(cols, rows, { kernel: "cubic", fit: "fill" }).raw().toBuffer());
const refCells = await cell(reference);
const shotCells = await cell(shot);

const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lab = (r, g, b) => {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const deltas = [];
for (let i = 0; i < cols * rows; i++) {
  const a = lab(refCells[i * 3], refCells[i * 3 + 1], refCells[i * 3 + 2]);
  const b = lab(shotCells[i * 3], shotCells[i * 3 + 1], shotCells[i * 3 + 2]);
  deltas.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
}
const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
const max = Math.max(...deltas);

const CELL = 32;
const gridW = cols * CELL;
const gridH = rows * CELL;
const heat = Buffer.alloc(cols * rows * 3);
deltas.forEach((d, i) => {
  const t = Math.min(1, d / 30); // 0 = identical, ≥30 ΔE = full red
  heat[i * 3] = Math.round(40 + 215 * t);
  heat[i * 3 + 1] = Math.round(200 * (1 - t));
  heat[i * 3 + 2] = 40;
});
const up = (raw) => sharp(raw, { raw: { width: cols, height: rows, channels: 3 } }).resize(gridW, gridH, { kernel: "nearest" }).png().toBuffer();
await sharp({ create: { width: gridW * 3 + GAP * 2, height: gridH, channels: 3, background: "#111" } })
  .composite([
    { input: await up(refCells), left: 0, top: 0 },
    { input: await up(shotCells), left: gridW + GAP, top: 0 },
    { input: await up(heat), left: (gridW + GAP) * 2, top: 0 },
  ])
  .png()
  .toFile(path.join(outDir, `${name}-tone.png`));

console.log(`Panel ${values.panel} at ${W}×${H}${cropTop ? ` (top ${cropTop}px status bar removed)` : ""} vs ${values.shot}${values.stretch ? " (stretched to panel height)" : ""}`);
console.log(`Tonal layout ΔE (${cols}×${rows} grid): mean ${mean.toFixed(1)}, max ${max.toFixed(1)}`);
console.log(`Wrote .reference-output/compare/${name}-{side,diff,tone}.png`);
