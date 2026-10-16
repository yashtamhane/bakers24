// Measures how each headline candidate must be set to match the reference “Moments”.
//   node scripts/reference/headline-metrics.mjs
//
// For each family × weight, renders “Moments” in Chromium and reports:
//   size      font-size giving the same ink height as the reference (real CSS px)
//   aspect    ink width ÷ ink height (set-width); reference value shown for comparison
//   coverage  share of the ink box that is inked, after degrading the render to the reference's
//             native resolution: a stroke-weight proxy (reference ≈ 0.245)
// Optical-size fonts are measured at the size they would actually be set at, because
// `font-optical-sizing: auto` changes stroke contrast with font-size.

import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { FONT_SAMPLES, OUTPUT_DIR, PANELS, REFERENCE_IMAGE, ROOT } from "./regions.mjs";
import { startStaticServer } from "./static-server.mjs";

const CANDIDATES = [
  { family: "Libre Bodoni Variable", css: "@fontsource-variable/libre-bodoni/index.css", weights: [400, 500] },
  { family: "Bodoni Moda Variable", css: "@fontsource-variable/bodoni-moda/standard.css", weights: [400, 450, 500, 600] },
];
const SAMPLES = [
  { id: "mobile-line-1", scale: PANELS["mobile-home"].rect[2] / PANELS["mobile-home"].viewportWidth },
  { id: "desk-line-1", scale: PANELS["desktop-home"].rect[2] / PANELS["desktop-home"].viewportWidth },
];
const DSF = 4;

async function grey(img) {
  const { data, info } = await img.removeAlpha().toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function inkBox(values, w, h, threshold) {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (values[y * w + x] > threshold) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
}

async function reference(rect, scale) {
  const [left, top, width, height] = rect;
  const { data, w, h } = await grey(sharp(REFERENCE_IMAGE).extract({ left, top, width, height }));
  const sorted = [...data].sort((a, b) => a - b);
  const bg = sorted[Math.floor(sorted.length * 0.4)];
  const ink = sorted[Math.floor(sorted.length * 0.985)];
  const v = Float32Array.from(data, (x) => Math.min(1, Math.max(0, (x - bg) / (ink - bg))));
  const b = inkBox(v, w, h, 0.5);
  let sum = 0;
  for (let y = b.y0; y < b.y0 + b.bh; y++) for (let x = b.x0; x < b.x0 + b.bw; x++) sum += v[y * w + x];
  return { inkHeight: b.bh / scale, aspect: b.bw / b.bh, coverage: sum / (b.bw * b.bh), nativeHeight: b.bh };
}

const server = await startStaticServer(ROOT);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: DSF });
await page.goto(`${server.origin}/__blank`);
await page.setContent(
  `<!doctype html>${CANDIDATES.map((c) => `<link rel="stylesheet" href="/node_modules/${c.css}">`).join("")}
  <style>body{margin:0;background:#000}#s{display:inline-block;padding:8px;color:#fff;line-height:1.2;white-space:nowrap;font-optical-sizing:auto}</style><div id="s">Moments</div>`,
);

async function render(family, weight, px) {
  await page.evaluate(
    async ({ family, weight, px }) => {
      const el = document.getElementById("s");
      Object.assign(el.style, { fontFamily: `"${family}"`, fontWeight: String(weight), fontSize: `${px}px` });
      await document.fonts.load(`${weight} ${px}px "${family}"`, "Moments");
    },
    { family, weight, px },
  );
  const { data, w, h } = await grey(sharp(await page.locator("#s").screenshot()));
  const v = Float32Array.from(data, (x) => x / 255);
  return { data, w, h, box: inkBox(v, w, h, 0.5) };
}

const results = [];
for (const sample of SAMPLES) {
  const spec = FONT_SAMPLES.find((s) => s.id === sample.id);
  const ref = await reference(spec.rect, sample.scale);
  for (const c of CANDIDATES) {
    for (const weight of c.weights) {
      // First pass at the nominal size to find the ink-height ratio, second pass at the matched
      // size so optical sizing reflects the real setting.
      const probe = await render(c.family, weight, spec.renderPx);
      const size = (spec.renderPx * ref.inkHeight) / (probe.box.bh / DSF);
      const r = await render(c.family, weight, size);
      const tw = Math.max(1, Math.round((r.box.bw * ref.nativeHeight) / r.box.bh));
      const small = await sharp(r.data, { raw: { width: r.w, height: r.h, channels: 1 } })
        .extract({ left: r.box.x0, top: r.box.y0, width: r.box.bw, height: r.box.bh })
        .resize(tw, ref.nativeHeight, { fit: "fill" })
        .toColourspace("b-w")
        .raw()
        .toBuffer();
      let sum = 0;
      for (const x of small) sum += x / 255;
      results.push({
        sample: sample.id,
        family: c.family,
        weight,
        size: +size.toFixed(1),
        aspect: +(r.box.bw / r.box.bh).toFixed(3),
        referenceAspect: +ref.aspect.toFixed(3),
        coverage: +(sum / small.length).toFixed(3),
        referenceCoverage: +ref.coverage.toFixed(3),
      });
    }
  }
}

await browser.close();
await server.close();

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await fs.writeFile(path.join(OUTPUT_DIR, "headline-metrics.json"), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(
    `${r.sample.padEnd(14)} ${r.family.replace(" Variable", "").padEnd(13)} ${String(r.weight).padEnd(4)} size ${String(r.size).padEnd(5)} aspect ${r.aspect} (ref ${r.referenceAspect})  coverage ${r.coverage} (ref ${r.referenceCoverage})`,
  );
}
