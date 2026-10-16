import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

// M1 covers the mobile first screen, M2 the rest of the mobile homepage; the desktop homepage is M5.
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
  await el.scrollIntoViewIfNeeded(); // below-the-fold sections: clips are viewport-relative
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

const SIZES = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

const DOORS = [
  { name: "Birthday Cakes", href: "/cakes/" },
  { name: "Custom Cakes", href: "/custom-cakes/" },
  { name: "Seasonal Delights", href: "/seasonal/" },
];

/** Every element with its own text below the hero whose box pokes past the viewport edges. */
async function textOutsideViewport(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".collections *, .site-footer *")) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (!ownText) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1) continue; // visually-hidden screen-reader text
      if (r.left < -0.5 || r.right > vw + 0.5 || el.scrollWidth > el.clientWidth + 1) out.push(`${el.className || el.tagName}: “${el.textContent!.trim().slice(0, 30)}” ${r.left.toFixed(0)}–${r.right.toFixed(0)}`);
    }
    return out;
  });
}

test.describe("homepage below the first screen (M2)", () => {
  test("ivory interlude: eyebrow, heading, description and call to action", async ({ page }) => {
    await open(page);
    const section = page.getByRole("region", { name: "For Every Beautiful Moment" });
    await expect(section).toHaveAttribute("data-surface", "ivory");
    await expect(section.getByRole("heading", { level: 2 })).toHaveAccessibleName("For Every Beautiful Moment");
    await expect(section.getByText("Our Cakes", { exact: true })).toBeVisible();
    await expect(section.locator(".collections__lead")).toHaveText(
      "From birthdays to anniversaries, custom creations to seasonal delights, find a cake that feels just right.",
    );
    await expect(section.getByRole("link", { name: "Explore Collection" })).toHaveAttribute("href", "/cakes/");
  });

  test("three collection doors in the reference order, each one link named by its title", async ({ page }) => {
    await open(page);
    const list = page.getByRole("list", { name: "Collections" });
    const items = list.getByRole("listitem");
    await expect(items).toHaveCount(3);
    for (const [i, door] of DOORS.entries()) {
      const item = items.nth(i);
      const link = item.getByRole("link");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAccessibleName(door.name);
      await expect(link).toHaveAttribute("href", door.href);
      await expect(item.getByRole("heading", { level: 3 })).toHaveAccessibleName(door.name);
    }
  });

  test("labels every temporary collection image and gives it alt text", async ({ page }) => {
    await open(page);
    const doors = page.locator(".door");
    await expect(doors).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const door = doors.nth(i);
      await expect(door).toHaveAttribute("data-image-kind", "temporary");
      await door.scrollIntoViewIfNeeded();
      await expect(door.getByText("Temporary image")).toBeVisible();
      expect((await door.locator("img").getAttribute("alt"))!.length).toBeGreaterThan(10);
    }
  });

  test("collection images load (lazily) without failures", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (r) => r.status() >= 400 && r.url().includes("/_astro/") && failed.push(r.url()));
    await open(page);
    for (const img of await page.locator(".door img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((n) => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0)).toBe(true);
    }
    expect(failed).toEqual([]);
  });

  test("landmarks: banner and footer outside the single main, which holds every section", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("main")).toHaveCount(1);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(main.getByRole("region", { name: "For Every Beautiful Moment" })).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    expect(await page.evaluate(() => !!document.querySelector("main footer, main header.site-header"))).toBe(false);
  });

  test("headings never skip a level", async ({ page }) => {
    await open(page);
    const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
  });

  test("footer: verified contact routes only, and the concept notice", async ({ page }) => {
    await open(page);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByText("A Little Cake")).toBeVisible();
    await expect(footer.getByRole("link", { name: "WhatsApp +91 90289 02800" })).toHaveAttribute("href", "https://wa.me/919028902800");
    await expect(footer.getByRole("link", { name: "Instagram @bakers24pcmc" })).toHaveAttribute("href", "https://www.instagram.com/bakers24pcmc/");
    await expect(footer.locator("address")).toContainText("Sadhu Vaswani Rd");
    await expect(footer).toContainText("Concept demonstration — products, prices and availability subject to confirmation.");
    // Unconfirmed in CONTENT.md: never shown.
    await expect(footer).not.toContainText(/hours|10:30|gmail|same-day|delivery/i);
  });

  test("adds no JavaScript to the page", async ({ page }) => {
    await open(page);
    expect(await page.locator("script").count()).toBe(0);
  });

  test("collection doors and footer links meet the 44×44px tap target", async ({ page }) => {
    await open(page);
    const targets = [page.getByRole("link", { name: "Explore Collection" }), ...DOORS.map((d) => page.getByRole("link", { name: d.name }))];
    targets.push(...(await page.getByRole("contentinfo").getByRole("link").all()));
    for (const l of targets) {
      const b = await box(l);
      const name = (await l.textContent())?.trim() ?? "";
      expect(b.height, name).toBeGreaterThanOrEqual(44);
      expect(b.width, name).toBeGreaterThanOrEqual(44);
    }
  });

  test("text keeps AA contrast on the ivory, the doors and the footer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const checks = [
      { selector: ".collections .t-eyebrow", min: 4.5, what: "ivory eyebrow" },
      { selector: ".collections__title", min: 4.5, what: "ivory heading" },
      { selector: ".collections__lead", min: 4.5, what: "ivory description" },
      { selector: ".collections__cta", min: 4.5, what: "Explore Collection label" },
      // Door titles are 28px: large text (3:1).
      { selector: ".door--birthday .door__title", min: 3, what: "Birthday Cakes title" },
      { selector: ".door--custom .door__title", min: 3, what: "Custom Cakes title" },
      { selector: ".door--seasonal .door__title", min: 3, what: "Seasonal Delights title" },
      { selector: ".door--birthday .door__label", min: 4.5, what: "temporary-image label" },
      { selector: ".site-footer__motto", min: 4.5, what: "footer motto" },
      { selector: ".site-footer__address", min: 4.5, what: "footer address" },
      { selector: ".site-footer__link", min: 4.5, what: "footer link" },
      { selector: ".site-footer__notice", min: 4.5, what: "concept notice" },
    ];
    for (const c of checks) {
      const ratio = await backgroundContrast(page, c.selector);
      test.info().annotations.push({ type: "contrast", description: `${c.what}: ${ratio.toFixed(2)}:1 (needs ${c.min}:1)` });
      expect(ratio, `${c.what}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(c.min);
    }
  });

  for (const size of SIZES) {
    test(`M2 layout holds at ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await open(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "horizontal scroll").toBeLessThanOrEqual(0);
      expect(await textOutsideViewport(page)).toEqual([]);

      // The ivory section starts exactly where the first screen ends, under the cake.
      const screen = await box(page.locator(".home-stage__screen"));
      const section = await box(page.locator(".collections"));
      expect(Math.abs(section.y - (screen.y + screen.height)), "section meets the bottom of the first screen").toBeLessThanOrEqual(1);
      expect(section.y, "first screen still fills the viewport").toBeGreaterThanOrEqual(size.height - 1);

      // Doors stack in one column, never overlapping, and alternate sides.
      const doors = await Promise.all([0, 1, 2].map((i) => box(page.locator(".door").nth(i))));
      for (let i = 1; i < doors.length; i++) expect(doors[i]!.y).toBeGreaterThanOrEqual(doors[i - 1]!.y + doors[i - 1]!.height);
      expect(doors[1]!.x + doors[1]!.width).toBeGreaterThan(doors[0]!.x + doors[0]!.width);
      for (const d of doors) expect(d.height / d.width, "tall portrait tiles").toBeGreaterThanOrEqual(1.2);
    });
  }

  for (const width of [320, 390]) {
    test(`M2 text reflows without clipping at 200% text size (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await open(page);
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await textOutsideViewport(page)).toEqual([]);
      // Titles stay inside their tiles.
      for (const d of await page.locator(".door").all()) {
        const tile = await box(d.locator(".door__frame"));
        const title = await box(d.locator(".door__title"));
        expect(title.x + title.width).toBeLessThanOrEqual(tile.x + tile.width);
        expect(title.y + title.height).toBeLessThanOrEqual(tile.y + tile.height);
      }
    });
  }

  test("M2 adds no motion when reduced motion is requested", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    for (const sel of [".door__img", ".door__arrow"]) {
      const durations = await page.locator(sel).first().evaluate((n) => getComputedStyle(n).transitionDuration);
      for (const d of durations.split(",")) expect(parseFloat(d)).toBeLessThan(0.02);
    }
    const animated = await page.locator(".collections *, .site-footer *").evaluateAll((els) => els.filter((e) => getComputedStyle(e).animationName !== "none").length);
    expect(animated).toBe(0);
  });
});
