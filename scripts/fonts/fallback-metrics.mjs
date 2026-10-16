// Computes metric-matched fallback @font-face values so text does not shift when web fonts swap in.
//   node scripts/fonts/fallback-metrics.mjs
//
// Measures each web font and its local fallback in Chromium at 100px:
//   ascent / descent  canvas fontBoundingBox metrics
//   line gap          normal line height − ascent − descent
//   width             advance width of a representative string
// then prints size-adjust and ascent/descent/line-gap overrides (overrides are divided by
// size-adjust because the browser scales them by it). Paste the output into src/styles/fonts.css.

import { chromium } from "@playwright/test";
import { ROOT } from "../reference/regions.mjs";
import { startStaticServer } from "../reference/static-server.mjs";

const PAIRS = [
  { web: "Libre Bodoni Variable", css: "@fontsource-variable/libre-bodoni/index.css", fallback: "Georgia", name: "Libre Bodoni Fallback", weight: 400 },
  { web: "DM Sans Variable", css: "@fontsource-variable/dm-sans/index.css", fallback: "Arial", name: "DM Sans Fallback", weight: 400 },
];
const SAMPLE = "Moments Taste Better Here. Artisanal cakes, crafted with care for every celebration. Explore Cakes";

const server = await startStaticServer(ROOT);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${server.origin}/__blank`);
await page.setContent(PAIRS.map((p) => `<link rel="stylesheet" href="/node_modules/${p.css}">`).join(""));

const metrics = await page.evaluate(
  async ({ pairs, sample }) => {
    const measure = async (family, weight) => {
      await document.fonts.load(`${weight} 100px "${family}"`, sample);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${weight} 100px "${family}"`;
      const m = ctx.measureText(sample);
      const span = document.createElement("span");
      span.style.cssText = `font: ${weight} 100px "${family}"; line-height: normal; display: inline-block; white-space: nowrap`;
      span.textContent = sample;
      document.body.append(span);
      const lineHeight = span.getBoundingClientRect().height;
      span.remove();
      return { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent, lineHeight, width: m.width, loaded: document.fonts.check(`${weight} 100px "${family}"`, sample) };
    };
    const out = [];
    for (const p of pairs) out.push({ ...p, webMetrics: await measure(p.web, p.weight), fallbackMetrics: await measure(p.fallback, p.weight) });
    return out;
  },
  { pairs: PAIRS, sample: SAMPLE },
);

await browser.close();
await server.close();

const pct = (v) => `${(v * 100).toFixed(2)}%`;
for (const m of metrics) {
  const w = m.webMetrics;
  const f = m.fallbackMetrics;
  if (!w.loaded) throw new Error(`${m.web} did not load`);
  const sizeAdjust = w.width / f.width;
  const gap = Math.max(0, w.lineHeight - w.ascent - w.descent);
  console.log(`/* ${m.web} ← local("${m.fallback}"), measured by scripts/fonts/fallback-metrics.mjs */
@font-face {
  font-family: "${m.name}";
  src: local("${m.fallback}");
  size-adjust: ${pct(sizeAdjust)};
  ascent-override: ${pct(w.ascent / 100 / sizeAdjust)};
  descent-override: ${pct(w.descent / 100 / sizeAdjust)};
  line-gap-override: ${pct(gap / 100 / sizeAdjust)};
}
`);
}
