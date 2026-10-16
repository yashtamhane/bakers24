// Homepage first-screen review captures (run with `npm run shots`).
// Viewport-only shots of the first screen (M1) at every width, plus full-page shots of the whole
// mobile homepage (M2) at the Gate A review sizes. Animations are fast-forwarded to their end.

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

// Full mobile homepage (M2), Libre Bodoni only, at the Gate A review sizes.
for (const { width, height } of [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
]) {
  test(`home-full @ ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    // Lazy collection images: bring each into view so the capture never shows an empty tile.
    for (const img of await page.locator("img[loading=lazy]").all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate((n: HTMLImageElement) => n.decode());
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/home-full-${width}x${height}.png`, fullPage: true, animations: "disabled" });
  });
}
