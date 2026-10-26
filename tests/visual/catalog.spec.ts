// M3 review captures (run with `npm run shots`): /cakes/ with its Stage 6 filter states,
// representative cake pages, /custom-cakes/, /seasonal/, focused detail crops, and a full-page
// homepage regression set. Capture-only, like home.spec.ts: screenshots for human review and for
// pixel comparison outside the repository, never snapshot assertions or committed baselines.
// Before every capture the page must be ready (fonts loaded, every visible image decoded, the
// expected content present), so a screenshot never records a loading or half-filtered state.
// Enlarged text is simulated as in every M3 check: root font size 200%, not browser zoom.

import { expect, test, type Locator, type Page } from "@playwright/test";
import catalog from "../../CATALOG.json" with { type: "json" };
import { formatInr } from "../../src/lib/format";
import { customCakeNotice, regularCakeNotice, seasonalNotice } from "../../src/data/notices";

const OUT = `${process.env.SHOTS_DIR ?? ".reference-output/shots"}/m3`;

type Size = { width: number; height: number; text200?: boolean };
const sizeName = ({ width, height, text200 }: Size) => `${width}x${height}${text200 ? "-text200" : ""}`;

const PHONE_SMALL = { width: 320, height: 700 };
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** Open a page at a size, with reduced motion, and wait until it is fully rendered. */
async function open(page: Page, path: string, size: Size) {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  if (size.text200) {
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
  }
  await settle(page);
}

/** Fonts loaded, every visible image decoded, back at the top, pointer out of the way, no overflow. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.status), "fonts loaded").toBe("loaded");
  for (const img of await page.locator("img:visible").all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((n: HTMLImageElement) => n.decode());
    expect(await img.evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth > 0), "image decoded").toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "no horizontal overflow").toBeLessThanOrEqual(0);
}

const shoot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: "disabled", caret: "hide" });
const crop = (target: Locator, name: string) => target.screenshot({ path: `${OUT}/${name}.png`, animations: "disabled", caret: "hide" });
/** A crop with a margin around the element, so a focus ring drawn outside its box is not cut off. */
async function cropAround(page: Page, target: Locator, name: string, margin = 12) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const view = page.viewportSize()!;
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  const clip = { x, y, width: Math.min(view.width - x, box.width + 2 * margin), height: Math.min(view.height - y, box.height + 2 * margin) };
  await page.screenshot({ path: `${OUT}/${name}.png`, clip, animations: "disabled", caret: "hide" });
}

// ---------- /cakes/ ----------
const cakeList = (page: Page) => page.getByRole("list", { name: "All cakes" });
const cakeCard = (page: Page, name: string) => cakeList(page).locator(":scope > li").filter({ has: page.getByRole("heading", { name, exact: true }) });
const visibleNames = (page: Page) => cakeList(page).locator(":scope > li:visible .cake-card__name").allTextContents();
const regularNames = catalog.regular_cakes.map((c) => c.name);

test.describe("catalog", () => {
  const sizes: Size[] = [PHONE_SMALL, { width: 375, height: 812 }, PHONE, { width: 430, height: 932 }, { width: 768, height: 1024 }, DESKTOP, { ...PHONE_SMALL, text200: true }, { ...PHONE, text200: true }];
  for (const size of sizes) {
    test(`default @ ${sizeName(size)}`, async ({ page }) => {
      await open(page, "/cakes/", size);
      expect(await visibleNames(page), "all 23 cakes in catalog order").toEqual(regularNames);
      await expect(page.getByRole("status")).toHaveText("Showing all 23 cakes");
      await shoot(page, `catalog-default-${sizeName(size)}`);
    });
  }

  const states = [
    { name: "category-chocolate", category: "Chocolate", query: "" },
    { name: "search-truffle", category: "", query: "truffle" },
    { name: "category-chocolate-search-truffle", category: "Chocolate", query: "truffle" },
    { name: "empty-fruit-search-rasmalai", category: "Fruit", query: "rasmalai" },
  ];
  for (const state of states) {
    for (const size of [PHONE, { ...PHONE_SMALL, text200: true }]) {
      test(`${state.name} @ ${sizeName(size)}`, async ({ page }) => {
        await open(page, "/cakes/", size);
        let categoryNames = regularNames;
        if (state.category) {
          await page.getByRole("group", { name: "Category" }).getByRole("button", { name: state.category, exact: true }).click();
          categoryNames = await visibleNames(page);
          expect(categoryNames.length, `${state.category} has cakes`).toBeGreaterThan(0);
        }
        if (state.query) await page.getByLabel("Search by cake name").fill(state.query);
        // Expected result: names (from the catalog) matching the query, within the category.
        const expected = categoryNames.filter((n) => n.toLowerCase().includes(state.query));
        await expect.poll(() => visibleNames(page), "visible cards").toEqual(expected);
        if (state.query === "") expect(expected.length, "category result").toBeGreaterThan(0);
        await expect(page.getByRole("status")).toHaveText(`Showing ${expected.length} of 23 cakes`);
        if (expected.length === 0) await expect(page.getByText("Clear filters")).toBeVisible();
        await settle(page);
        await shoot(page, `catalog-${state.name}-${sizeName(size)}`);
      });
    }
  }

  test("crops: enlarged titles, price wording, illustrative label, focus", async ({ page }) => {
    // Stage 8a: the two corrected titles at 200% text, at the widths where they used to break.
    for (const width of [320, 375]) {
      await open(page, "/cakes/", { width, height: 800, text200: true });
      for (const [name, file] of [["Butterscotch", "butterscotch"], ["Hazelnut/Nutella Truffle", "hazelnut-nutella"]] as const) {
        await crop(cakeCard(page, name), `crop-catalog-title-${file}-${width}-text200`);
      }
    }
    await open(page, "/cakes/", PHONE);
    const pineapple = cakeCard(page, regularNames[0]!);
    await expect(pineapple.getByText("Illustrative image", { exact: true })).toBeVisible();
    await crop(pineapple, "crop-catalog-card-illustrative-pineapple-390");
    await crop(pineapple.locator(".price-note"), "crop-catalog-price-wording-pineapple-390");
    await expect(page.getByText(regularCakeNotice)).toBeVisible();
    await crop(page.locator(".catalog-intro"), "crop-catalog-notices-390");
    // Keyboard focus: Tab past skip link, Back, logo and header search to the search field, then a chip.
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    await expect(page.getByLabel("Search by cake name")).toBeFocused();
    await cropAround(page, page.getByLabel("Search by cake name"), "crop-catalog-focus-search-field-390");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Chocolate", exact: true })).toBeFocused();
    await cropAround(page, page.getByRole("button", { name: "Chocolate", exact: true }), "crop-catalog-focus-chip-390");
  });
});

// ---------- /cakes/ empty state: no mid-word breaks (Stage 8c r1) ----------
// The heading is measured, not just captured. Each word (a run of non-space characters: quotes and
// the full stop are attached, as they are when the line wraps) is a DOM Range; the word is split
// when its client rects lie on more than one line. Its unbroken width is measured in a nowrap span
// with the heading's font, so a word too wide for any line (emergency wrapping) is told apart from
// a word that would fit but was broken. Limitation: rects are compared by rounded top, so this
// detects line splits, not glyph overlap; it checks this heading only, in Chromium.
type HeadingWord = { word: string; lines: number; width: number };
async function headingWords(page: Page) {
  return page.locator("[data-filter-empty-text]").evaluate((heading) => {
    const words: HeadingWord[] = [];
    const probe = document.createElement("span");
    probe.style.whiteSpace = "nowrap";
    for (const node of [...heading.childNodes].filter((n): n is Text => n.nodeType === Node.TEXT_NODE)) {
      for (const m of node.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        words.push({ word: m[0], lines, width: 0 });
      }
    }
    heading.append(probe);
    for (const w of words) {
      probe.textContent = w.word;
      w.width = probe.getBoundingClientRect().width;
    }
    probe.remove();
    const box = heading.getBoundingClientRect();
    const textRange = document.createRange();
    textRange.selectNodeContents(heading);
    const textRight = Math.max(...[...textRange.getClientRects()].map((r) => r.right));
    return {
      words,
      contentWidth: box.width,
      fontSize: getComputedStyle(heading).fontSize,
      overflow: heading.scrollWidth - heading.clientWidth,
      textPastBox: textRight - box.right,
    };
  });
}

// Realistic empty results. `wholeFrom` is the narrowest viewport (with 200% text) from which the
// quoted search term must stay on one line; below it the term may wrap only if it is wider than
// the line itself. Measured targets with the 12cqi cap: 8-letter words fit from 320px, 9-letter
// words from 360px. The long unbroken string is never expected to fit (overflow resilience only).
const EMPTY_CASES = [
  // Unreachable through the controls (every category has cakes), so the server-rendered empty state
  // is revealed after choosing a category; its text is the category-only message.
  { name: "category-only", category: "Chocolate", query: "", reveal: true, text: "No cakes in the catalogue match these filters.", wholeFrom: 320 },
  { name: "search-only-tiramisu", category: "", query: "tiramisu", text: "No cake names in the catalogue match “tiramisu”.", wholeFrom: 320 },
  { name: "fruit-search-rasmalai", category: "Fruit", query: "rasmalai", text: "No Fruit cakes in the catalogue match “rasmalai”.", wholeFrom: 320 },
  { name: "chocolate-search-pineapple", category: "Chocolate", query: "pineapple", text: "No Chocolate cakes in the catalogue match “pineapple”.", wholeFrom: 360 },
  { name: "rasmalai-search-chocolate", category: "Rasmalai", query: "chocolate", text: "No Rasmalai cakes in the catalogue match “chocolate”.", wholeFrom: 360 },
  { name: "search-long-unbroken", category: "", query: "chocolatebutterscotchpineapplecheesecake", text: "No cake names in the catalogue match “chocolatebutterscotchpineapplecheesecake”.", wholeFrom: Infinity },
];
const EMPTY_SIZES: Size[] = [
  { width: 320, height: 800, text200: true },
  { width: 360, height: 800, text200: true },
  { width: 375, height: 812, text200: true },
  { width: 390, height: 844, text200: true },
  { width: 320, height: 700 },
  PHONE,
];

test.describe("catalog empty state", () => {
  for (const c of EMPTY_CASES) {
    for (const size of EMPTY_SIZES) {
      test(`${c.name} @ ${sizeName(size)}`, async ({ page }) => {
        await open(page, "/cakes/", size);
        if (c.category) await page.getByRole("group", { name: "Category" }).getByRole("button", { name: c.category, exact: true }).click();
        if (c.query) await page.getByLabel("Search by cake name").fill(c.query);
        const empty = page.locator("[data-filter-empty]");
        if (c.reveal) {
          await expect.poll(() => visibleNames(page), "the category alone has cakes").not.toEqual([]);
          await empty.evaluate((n: HTMLElement) => { n.hidden = false; });
        } else {
          await expect.poll(() => visibleNames(page), "no cards shown").toEqual([]);
          await expect(page.getByRole("status")).toHaveText("Showing 0 of 23 cakes");
        }
        await expect(empty).toBeVisible();
        await expect(page.locator("[data-filter-empty-text]")).toHaveText(c.text);
        await settle(page);

        const m = await headingWords(page);
        const term = c.query ? `“${c.query}”.` : undefined;
        expect(m.words.map((w) => w.word).join(" "), "measured every word").toBe(c.text);
        expect(m.overflow, "heading has no horizontal overflow").toBeLessThanOrEqual(0);
        expect(m.textPastBox, "no text drawn past the heading box").toBeLessThanOrEqual(0.5);
        for (const w of m.words.filter((w) => w.word !== term)) {
          expect.soft(w.lines, `"${w.word}" split across lines (${m.fontSize}, ${w.width.toFixed(1)} of ${m.contentWidth.toFixed(1)}px)`).toBe(1);
        }
        if (term) {
          const t = m.words.find((w) => w.word === term)!;
          const mustBeWhole = size.text200 ? size.width >= c.wholeFrom : c.wholeFrom !== Infinity;
          if (mustBeWhole) expect(t.lines, `search term ${term} split (${m.fontSize}, ${t.width.toFixed(1)} of ${m.contentWidth.toFixed(1)}px)`).toBe(1);
          else if (t.lines > 1) expect(t.width, `${term} broken although it fits a line`).toBeGreaterThan(m.contentWidth);
        }
        await crop(empty, `crop-catalog-empty-${c.name}-${sizeName(size)}`);
      });
    }
  }
});

// ---------- cake pages ----------
// Selected from the catalog by id: an illustrative image, a long text-only name, the slash name,
// and the widest single word. (No regular cake lacks a size, and Bento Cheesecake is a seasonal
// record; those are captured on /custom-cakes/ and /seasonal/, where they actually appear.)
const DETAIL_CASES = [
  { id: "cake-01", file: "illustrative" },
  { id: "cake-17", file: "text-only-long-title" },
  { id: "cake-09", file: "slash-title" },
  { id: "cake-19", file: "widest-word" },
];

test.describe("cake pages", () => {
  for (const { id, file } of DETAIL_CASES) {
    const cake = catalog.regular_cakes.find((c) => c.id === id)!;
    for (const size of [PHONE, DESKTOP, { ...PHONE_SMALL, text200: true }, { ...PHONE, text200: true }]) {
      test(`${cake.name} @ ${sizeName(size)}`, async ({ page }) => {
        await page.goto("/cakes/");
        const href = await cakeList(page).getByRole("link", { name: cake.name, exact: true }).getAttribute("href");
        await open(page, href!, size);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(cake.name);
        await expect(page.locator("main .price-note__price")).toHaveText(formatInr(cake.reference_price_inr));
        await shoot(page, `detail-${file}-${href!.split("/")[2]}-${sizeName(size)}`);
      });
    }
  }

  test("crops: detail title at 200% text and contact-link focus", async ({ page }) => {
    await page.goto("/cakes/");
    const href = await cakeList(page).getByRole("link", { name: "Hazelnut/Nutella Truffle", exact: true }).getAttribute("href");
    await open(page, href!, { ...PHONE_SMALL, text200: true });
    await crop(page.locator("main h1"), "crop-detail-slash-title-320-text200");
    await open(page, href!, PHONE);
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    await expect(page.getByRole("main").getByRole("link", { name: /^Ask Baker’s 24 on WhatsApp/ })).toBeFocused();
    await cropAround(page, page.locator("main .contact-link"), "crop-detail-focus-contact-link-390");
  });
});

// ---------- /custom-cakes/ and /seasonal/ ----------
const COLLECTIONS = [
  { file: "custom", path: "/custom-cakes/", list: "Past custom-cake examples", records: catalog.custom_design_examples.map((r) => r.name), notice: customCakeNotice },
  { file: "seasonal", path: "/seasonal/", list: "Past seasonal items", records: catalog.seasonal_examples.map((r) => r.name), notice: seasonalNotice },
];

for (const c of COLLECTIONS) {
  test.describe(c.file, () => {
    for (const size of [{ width: 375, height: 812 }, PHONE, DESKTOP, { ...PHONE_SMALL, text200: true }]) {
      test(`page @ ${sizeName(size)}`, async ({ page }) => {
        await open(page, c.path, size);
        const items = page.getByRole("list", { name: c.list }).locator(":scope > li");
        expect(await items.locator(".cake-card__name").allTextContents(), "records in catalog order").toEqual(c.records);
        await expect(page.locator("main img"), "text-only records").toHaveCount(0);
        await expect(page.getByText(c.notice)).toBeVisible();
        await shoot(page, `${c.file}-${sizeName(size)}`);
      });
    }
  });
}

const recordCard = (page: Page, list: string, name: string) => page.getByRole("list", { name: list }).locator(":scope > li").filter({ has: page.getByRole("heading", { name, exact: true }) });

test("crops: missing size (custom) and Mango Cake, Bento Cheesecake, Half Rose Mango Cake (seasonal)", async ({ page }) => {
  await open(page, "/custom-cakes/", PHONE);
  const ccHalf = recordCard(page, "Past custom-cake examples", "Cc Half");
  await expect(ccHalf.getByText("Reference quote · size not recorded")).toBeVisible();
  await crop(ccHalf, "crop-custom-missing-size-cc-half-390");

  const mango = catalog.seasonal_examples.find((r) => r.name === "Mango Cake")!;
  for (const size of [PHONE, { ...PHONE_SMALL, text200: true }, DESKTOP]) {
    await open(page, "/seasonal/", size);
    const card = recordCard(page, "Past seasonal items", mango.name);
    await expect(card.locator(".price-note__price")).toHaveText(formatInr(mango.reference_price_inr));
    await expect(card.locator(".price-note__qualifier")).toHaveText(`Past reference price · ${mango.size_note}`);
    await crop(card, `crop-seasonal-mango-cake-${sizeName(size)}`);
  }
  await open(page, "/seasonal/", PHONE);
  await expect(page.getByText(seasonalNotice)).toBeVisible();
  await shoot(page, "seasonal-mango-cake-first-screen-390x844", false);
  const bento = recordCard(page, "Past seasonal items", "Bento Cheesecake");
  await expect(bento.locator(".price-note__qualifier")).toHaveText("Past reference price");
  await crop(bento, "crop-seasonal-bento-cheesecake-390");
  const halfRose = recordCard(page, "Past seasonal items", "Half Rose Mango Cake");
  await expect(halfRose, "two separate Half Rose Mango Cake records").toHaveCount(2);
  for (const n of [0, 1]) await crop(halfRose.nth(n), `crop-seasonal-half-rose-mango-cake-${n + 1}-390`);
});

// ---------- homepage regression (M2 sizes) ----------
for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 375, height: 812 }, PHONE, { width: 430, height: 932 }]) {
  test(`homepage full @ ${sizeName(size)}`, async ({ page }) => {
    await open(page, "/", size);
    await shoot(page, `home-full-${sizeName(size)}`);
  });
}
