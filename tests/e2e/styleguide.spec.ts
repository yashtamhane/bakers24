import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL = "/_styleguide/";

async function open(page: Page) {
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
}

test.describe("style guide", () => {
  test("loads without console errors or failed requests", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && problems.push(`console: ${msg.text()}`));
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
    page.on("requestfailed", (req) => problems.push(`requestfailed: ${req.url()}`));
    page.on("response", (res) => res.status() >= 400 && problems.push(`${res.status()}: ${res.url()}`));
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Baker’s 24 style guide" })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("is excluded from search indexing", async ({ page }) => {
    await open(page);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("has no WCAG 2.2 A/AA violations (axe)", async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const summary = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} → ${n.target.join(" ")}: ${n.failureSummary?.split("\n")[1]?.trim() ?? v.help}`));
    expect(summary).toEqual([]);
  });

  test("loads the two chosen font families", async ({ page }) => {
    await open(page);
    const loaded = await page.evaluate(() => ({
      display: document.fonts.check('400 40px "Libre Bodoni Variable"', "Moments"),
      italic: document.fonts.check('italic 400 40px "Libre Bodoni Variable"', "Love"),
      ui: document.fonts.check('400 16px "DM Sans Variable"', "Explore"),
      rupee: document.fonts.check('400 40px "Libre Bodoni Variable"', "₹"),
    }));
    expect(loaded).toEqual({ display: true, italic: true, ui: true, rupee: true });
  });

  test("renders ₹ prices in the display serif, not a fallback", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CSS.getPlatformFontsForNode is a Chromium DevTools API");
    await open(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".specimen .t-price" });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    expect(fonts.map((f) => f.familyName)).toEqual([expect.stringMatching(/^Libre Bodoni/)]);
  });

  test("buttons, icon buttons and chips meet the 44×44px tap target", async ({ page }) => {
    await open(page);
    const small = await page.locator("main").evaluate((main) =>
      [...main.querySelectorAll<HTMLElement>(".button, .icon-button, .chip")]
        .map((el) => ({ name: el.getAttribute("aria-label") ?? el.textContent?.trim(), rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width < 44 || rect.height < 44)
        .map(({ name, rect }) => `${name}: ${rect.width.toFixed(0)}×${rect.height.toFixed(0)}`),
    );
    expect(small).toEqual([]);
  });

  test("other interactive elements meet WCAG 2.2 target size (24×24)", async ({ page }) => {
    await open(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("a[href], button, summary, [tabindex='0']")]
        .map((el) => ({ name: el.textContent?.trim().slice(0, 30), rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.width < 24 || rect.height < 24))
        .map(({ name, rect }) => `${name}: ${rect.width.toFixed(0)}×${rect.height.toFixed(0)}`),
    );
    expect(small).toEqual([]);
  });

  test("shows a visible focus ring for keyboard users", async ({ page, browserName, isMobile }) => {
    test.skip(browserName === "webkit" && isMobile, "Mobile WebKit does not move focus with Tab");
    await open(page);
    const button = page.locator(".button--primary").first();
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    const outline = await button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth };
    });
    expect(outline).toEqual({ style: "solid", width: "2px" });
  });

  test("chips are single-select toggles operable from the keyboard", async ({ page }) => {
    await open(page);
    const group = page.getByRole("group", { name: "Filter cakes" });
    const all = group.getByRole("button", { name: "All" });
    const chocolate = group.getByRole("button", { name: "Chocolate" });
    await expect(all).toHaveAttribute("aria-pressed", "true");
    await chocolate.focus();
    await page.keyboard.press("Enter");
    await expect(chocolate).toHaveAttribute("aria-pressed", "true");
    await expect(all).toHaveAttribute("aria-pressed", "false");
    await all.focus();
    await page.keyboard.press("Space");
    await expect(all).toHaveAttribute("aria-pressed", "true");
  });

  test("chip labels come from the curated collections in reference order", async ({ page }) => {
    await open(page);
    const labels = await page.getByRole("group", { name: "Filter cakes" }).getByRole("button").allTextContents();
    expect(labels.map((l) => l.trim())).toEqual(["All", "Chocolate", "Fruit", "Truffle", "Rasmalai"]);
  });

  test("favourite toggle exposes its state", async ({ page }) => {
    await open(page);
    const heart = page.getByRole("button", { name: "Save to favourites" });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await heart.click();
    await expect(page.getByRole("button", { name: "Saved to favourites" }).first()).toHaveAttribute("aria-pressed", "true");
  });

  test("never scrolls horizontally, down to 320px", async ({ page }) => {
    for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(0);
    }
  });

  test("honours reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    const duration = await page.locator(".button--primary").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration.split(",").every((d) => parseFloat(d) <= 0.01)).toBe(true);
  });
});
