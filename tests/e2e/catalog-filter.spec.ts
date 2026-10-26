import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// M3 Stage 6: search and category filtering on /cakes/. Card content is covered elsewhere;
// these tests check only the filter behaviour and its accessibility.

const CAKES = "/cakes/";

async function open(page: Page, path = CAKES) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

const list = (page: Page) => page.getByRole("list", { name: "All cakes" });
const visibleNames = (page: Page) => list(page).locator("li:visible .cake-card__name").allTextContents();
const search = (page: Page) => page.getByLabel("Search by cake name");
const chip = (page: Page, name: string) => page.getByRole("group", { name: "Category" }).getByRole("button", { name, exact: true });
const status = (page: Page) => page.getByRole("status");
const chips = (page: Page) => page.locator(".catalog-filter .chip");

/** Pause each chip transition the moment it is created, so slow engines cannot finish it unsampled. */
const holdChipTransitions = (page: Page) =>
  page.evaluate(() =>
    document.addEventListener("transitionrun", (event) => {
      const el = event.target as Element;
      if (el.matches(".catalog-filter .chip")) for (const a of el.getAnimations()) a.pause();
    }, true),
  );
/** Length in ms of the longest transition currently running on any chip (0 when none is). */
const chipTransitionMs = (page: Page) =>
  chips(page).evaluateAll((els) => Math.max(0, ...els.flatMap((el) => el.getAnimations().map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0)))));
/** Pause every running chip transition at `ms` from its start (Web Animations API). */
const freezeChips = (page: Page, ms: number) =>
  chips(page).evaluateAll((els, t) => {
    for (const el of els) for (const a of el.getAnimations()) { a.pause(); a.currentTime = t; }
  }, ms);
const finishChips = (page: Page) => chips(page).evaluateAll((els) => els.forEach((el) => el.getAnimations().forEach((a) => a.finish())));

test.describe("catalog filter", () => {
  test("starts with all 23 cakes and All selected", async ({ page }) => {
    await open(page);
    await expect(list(page).locator("li:visible")).toHaveCount(23);
    await expect(status(page)).toHaveText("Showing all 23 cakes");
    await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();
  });

  test("search ignores case and surrounding spaces", async ({ page }) => {
    await open(page);
    await search(page).fill("  RED velvet ");
    expect(await visibleNames(page)).toEqual(["Red Velvet Truffle", "Red Velvet"]);
    await expect(status(page)).toHaveText("Showing 2 of 23 cakes");
  });

  test("category and search combine with AND, in catalog order", async ({ page }) => {
    await open(page);
    await chip(page, "Chocolate").click();
    await expect(chip(page, "Chocolate")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "false");
    await expect(status(page)).toHaveText("Showing 8 of 23 cakes");
    expect((await visibleNames(page))[0]).toBe("Choco Walnut Truffle"); // catalog order, not curated order
    await search(page).fill("truffle");
    expect(await visibleNames(page)).toEqual(["Choco Walnut Truffle", "Choco Truffle"]);
    await expect(status(page)).toHaveText("Showing 2 of 23 cakes");
  });

  test("empty state explains the result and Clear filters restores everything", async ({ page }) => {
    await open(page);
    await chip(page, "Fruit").click();
    await search(page).fill("rasmalai");
    await expect(list(page).locator("li:visible")).toHaveCount(0);
    await expect(page.getByText("No Fruit cakes in the catalogue match “rasmalai”.")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/unavailable|out of stock|sold out/i);
    await expect(status(page)).toHaveText("Showing 0 of 23 cakes");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(search(page)).toBeFocused();
    await expect(search(page)).toHaveValue("");
    await expect(list(page).locator("li:visible")).toHaveCount(23);
    await expect(status(page)).toHaveText("Showing all 23 cakes");
  });

  test("Reset restores all 23 cakes in their original order", async ({ page }) => {
    await open(page);
    const original = await visibleNames(page);
    await chip(page, "Truffle").click();
    await search(page).fill("roasted");
    await page.getByRole("button", { name: "Reset filters" }).click();
    expect(await visibleNames(page)).toEqual(original);
    await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "true");
    // Focus is checked after keyboard activation: WebKit, like Safari, does not focus a button on a
    // mouse click, but a keyboard user's focus must stay on Reset in every engine.
    for (const key of ["Enter", "Space"]) {
      await chip(page, "Truffle").click();
      await search(page).fill("roasted");
      await page.getByRole("button", { name: "Reset filters" }).focus();
      await page.keyboard.press(key);
      expect(await visibleNames(page), `${key} restores the list`).toEqual(original);
      await expect(search(page)).toHaveValue("");
      await expect(page.getByRole("button", { name: "Reset filters" }), `${key} keeps focus on Reset`).toBeFocused();
    }
  });

  test("hidden cards leave the Tab order; chips work from the keyboard", async ({ page, browserName }) => {
    await open(page);
    await chip(page, "Rasmalai").focus();
    await page.keyboard.press("Enter");
    await expect(chip(page, "Rasmalai")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reset filters" }).focus();
    await page.keyboard.press("Space");
    await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "true");
    await chip(page, "Rasmalai").click();
    const hiddenLinks = list(page).locator("li[hidden] a");
    await expect(hiddenLinks).toHaveCount(23 - (await visibleNames(page)).length);
    const focusable = await hiddenLinks.evaluateAll((links) => links.filter((a) => ((a as HTMLElement).focus(), document.activeElement === a)).length);
    expect(focusable, "links in hidden cards cannot take focus, even programmatically").toBe(0);
    await page.getByRole("button", { name: "Reset filters" }).focus();
    // WebKit, like Safari, moves between links with Alt+Tab (Option+Tab); Tab alone skips them.
    const nextLink = browserName === "webkit" ? "Alt+Tab" : "Tab";
    const reached: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press(nextLink);
      reached.push(await page.evaluate(() => (document.activeElement as HTMLAnchorElement).getAttribute("href") ?? ""));
    }
    expect(reached.slice(0, 2)).toEqual(["/cakes/plain-rasmalai/", "/cakes/premium-rasmalai/"]);
    expect(reached[2]).not.toMatch(/^\/cakes\//);
  });

  test("the selected category is restored when returning from a cake page", async ({ page }) => {
    await open(page);
    await chip(page, "Fruit").click();
    await expect(page).toHaveURL(/\/cakes\/\?category=fruit$/);
    await list(page).getByRole("link", { name: "Blueberry" }).click();
    await expect(page).toHaveURL(/\/cakes\/blueberry\/$/);
    await page.goBack();
    await expect(chip(page, "Fruit")).toHaveAttribute("aria-pressed", "true");
    expect(await visibleNames(page)).toEqual(["Pineapple", "Blueberry", "Mixed Fruit Exotic"]);
  });

  test("an unknown category parameter falls back to All", async ({ page }) => {
    await open(page, "/cakes/?category=birthday");
    await expect(chip(page, "All")).toHaveAttribute("aria-pressed", "true");
    await expect(list(page).locator("li:visible")).toHaveCount(23);
  });

  test("no axe violations while filtered or empty", async ({ page }) => {
    await open(page);
    await chip(page, "Truffle").click();
    let results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
    await search(page).fill("zzz");
    results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
  });

  test("chip text keeps AA contrast throughout the selection transition, not only once settled", async ({ page }) => {
    await open(page);
    // Select Truffle (it fills while All empties), then All again. Each time, every chip transition
    // is held as it starts, then paused at points across its length; colour contrast is checked there.
    await holdChipTransitions(page);
    for (const name of ["Truffle", "All"]) {
      await chip(page, name).click();
      const length = await chipTransitionMs(page);
      for (let i = 0; i <= 10; i++) {
        const at = Math.round((length * i) / 10);
        await freezeChips(page, at);
        const results = await new AxeBuilder({ page }).include(".catalog-filter").withRules(["color-contrast"]).analyze();
        expect.soft(results.violations, `${name} selected, chip transitions paused at ${at} of ${length}ms`).toEqual([]);
      }
      await finishChips(page);
    }
  });
});

test.describe("catalog without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("shows all 23 cakes and hides the filter controls", async ({ page }) => {
    await page.goto(CAKES);
    await expect(list(page).locator("li:visible")).toHaveCount(23);
    await expect(page.getByLabel("Search by cake name")).toBeHidden();
    await expect(page.getByRole("group", { name: "Category" })).toBeHidden();
  });
});
