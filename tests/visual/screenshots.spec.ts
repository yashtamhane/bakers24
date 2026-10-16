// Captures review screenshots (run with `npm run shots`). For human comparison against the
// reference, not pixel assertions. Set SHOTS_DIR to keep a named set instead of the default.

import { test } from "@playwright/test";

const OUT = process.env.SHOTS_DIR ?? ".reference-output/shots";
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440];
const PAGES = [{ name: "styleguide", path: "/_styleguide/" }];

for (const { name, path } of PAGES) {
  for (const width of WIDTHS) {
    test(`${name} @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
    });
  }
}
