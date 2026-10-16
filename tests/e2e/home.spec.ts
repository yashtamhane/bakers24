import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

// M1 covers the mobile first screen only; the desktop homepage is M5.
test.skip(({ viewport }) => (viewport?.width ?? 0) > 500, "Desktop homepage is designed in M5");

const HOME = "/";
const VARIANT = "/_compare/hero-bodoni-moda/";

async function open(page: Page, path = HOME) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error("element not rendered");
  return b;
};

// ---------- relative luminance helpers (WCAG 2.x) ----------
const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const parseRgb = (css: string) => (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [number, number, number];

/**
 * Worst-case contrast of an element's text against the pixels actually rendered behind it.
 * 1. Capture the element's box with the text transparent (its halo shadow still renders).
 * 2. Capture it again with the text forced to pure white and no shadow; pixels that change are
 *    glyphs. Grow that mask by 3px to cover the glyph edges.
 * 3. Compare the text colour with the 98th-percentile background luminance inside the mask
 *    (ignores single gold specks, but not a bright area the text actually sits on).
 */
async function backgroundContrast(page: Page, selector: string) {
  const el = page.locator(selector).first();
  const color = await el.evaluate((n) => getComputedStyle(n).color);
  const b = await box(el);
  const capture = async (css: string) => {
    const tag = await page.addStyleTag({ content: css });
    const png = await page.screenshot({ clip: b, animations: "disabled" });
    await tag.evaluate((n) => (n as Element).remove());
    return sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  };
  const bg = await capture(`${selector}, ${selector} * { color: transparent !important; }`);
  const ink = await capture(`${selector}, ${selector} * { color: #fff !important; text-shadow: none !important; }`);
  const { width: w, height: h, channels: ch } = bg.info;
  const lum = (d: Buffer, i: number) => luminance(d[i]!, d[i + 1]!, d[i + 2]!);

  const glyph = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (lum(ink.data, p * ch) - lum(bg.data, p * ch) > 0.15) glyph[p] = 1;
  const R = 3;
  const values: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let near = false;
      for (let dy = -R; dy <= R && !near; dy++) for (let dx = -R; dx <= R && !near; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < h && xx >= 0 && xx < w && glyph[yy * w + xx]) near = true;
      }
      if (near) values.push(lum(bg.data, (y * w + x) * ch));
    }
  }
  if (values.length === 0) throw new Error(`no glyph pixels found for ${selector}`);
  values.sort((a, c) => a - c);
  const background = values[Math.floor(values.length * 0.98)]!;
  const fg = luminance(...parseRgb(color));
  const [hi, lo] = fg > background ? [fg, background] : [background, fg];
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("homepage first screen (M1)", () => {
  test("loads without console errors or failed requests", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()}`));
    page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));
    await open(page);
    expect(problems).toEqual([]);
  });

  test("has the approved headline, description and call to action", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Moments Taste Better Here.");
    await expect(page.locator(".hero__title .t-accent")).toHaveText("Better");
    await expect(page.locator(".hero__lead")).toHaveText("Artisanal cakes, crafted with care for every celebration.");
    const cta = page.getByRole("link", { name: "Explore Cakes" });
    await expect(cta).toHaveAttribute("href", "/cakes/");
  });

  test("header: identity link and clearly unavailable menu/search controls", async ({ page }) => {
    await open(page);
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Baker’s 24 Pure Veg Cake Shop" })).toHaveAttribute("aria-current", "page");
    for (const name of ["Open menu", "Search cakes"]) {
      await expect(banner.getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
    }
  });

  test("skip link reaches the main content", async ({ page, browserName, isMobile }) => {
    test.skip(browserName === "webkit" && isMobile, "Mobile WebKit does not move focus with Tab");
    await open(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("labels the temporary hero image and gives it alt text", async ({ page }) => {
    await open(page);
    const figure = page.locator(".hero__cake");
    await expect(figure).toHaveAttribute("data-image-kind", "temporary");
    await expect(figure.getByText("Temporary image")).toBeVisible();
    await expect(figure.locator("img")).toHaveAttribute("alt", /chocolate cake/);
  });

  test("has no WCAG 2.2 A/AA violations (axe), both headline variants", async ({ page }) => {
    for (const path of [HOME, VARIANT]) {
      await open(page, path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.flatMap((v) => v.nodes.map((n) => `${path} ${v.id} → ${n.target.join(" ")}`));
      expect(summary).toEqual([]);
    }
  });

  for (const textSize of ["100%", "200%"]) {
  test(`text keeps AA contrast against the rendered atmosphere (text ${textSize})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    if (textSize !== "100%") await page.addStyleTag({ content: `html { font-size: ${textSize} !important; }` });
    const checks = [
      { selector: ".hero__line:nth-child(1)", min: 3, what: "headline line 1 (large text)" },
      { selector: ".hero__line:nth-child(2)", min: 3, what: "headline line 2 (large text)" },
      { selector: ".hero__line:nth-child(3)", min: 3, what: "headline line 3 (large text)" },
      { selector: ".hero__title .t-accent", min: 3, what: "“Better” accent (large text)" },
      { selector: ".hero__lead", min: 4.5, what: "description" },
      { selector: ".logo__word", min: 4.5, what: "wordmark" },
    ];
    for (const c of checks) {
      const ratio = await backgroundContrast(page, c.selector);
      test.info().annotations.push({ type: "contrast", description: `text ${textSize} · ${c.what}: ${ratio.toFixed(2)}:1 (needs ${c.min}:1)` });
      expect(ratio, `${c.what}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(c.min);
    }
  });
  }

  test("uses Libre Bodoni for the headline by default and Bodoni Moda only on the comparison page", async ({ page }) => {
    await open(page);
    expect(await page.locator(".hero__title").evaluate((n) => getComputedStyle(n).fontFamily)).toMatch(/^"?Libre Bodoni Variable/);
    expect(await page.evaluate(() => document.fonts.check('400 50px "Libre Bodoni Variable"', "Moments"))).toBe(true);
    await open(page, VARIANT);
    expect(await page.locator(".hero__title").evaluate((n) => getComputedStyle(n).fontFamily)).toMatch(/^"?Bodoni Moda Variable/);
    expect(await page.evaluate(() => document.fonts.check('500 50px "Bodoni Moda Variable"', "Moments"))).toBe(true);
  });

  test("controls meet the 44×44px tap target", async ({ page }) => {
    await open(page);
    for (const l of [page.getByRole("button", { name: "Open menu" }), page.getByRole("button", { name: "Search cakes" }), page.getByRole("link", { name: "Explore Cakes" })]) {
      const b = await box(l);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
  });

  for (const size of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    test(`layout holds at ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "horizontal scroll").toBeLessThanOrEqual(0);

      const title = await box(page.locator(".hero__title"));
      const lead = await box(page.locator(".hero__lead"));
      const cta = await box(page.getByRole("link", { name: "Explore Cakes" }));
      const cake = await box(page.locator(".hero__cake"));
      const header = await box(page.getByRole("banner"));

      expect(title.y, "headline clears the header").toBeGreaterThanOrEqual(header.y + header.height - 1);
      expect(title.x + title.width, "headline within viewport").toBeLessThanOrEqual(size.width);
      expect(lead.y + lead.height, "description stays above the cake").toBeLessThanOrEqual(cake.y);
      // The reference lets the cake tuck ~11px behind the button's lower edge; allow up to 16px.
      expect(cta.y + cta.height - cake.y, "button overlap with cake").toBeLessThanOrEqual(16);
    });
  }

  test("copy never collides with the cake at 200% text size", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const lead = await box(page.locator(".hero__lead"));
    const cta = await box(page.getByRole("link", { name: "Explore Cakes" }));
    const cake = await box(page.locator(".hero__cake"));
    expect(lead.y + lead.height).toBeLessThanOrEqual(cake.y);
    expect(cta.y + cta.height - cake.y).toBeLessThanOrEqual(16);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("honours reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    for (const sel of [".hero__cake", ".hero__petal"]) {
      expect(await page.locator(sel).evaluate((n) => getComputedStyle(n).animationName)).toBe("none");
    }
  });

  test("animates gently when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page);
    expect(await page.locator(".hero__cake").evaluate((n) => getComputedStyle(n).animationName)).not.toBe("none");
  });
});
