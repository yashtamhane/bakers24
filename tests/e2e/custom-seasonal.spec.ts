import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import catalog from "../../CATALOG.json" with { type: "json" };

// M3 Stage 7: the /custom-cakes/ and /seasonal/ showcases. Names, order and prices are checked
// against CATALOG.json itself; qualifiers and notices against the approved wording.

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const names = (page: Page) => page.locator("main li .cake-card__name").allTextContents();
const prices = (page: Page) => page.locator("main li .price-note__price").allTextContents();
const qualifiers = (page: Page) => page.locator("main li .price-note__qualifier").allTextContents();

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

test.describe("custom cakes", () => {
  test("shows the seven examples in catalog order with reference quotes", async ({ page }) => {
    await open(page, "/custom-cakes/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Custom Cakes");
    const records = catalog.custom_design_examples;
    expect(await names(page)).toEqual(records.map((r) => r.name));
    expect(await prices(page)).toEqual(records.map((r) => inr(r.reference_price_inr)));
    expect(await qualifiers(page)).toEqual(
      records.map((r) => (r.weight_kg === null ? "Reference quote · size not recorded" : `Reference quote · ${r.weight_kg} kg`)),
    );
    await expect(page.getByText("Custom cakes are quoted individually by Baker’s 24.", { exact: false })).toBeVisible();
  });
});

test.describe("seasonal delights", () => {
  test("shows the eight records in catalog order with past reference prices", async ({ page }) => {
    await open(page, "/seasonal/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Seasonal Delights");
    const records = catalog.seasonal_examples;
    expect(await names(page)).toEqual(records.map((r) => r.name));
    expect(await prices(page)).toEqual(records.map((r) => inr(r.reference_price_inr)));
    expect(await qualifiers(page)).toEqual(
      records.map((r) => (r.size_note === null ? "Past reference price" : `Past reference price · ${r.size_note}`)),
    );
    await expect(page.getByText("not currently available unless Baker’s 24 confirms otherwise", { exact: false })).toBeVisible();
  });

  test("Mango Cake shows its half-kg size note", async ({ page }) => {
    await open(page, "/seasonal/");
    const mango = page.locator("main li").filter({ has: page.getByRole("heading", { name: "Mango Cake", exact: true }) });
    await expect(mango).toHaveCount(1);
    await expect(mango.locator(".price-note__price")).toHaveText("₹550");
    await expect(mango.locator(".price-note__qualifier")).toHaveText("Past reference price · half kg");
    await expect(mango).toBeVisible();
  });

  test("the two Half Rose Mango Cake records keep their own prices and the shared note", async ({ page }) => {
    await open(page, "/seasonal/");
    const rows = page.locator("main li").filter({ has: page.getByRole("heading", { name: "Half Rose Mango Cake", exact: true }) });
    await expect(rows).toHaveCount(2);
    expect(await rows.locator(".price-note__price").allTextContents()).toEqual(["₹600", "₹700"]);
    await expect(rows.locator(".cake-card__note")).toHaveText([
      "Two reference prices were recorded for this name; the difference between them has not been confirmed.",
      "Two reference prices were recorded for this name; the difference between them has not been confirmed.",
    ]);
    await expect(page.locator("main .cake-card__note")).toHaveCount(2);
  });
});

for (const path of ["/custom-cakes/", "/seasonal/"]) {
  test.describe(`${path} page rules`, () => {
    test("is static, text-only, noindex and has no ordering or offer language", async ({ page }) => {
      await open(page, path);
      await expect(page.locator("script")).toHaveCount(0);
      await expect(page.locator("main img")).toHaveCount(0);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
      await expect(page.locator("main li a, main li button")).toHaveCount(0); // records are not links
      const text = await page.locator("main").innerText();
      // Whole words: the approved seasonal notice says items "were offered in the past".
      expect(text).not.toMatch(/\b(bestseller|in stock|add to cart|order now|checkout|offers?|deals?|discounts?|delivery|valid till|limited time)\b/i);
    });

    test("links to WhatsApp without a pre-filled message and back to home", async ({ page }) => {
      await open(page, path);
      const whatsapp = page.locator('a[href^="https://wa.me/"]');
      for (const href of await whatsapp.evaluateAll((links) => links.map((a) => a.getAttribute("href")))) {
        expect(href).toBe("https://wa.me/919028902800");
      }
      await expect(page.getByRole("link", { name: /Ask Baker’s 24 on WhatsApp/ })).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    });

    test("has no axe violations", async ({ page }) => {
      await open(page, path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test("Mango Cake has no regular cake page", async ({ page }) => {
  const response = await page.goto("/cakes/mango-cake/");
  expect(response?.status()).toBe(404);
});
