// Homepage first-screen review captures (run with `npm run shots`).
// Viewport-only screenshots: M1 is the first screen. Animations are fast-forwarded to their end.

import { test } from "@playwright/test";

const OUT = process.env.SHOTS_DIR ?? ".reference-output/shots";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

const VARIANTS = [
  { name: "home-libre-bodoni", path: "/" },
  { name: "home-bodoni-moda", path: "/_compare/hero-bodoni-moda/" },
];

for (const { name, path } of VARIANTS) {
  for (const { width, height } of VIEWPORTS) {
    test(`${name} @ ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/${name}-${width}x${height}.png`, animations: "disabled" });
    });
  }
}
