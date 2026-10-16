// Scores font candidates against headline and body text rendered in the approved reference.
//   npm run ref:fonts
//
// Method: each reference text line is cropped, normalised to an ink mask, and trimmed to its
// ink bounding box. Each candidate (family × weight × tracking) renders the same phrase in
// Chromium, is trimmed the same way, and is scaled to the reference ink height while keeping
// its own width, after passing through the reference's native resolution so both carry the
// same blur. Score = soft IoU (Σmin / Σmax) over a shared canvas, so wrong letter shapes
// AND wrong set-width both lower the score. The reference is an AI-rendered collage, so the
// score ranks candidates; it does not identify an exact typeface.
//
// Writes:
//   src/styleguide/font-match.json            (committed summary for /_styleguide)
//   .reference-output/fonts/report.json        (every variant scored)
//   .reference-output/fonts/<sample>.png       (reference vs best render per family, with overlay)
//   src/styleguide/reference-crops/font-*.png  (the reference text crops, for /_styleguide)

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { FONT_SAMPLES, OUTPUT_DIR, REFERENCE_IMAGE, ROOT } from "./regions.mjs";
import { startStaticServer } from "./static-server.mjs";

const CANDIDATES = [
  { kind: "serif", family: "Cormorant Garamond Variable", css: "@fontsource-variable/cormorant-garamond/index.css", weights: [300, 400, 500, 600, 700] },
  { kind: "serif", family: "Playfair Display Variable", css: "@fontsource-variable/playfair-display/index.css", weights: [400, 500, 600, 700] },
  { kind: "serif", family: "Bodoni Moda Variable", css: "@fontsource-variable/bodoni-moda/index.css", weights: [400, 500, 600, 700] },
  { kind: "serif", family: "Gilda Display", css: "@fontsource/gilda-display/index.css", weights: [400] },
  { kind: "serif", family: "Prata", css: "@fontsource/prata/index.css", weights: [400] },
  { kind: "serif", family: "Libre Caslon Display", css: "@fontsource/libre-caslon-display/index.css", weights: [400] },
  { kind: "serif", family: "Playfair Variable", css: "@fontsource-variable/playfair/standard.css", weights: [300, 400, 500, 600] },
  { kind: "serif", family: "Noto Serif Display Variable", css: "@fontsource-variable/noto-serif-display/index.css", weights: [300, 400, 500, 600] },
  { kind: "serif", family: "Libre Bodoni Variable", css: "@fontsource-variable/libre-bodoni/index.css", weights: [400, 500, 600] },
  { kind: "serif", family: "DM Serif Display", css: "@fontsource/dm-serif-display/index.css", weights: [400] },
  { kind: "sans", family: "Inter Variable", css: "@fontsource-variable/inter/index.css", weights: [300, 400, 500] },
  { kind: "sans", family: "DM Sans Variable", css: "@fontsource-variable/dm-sans/index.css", weights: [300, 400, 500] },
  { kind: "sans", family: "Manrope Variable", css: "@fontsource-variable/manrope/index.css", weights: [300, 400, 500] },
];
const TRACKING_EM = [-0.03, -0.015, 0, 0.015, 0.03];
const DEVICE_SCALE = 4; // samples render at their real CSS size, captured at 4× for resolution
const SCALE = 3; // compare at 3× reference resolution

const outDir = path.join(OUTPUT_DIR, "fonts");
await fs.mkdir(outDir, { recursive: true });

// ---------- image helpers ----------

/** Single-channel luminance buffer. Both inputs are RGBA, so alpha must go before going grey. */
async function grey(image) {
  const { data, info } = await image.removeAlpha().toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`expected 1 channel, got ${info.channels}`);
  return { data, info };
}

/** Grayscale crop of the reference, normalised to 0..1 ink (light text on dark ground). */
async function referenceInk(rect) {
  const [left, top, width, height] = rect;
  const { data } = await grey(sharp(REFERENCE_IMAGE).extract({ left, top, width, height }));
  const sorted = [...data].sort((a, b) => a - b);
  const bg = sorted[Math.floor(sorted.length * 0.4)];
  const ink = sorted[Math.floor(sorted.length * 0.985)];
  const values = Float32Array.from(data, (v) => Math.min(1, Math.max(0, (v - bg) / (ink - bg))));
  return { values, width, height };
}

/** Candidate screenshot (white on black) normalised to 0..1. */
async function candidateInk(png) {
  const { data, info } = await grey(sharp(png));
  return { values: Float32Array.from(data, (v) => v / 255), width: info.width, height: info.height };
}

/** Bounding box of pixels above threshold; tolerant of a few noisy pixels per row/column. */
function inkBox({ values, width, height }, threshold = 0.5, minCount = 1) {
  const rows = new Array(height).fill(0);
  const cols = new Array(width).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (values[y * width + x] > threshold) { rows[y]++; cols[x]++; }
  const first = (a) => a.findIndex((c) => c >= minCount);
  const last = (a) => a.length - 1 - [...a].reverse().findIndex((c) => c >= minCount);
  return { x0: first(cols), x1: last(cols), y0: first(rows), y1: last(rows) };
}

async function trimmedToHeight(ink, box, targetHeight) {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const targetWidth = Math.max(1, Math.round((w * targetHeight) / h));
  const raw = Buffer.from(Uint8Array.from(ink.values, (v) => Math.round(v * 255)));
  // sharp promotes 1-channel input to sRGB on resize; force it back to one channel.
  const { data, info } = await sharp(raw, { raw: { width: ink.width, height: ink.height, channels: 1 } })
    .extract({ left: box.x0, top: box.y0, width: w, height: h })
    .resize(targetWidth, targetHeight, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`expected 1 channel, got ${info.channels}`);
  return { values: Float32Array.from(data, (v) => v / 255), width: targetWidth, height: targetHeight };
}

function softIoU(a, b) {
  const width = Math.max(a.width, b.width);
  let min = 0;
  let max = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < width; x++) {
      const va = x < a.width ? a.values[y * a.width + x] : 0;
      const vb = x < b.width ? b.values[y * b.width + x] : 0;
      min += Math.min(va, vb);
      max += Math.max(va, vb);
    }
  }
  return max === 0 ? 0 : min / max;
}

// ---------- render candidates ----------

const server = await startStaticServer(ROOT);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: DEVICE_SCALE });

const links = CANDIDATES.map((c) => `<link rel="stylesheet" href="/node_modules/${c.css}">`).join("");
// Navigate to the server first so the document shares its origin (fonts are CORS-checked).
await page.goto(`${server.origin}/__blank`);
await page.setContent(
  `<!doctype html><html><head><base href="${server.origin}/">${links}
  <style>body{margin:0;background:#000}.s{display:inline-block;padding:8px;color:#fff;background:#000;line-height:1.2;white-space:nowrap;font-kerning:normal;-webkit-font-smoothing:antialiased}</style>
  </head><body><div id="s" class="s"></div></body></html>`,
  { waitUntil: "load" },
);

// Load every face (including each ₹ subset), then ask Chromium which font actually drew
// the Latin sample and the ₹ glyph. This catches silent fallbacks that width checks miss.
await page.evaluate(async (candidates) => {
  for (const c of candidates) for (const w of c.weights) await document.fonts.load(`${w} 40px "${c.family}"`, "Ag₹");
  const probe = document.createElement("div");
  probe.innerHTML = candidates
    .map((c, i) => `<span id="latin-${i}" style="font-family:'${c.family}',monospace">Ag</span><span id="rupee-${i}" style="font-family:'${c.family}',monospace">₹</span>`)
    .join("");
  document.body.append(probe);
  await document.fonts.ready;
}, CANDIDATES);

const cdp = await page.context().newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument");
const renderedBy = async (selector) => {
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  return fonts.map((f) => f.familyName);
};
const coverage = {};
for (const [i, c] of CANDIDATES.entries()) {
  const expected = c.family.replace(/ Variable$/, "");
  const latin = await renderedBy(`#latin-${i}`);
  const rupee = await renderedBy(`#rupee-${i}`);
  coverage[c.family] = {
    // Variable fonts report their instance name ("DM Sans 9pt"), so match on the family prefix.
    loaded: latin.length === 1 && latin[0].startsWith(expected),
    rupee: rupee.length === 1 && rupee[0].startsWith(expected),
    rupeeRenderedBy: rupee.join(", "),
  };
}
await page.evaluate(() => document.querySelector("#s").nextElementSibling?.remove());

const scores = [];
const bestRenders = new Map(); // `${sample}|${family}` -> {score, png}
const referenceCache = new Map();

for (const sample of FONT_SAMPLES) {
  const ref = await referenceInk(sample.rect);
  const refBox = inkBox(ref, 0.5, 2);
  const targetHeight = (refBox.y1 - refBox.y0 + 1) * SCALE;
  const refNorm = await trimmedToHeight(ref, refBox, targetHeight);
  referenceCache.set(sample.id, refNorm);

  for (const c of CANDIDATES.filter((k) => k.kind === sample.kind)) {
    for (const weight of c.weights) {
      for (const tracking of TRACKING_EM) {
        await page.evaluate(
          ({ text, family, weight, tracking, px }) => {
            const el = document.getElementById("s");
            el.textContent = text;
            el.style.fontSize = `${px}px`;
            el.style.fontFamily = `"${family}"`;
            el.style.fontWeight = String(weight);
            el.style.letterSpacing = `${tracking}em`;
          },
          { text: sample.text, family: c.family, weight, tracking, px: sample.renderPx },
        );
        const png = await page.locator("#s").screenshot();
        const cand = await candidateInk(png);
        // Degrade the crisp render exactly like the reference: down to its native ink height,
        // then back up. Without this, blur in the reference rewards heavier weights.
        const candNative = await trimmedToHeight(cand, inkBox(cand), refBox.y1 - refBox.y0 + 1);
        const candNorm = await trimmedToHeight(candNative, { x0: 0, y0: 0, x1: candNative.width - 1, y1: candNative.height - 1 }, targetHeight);
        const score = softIoU(refNorm, candNorm);
        scores.push({ sample: sample.id, family: c.family, weight, tracking, score });
        const key = `${sample.id}|${c.family}`;
        if (!bestRenders.has(key) || bestRenders.get(key).score < score) bestRenders.set(key, { score, cand: candNorm, weight, tracking });
      }
    }
  }
}

await browser.close();
await server.close();

// ---------- summarise: best single (weight, tracking) per family across that kind's samples ----------

const summary = [];
for (const c of CANDIDATES) {
  const samples = FONT_SAMPLES.filter((s) => s.kind === c.kind).map((s) => s.id);
  let best = null;
  for (const weight of c.weights) {
    for (const tracking of TRACKING_EM) {
      const per = samples.map((id) => scores.find((r) => r.sample === id && r.family === c.family && r.weight === weight && r.tracking === tracking).score);
      const mean = per.reduce((a, b) => a + b, 0) / per.length;
      if (!best || mean > best.mean) best = { weight, tracking, mean, per: Object.fromEntries(samples.map((id, i) => [id, +per[i].toFixed(4)])) };
    }
  }
  summary.push({
    kind: c.kind,
    family: c.family,
    package: c.css.split("/").slice(0, 2).join("/"),
    loaded: coverage[c.family].loaded,
    rupeeGlyph: coverage[c.family].rupee,
    rupeeRenderedBy: coverage[c.family].rupeeRenderedBy,
    bestWeight: best.weight,
    bestTrackingEm: best.tracking,
    meanScore: +best.mean.toFixed(4),
    perSample: best.per,
  });
}
summary.sort((a, b) => (a.kind === b.kind ? b.meanScore - a.meanScore : a.kind.localeCompare(b.kind)));

await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify({ summary, scores }, null, 2));
await fs.writeFile(
  path.join(ROOT, "src/styleguide/font-match.json"),
  JSON.stringify(
    {
      method: "Soft IoU of ink masks, candidate scaled to reference ink height with its own set-width (higher is closer; 1.0 = identical). Generated by scripts/reference/font-match.mjs.",
      samples: FONT_SAMPLES.map(({ id, kind, text, role }) => ({ id, kind, text, role })),
      summary,
    },
    null,
    2,
  ) + "\n",
);

// ---------- reference crops for /_styleguide (internal comparison aids, never page imagery) ----------

const cropDir = path.join(ROOT, "src/styleguide/reference-crops");
await fs.mkdir(cropDir, { recursive: true });
for (const sample of FONT_SAMPLES) {
  const [left, top, width, height] = sample.rect;
  await sharp(REFERENCE_IMAGE).extract({ left, top, width, height }).png().toFile(path.join(cropDir, `font-${sample.id}.png`));
}

// ---------- visual composites: reference, best render, overlay (ref = magenta, candidate = green) ----------

const toPng = (img, w) => {
  const buf = Buffer.alloc(w * img.height);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < Math.min(w, img.width); x++) buf[y * w + x] = Math.round(img.values[y * img.width + x] * 255);
  return sharp(buf, { raw: { width: w, height: img.height, channels: 1 } }).png().toBuffer();
};
const overlay = (a, b, w) => {
  const buf = Buffer.alloc(w * a.height * 3);
  for (let y = 0; y < a.height; y++) for (let x = 0; x < w; x++) {
    const va = x < a.width ? a.values[y * a.width + x] : 0;
    const vb = x < b.width ? b.values[y * b.width + x] : 0;
    const i = (y * w + x) * 3;
    buf[i] = va * 255; buf[i + 1] = vb * 255; buf[i + 2] = va * 255;
  }
  return sharp(buf, { raw: { width: w, height: a.height, channels: 3 } }).png().toBuffer();
};

for (const sample of FONT_SAMPLES) {
  const ref = referenceCache.get(sample.id);
  const families = summary.filter((s) => s.kind === sample.kind);
  const w = Math.max(ref.width, ...families.map((f) => bestRenders.get(`${sample.id}|${f.family}`).cand.width)) + 8;
  const rowH = ref.height + 34;
  const label = (text) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2 + 24}" height="26"><text x="4" y="18" font-family="Helvetica" font-size="16" fill="#ddd">${text}</text></svg>`);
  const layers = [
    { input: label(`Reference — ${sample.role}`), top: 4, left: 0 },
    { input: await toPng(ref, w), top: 30, left: 0 },
  ];
  let top = rowH;
  for (const f of families) {
    const best = bestRenders.get(`${sample.id}|${f.family}`);
    layers.push({ input: label(`${f.family} · ${best.weight} · ${best.tracking}em · score ${best.score.toFixed(3)}   |   overlay: magenta = reference, green = candidate, white = match`), top: top + 4, left: 0 });
    layers.push({ input: await toPng(best.cand, w), top: top + 30, left: 0 });
    layers.push({ input: await overlay(ref, best.cand, w), top: top + 30, left: w + 24 });
    top += rowH;
  }
  await sharp({ create: { width: w * 2 + 24, height: top + 8, channels: 3, background: "#151515" } })
    .composite(layers)
    .png()
    .toFile(path.join(outDir, `${sample.id}.png`));
}

console.log("family".padEnd(30), "kind ", "weight", "track ", "score ", "₹", "loaded");
for (const s of summary) console.log(s.family.padEnd(30), s.kind.padEnd(5), String(s.bestWeight).padEnd(6), String(s.bestTrackingEm).padEnd(6), s.meanScore.toFixed(3), s.rupeeGlyph ? "yes" : "NO ", s.loaded, s.rupeeRenderedBy);
console.log("\nWrote src/styleguide/font-match.json and .reference-output/fonts/*.png");
