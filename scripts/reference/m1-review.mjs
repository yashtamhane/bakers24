// Builds the M1 review sheets from screenshots captured by `npm run shots`.
//   SHOTS_DIR=.reference-output/shots/m1-final npm run shots
//   node scripts/reference/m1-review.mjs .reference-output/shots/m1-final
//
// Writes .reference-output/review-m1/:
//   compare-<size>.png      reference | Libre Bodoni | Bodoni Moda, full screen
//   overlay-<size>.png      reference vs Libre Bodoni at 50% opacity, with 10% guides
//   headline-compare.png    the headline block at true size, reference vs both faces
// The reference's drawn status bar is removed and the panel is scaled to the screenshot's
// size (width-matched; height stretched to the phone's height, since the layout is
// positioned proportionally). Labels state exactly what each column is.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { OUTPUT_DIR, PANELS, REFERENCE_IMAGE } from "./regions.mjs";

const shotsDir = process.argv[2];
if (!shotsDir) {
  console.error("Usage: node scripts/reference/m1-review.mjs <shots dir>");
  process.exit(1);
}
const out = path.join(OUTPUT_DIR, "review-m1");
await fs.mkdir(out, { recursive: true });

const STATUS_BAR = 47; // at 390px wide
const [pl, pt, pw, ph] = PANELS["mobile-home"].rect;

async function referenceAt(width, height) {
  const full390 = Math.round((ph * 390) / pw);
  const content = await sharp(REFERENCE_IMAGE).extract({ left: pl, top: pt, width: pw, height: ph }).resize(390, full390, { kernel: "lanczos3" }).removeAlpha().png().toBuffer();
  return sharp(content).extract({ left: 0, top: STATUS_BAR, width: 390, height: full390 - STATUS_BAR }).resize(width, height, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
}

const label = (text, width) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="34"><text x="4" y="22" font-family="Helvetica" font-size="15" fill="#e8e8e8">${text}</text></svg>`);

for (const size of ["390x844", "375x812"]) {
  const [w, h] = size.split("x").map(Number);
  const ref = await referenceAt(w, h);
  const libre = await sharp(path.join(shotsDir, `home-libre-bodoni-${size}.png`)).removeAlpha().png().toBuffer();
  const moda = await sharp(path.join(shotsDir, `home-bodoni-moda-${size}.png`)).removeAlpha().png().toBuffer();
  const gap = 24;
  await sharp({ create: { width: w * 3 + gap * 2, height: h + 34, channels: 3, background: "#151515" } })
    .composite([
      { input: label("Approved reference (status bar removed, scaled to screen)", w * 3), left: 0, top: 0 },
      { input: label("Built · Libre Bodoni headline (baseline)", w), left: w + gap, top: 0 },
      { input: label("Built · Bodoni Moda headline (option)", w), left: (w + gap) * 2, top: 0 },
      { input: ref, left: 0, top: 34 },
      { input: libre, left: w + gap, top: 34 },
      { input: moda, left: (w + gap) * 2, top: 34 },
    ])
    .png()
    .toFile(path.join(out, `compare-${size}.png`));

  const guides = Array.from({ length: 9 }, (_, i) => {
    const y = Math.round((h * (i + 1)) / 10);
    return `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="#00ff88" stroke-opacity="0.5" stroke-dasharray="5 5"/><text x="3" y="${y - 3}" fill="#00ff88" font-family="Helvetica" font-size="11">${(i + 1) * 10}%</text>`;
  }).join("");
  const overlay = await sharp(ref).composite([{ input: await sharp(libre).ensureAlpha(0.5).png().toBuffer() }, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${guides}</svg>`) }]).png().toBuffer();
  await sharp({ create: { width: w, height: h + 34, channels: 3, background: "#151515" } })
    .composite([{ input: label("Overlay: reference + Libre Bodoni build at 50%", w), left: 0, top: 0 }, { input: overlay, left: 0, top: 34 }])
    .png()
    .toFile(path.join(out, `overlay-${size}.png`));
}

// Headline close-up at true size (390×844 captures; reference scaled to 390 wide, no stretch).
{
  const W = 390;
  const full390 = Math.round((ph * W) / pw);
  const refPanel = await sharp(REFERENCE_IMAGE).extract({ left: pl, top: pt, width: pw, height: ph }).resize(W, full390, { kernel: "lanczos3" }).removeAlpha().png().toBuffer();
  // Reference headline block: cap-top 232 → “Here.” baseline 367 (below the status bar).
  const refCrop = await sharp(refPanel).extract({ left: 30, top: STATUS_BAR + 218, width: 330, height: 165 }).png().toBuffer();
  const crops = [refCrop];
  for (const v of ["libre-bodoni", "bodoni-moda"]) {
    // Built headline block: cap-top 253 at 844px tall.
    crops.push(await sharp(path.join(shotsDir, `home-${v}-390x844.png`)).extract({ left: 30, top: 239, width: 330, height: 165 }).removeAlpha().png().toBuffer());
  }
  const scale = 2;
  const cw = 330 * scale;
  const chh = 165 * scale;
  const names = ["Approved reference", "Libre Bodoni 400 (baseline)", "Bodoni Moda 500, optical size auto (option)"];
  const layers = [];
  for (const [i, c] of crops.entries()) {
    layers.push({ input: label(names[i], cw), left: i * (cw + 20), top: 0 });
    layers.push({ input: await sharp(c).resize(cw, chh, { kernel: "lanczos3" }).png().toBuffer(), left: i * (cw + 20), top: 34 });
  }
  await sharp({ create: { width: cw * 3 + 40, height: chh + 34, channels: 3, background: "#151515" } }).composite(layers).png().toFile(path.join(out, "headline-compare.png"));
}

console.log(`Wrote ${path.relative(process.cwd(), out)}/{compare,overlay}-{390x844,375x812}.png and headline-compare.png`);
