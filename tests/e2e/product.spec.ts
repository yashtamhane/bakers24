import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import catalog from "../../CATALOG.json" with { type: "json" };
import { business } from "../../src/data/business";
import { formatInr } from "../../src/lib/format";
import { illustrativeImageNotice, photographPending, regularCakeNotice, regularPriceNote, whatsappLinkLabel } from "../../src/data/notices";

// M3 Stage 8b: the 23 regular cake pages at /cakes/<slug>/ (Stage 5 Revision 2, Stage 8a).
// Each page is reached through its card link on /cakes/, so the name → route mapping is tested
// too; names, prices and wording come from CATALOG.json and the approved data modules.

type RegularCake = Parameters<typeof regularPriceNote>[0];
const cakes = catalog.regular_cakes as RegularCake[];
/** Approved decisions R3/R4: the only three cakes with an illustrative image. */
const ILLUSTRATIVE_IDS = ["cake-01", "cake-02", "cake-03"];
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** Active-commerce, availability-promise and promotional wording that must never appear. */
const PROHIBITED = /\b(bestsellers?|best seller|in stock|out of stock|sold out|available now|now available|add to (cart|bag)|cart|checkout|buy now|order now|order online|place (an )?order|offers?|deals?|discounts?|promo(tion)?s?|combo|delivery|deliver|valid till|limited time|hurry|countdown|ends soon|favou?rites?)\b/i;
/** Representative pages: two illustrative, a long text-only name, the slash name, the widest word. */
const REPRESENTATIVE = ["pineapple", "red-velvet-truffle", "belgium-chocolate-premium", "hazelnut-nutella-truffle", "butterscotch"];

// ---------- console and network guard ----------
// Every test fails on a console error, page error, failed request or HTTP status ≥ 400.
// One exception only: the known, separately tracked favicon 404 (decision D9). The site's own
// /favicon.ico answered with HTTP 404 is tolerated, whether seen as that response or as the
// browser's console message about it ("… status of 404 …", located at that URL). Anything else
// about a favicon (a 500, an aborted request, another origin) and every other failure is reported.
const isSiteFavicon = (url: string, siteOrigin: string) => {
  try {
    const u = new URL(url);
    return u.origin === siteOrigin && u.pathname === "/favicon.ico";
  } catch {
    return false;
  }
};
const knownFavicon404 = {
  response: (url: string, status: number, siteOrigin: string) => status === 404 && isSiteFavicon(url, siteOrigin),
  console: (text: string, url: string, siteOrigin: string) => isSiteFavicon(url, siteOrigin) && /\bstatus of 404\b/.test(text),
};

/** Start recording problems on a page; the returned array fills as events arrive. */
function watch(page: Page, siteOrigin: string): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !knownFavicon404.console(m.text(), m.location().url, siteOrigin)) problems.push(`console: ${m.text()} (${m.location().url})`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !knownFavicon404.response(r.url(), r.status(), siteOrigin)) problems.push(`${r.status()}: ${r.url()}`);
  });
  return problems;
}

const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page, baseURL }, use) => {
      const problems = watch(page, new URL(baseURL!).origin);
      await use();
      expect(problems, "console errors, page errors, failed requests or HTTP errors (only the site's /favicon.ico 404 is tolerated, D9)").toEqual([]);
    },
    { auto: true },
  ],
});

// ---------- helpers ----------
async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  return response;
}

/** The detail route for a cake, read from its card link on /cakes/. */
async function routeFor(page: Page, name: string) {
  await open(page, "/cakes/");
  const href = await page.getByRole("list", { name: "All cakes" }).getByRole("link", { name, exact: true }).getAttribute("href");
  expect(href, `${name}: card link`).toMatch(/^\/cakes\/[a-z0-9]+(-[a-z0-9]+)*\/$/);
  return href!;
}

/** Enlarged text the way every earlier M3 check did it: root font size 200%, not browser zoom. */
async function enlargeText(page: Page) {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
}

/** Page overflow, text outside the viewport, and words split across lines (a "/" counts as a break). */
const layout = (page: Page, wordsIn: string) =>
  page.evaluate((selector) => {
    const vw = document.documentElement.clientWidth;
    const outside: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || !el.checkVisibility() || el.closest(".skip-link, .visually-hidden")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5)) outside.push(n.textContent.trim().slice(0, 24));
    }
    const split: string[] = [];
    for (const el of document.querySelectorAll(selector)) {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const text = n.textContent ?? "";
        let from = 0;
        for (const word of text.split(/[\s/]+/).filter(Boolean)) {
          const start = text.indexOf(word, from);
          from = start + word.length;
          const range = document.createRange();
          range.setStart(n, start);
          range.setEnd(n, from);
          const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
          if (lines.size > 1) split.push(word);
        }
      }
    }
    return { overflow: document.documentElement.scrollWidth - vw, outside, split };
  }, wordsIn);

// ---------- every regular cake page ----------
test.describe("cake detail pages", () => {
  for (const cake of cakes) {
    const illustrative = ILLUSTRATIVE_IDS.includes(cake.id);

    test(`${cake.id} ${cake.name}: route, content, contact and accessibility`, async ({ page }) => {
      const href = await routeFor(page, cake.name);
      const response = await open(page, href);
      expect(response?.status(), `${href} status`).toBe(200);

      // Document and headings.
      await expect(page).toHaveTitle(`${cake.name} · Baker’s 24 (concept proposal)`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
      await expect(page.getByRole("heading", { level: 1 }), "exactly one h1, the catalog name").toHaveText(cake.name);
      const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
      expect(levels.filter((l) => l === 1), "one h1").toHaveLength(1);
      expect(levels.some((l, i) => i > 0 && l > levels[i - 1]! + 1), `heading levels ${levels.join(",")}`).toBe(false);

      // Historical reference price and its qualifier (all regular cakes are 0.5 kg).
      const price = page.locator("main .price-note");
      await expect(price.locator(".price-note__price")).toHaveText(formatInr(cake.reference_price_inr));
      await expect(price.locator(".price-note__qualifier")).toHaveText(regularPriceNote(cake));

      // Image treatment.
      const media = page.locator("main .detail-page__media");
      if (illustrative) {
        await expect(media).toHaveAttribute("data-image-kind", "temporary");
        await expect(media.locator("img"), "illustrative image alt text").toHaveAttribute("alt", /\S/);
        await expect(media.getByText("Illustrative image", { exact: true })).toBeVisible();
        const width = await media.evaluate((el) => el.getBoundingClientRect().width / parseFloat(getComputedStyle(document.documentElement).fontSize));
        expect(width, "image capped at 16rem").toBeLessThanOrEqual(16.01);
      } else {
        await expect(page.locator("main img"), "text-only page has no image").toHaveCount(0);
        await expect(media.getByText(photographPending, { exact: true })).toBeVisible();
      }

      // Notices: the reference-price notice always; the image notice only with an image.
      await expect(page.locator("main .detail-page__notice")).toHaveText(illustrative ? [regularCakeNotice, illustrativeImageNotice] : [regularCakeNotice]);

      // Contact and navigation.
      const contact = page.getByRole("main").getByRole("link", { name: new RegExp(`^${whatsappLinkLabel}`) });
      await expect(contact).toHaveCount(1);
      await expect(contact).toHaveAccessibleName(`${whatsappLinkLabel} ${business.whatsapp.display}`);
      for (const link of await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")))) {
        expect(link, "WhatsApp link, no prefilled message").toBe(business.whatsapp.href);
      }
      await expect(page.getByRole("link", { name: "Back to all cakes" })).toHaveAttribute("href", "/cakes/");

      // No commerce, no scripts, no structured data.
      expect((await page.locator("main").innerText()).match(PROHIBITED), "prohibited wording").toBeNull();
      await expect(page.locator("main form, main input, main select, main button, main [class*=heart]"), "no order, quantity or favourite controls").toHaveCount(0);
      await expect(page.locator("script"), "no client-side script").toHaveCount(0);

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), "axe").toEqual([]);
    });
  }

  test("Hazelnut/Nutella Truffle keeps its <wbr> after the slash, and its exact name", async ({ page }) => {
    const cake = cakes.find((c) => c.name.includes("/"))!;
    await open(page, await routeFor(page, cake.name));
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText(cake.name);
    expect(await h1.evaluate((el) => el.querySelector("wbr")?.previousSibling?.textContent?.endsWith("/")), "<wbr> follows the slash").toBe(true);
  });

  test("Mango Cake and other non-regular records have no cake page", async ({ request }) => {
    for (const path of ["/cakes/mango-cake/", "/cakes/half-rose-mango-cake/", "/cakes/mermaid/"]) {
      expect((await request.get(path)).status(), `${path} must not exist`).toBe(404);
    }
  });
});

// ---------- keyboard, focus, targets, motion ----------
test.describe("cake detail keyboard and motion", () => {
  for (const slug of ["pineapple", "belgium-chocolate-premium"]) {
    test(`/cakes/${slug}/: Tab order, visible focus and 44px targets`, async ({ page, browserName, isMobile }) => {
      test.skip(browserName === "webkit" && isMobile, "Mobile WebKit does not move focus with Tab");
      await open(page, `/cakes/${slug}/`);
      const expected = ["Skip to content", "Back to all cakes", "Baker’s 24", "Search cakes", `${whatsappLinkLabel} ${business.whatsapp.display}`];
      for (const name of expected) {
        await page.keyboard.press("Tab");
        const focused = page.locator(":focus");
        await expect(focused, `Tab reaches “${name}”`).toHaveAccessibleName(name);
        await expect.poll(() => focused.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)), `${name} focus outline`).toBeGreaterThanOrEqual(2);
        if (name !== "Skip to content") {
          const box = await focused.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height]);
          expect(Math.min(...box), `${name} target size`).toBeGreaterThanOrEqual(44);
        }
      }
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus"), "after the contact link, focus moves into the footer").toHaveCount(1);
      expect(await page.locator(":focus").evaluate((el) => !!el.closest("footer")), "next stop is in the footer").toBe(true);
    });
  }

  test("honours reduced motion on the contact link", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/cakes/pineapple/");
    const durations = await page.locator("main .contact-link").evaluate((el) => getComputedStyle(el).transitionDuration.split(",").map(parseFloat));
    expect(Math.max(...durations), "contact-link transition under reduced motion").toBeLessThanOrEqual(0.0001);
  });
});

// ---------- responsive layout and enlarged text ----------
// Viewports are set explicitly, so these run once per engine (mobile projects), not again on desktop.
test.describe("cake detail layout", () => {
  test.skip(({ isMobile }) => !isMobile, "explicit-viewport layout checks run in the mobile projects only");

  test("no horizontal overflow at 320, 375, 390 and 430px", async ({ page }) => {
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      for (const slug of REPRESENTATIVE) {
        await open(page, `/cakes/${slug}/`);
        expect((await layout(page, "main h1")).overflow, `/cakes/${slug}/ at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  for (const width of [320, 390]) {
    test(`200% text at ${width}px: all 23 pages contained, no word split mid-word`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, "/cakes/");
      const hrefs = await page.getByRole("list", { name: "All cakes" }).locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      for (const href of hrefs) {
        await open(page, href);
        await enlargeText(page);
        const result = await layout(page, "main h1, main .price-note, main .detail-page__notice, main .contact-link");
        expect(result.overflow, `${href} overflow`).toBeLessThanOrEqual(0);
        expect(result.outside, `${href} text outside the viewport`).toEqual([]);
        expect(result.split, `${href} words split across lines`).toEqual([]);
      }
    });
  }

  for (const width of [375, 430]) {
    test(`200% text at ${width}px: representative pages keep whole words`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const slug of REPRESENTATIVE) {
        await open(page, `/cakes/${slug}/`);
        await enlargeText(page);
        const result = await layout(page, "main h1, main .contact-link");
        expect(result.overflow, `/cakes/${slug}/ overflow`).toBeLessThanOrEqual(0);
        expect(result.split, `/cakes/${slug}/ words split across lines`).toEqual([]);
      }
    });
  }
});


// ---------- the guard itself ----------
test.describe("console and network guard", () => {
  test("tolerates only the site's favicon 404; reports favicon 500s, aborts, other errors and exceptions", async ({ browser, baseURL }) => {
    const site = new URL(baseURL!).origin;
    const message = (status: string) => `Failed to load resource: the server responded with a status of ${status}`;

    // The rules on their own.
    expect(knownFavicon404.response(`${site}/favicon.ico`, 404, site), "site favicon 404 response").toBe(true);
    expect(knownFavicon404.response(`${site}/favicon.ico`, 500, site), "site favicon 500 response").toBe(false);
    expect(knownFavicon404.response(`${site}/cakes/missing/`, 404, site), "other 404 response").toBe(false);
    expect(knownFavicon404.response("http://example.test/favicon.ico", 404, site), "another origin's favicon 404").toBe(false);
    expect(knownFavicon404.console(message("404 (Not Found)"), `${site}/favicon.ico`, site), "site favicon 404 message").toBe(true);
    expect(knownFavicon404.console(message("500 (Internal Server Error)"), `${site}/favicon.ico`, site), "site favicon 500 message").toBe(false);
    expect(knownFavicon404.console(message("404 (Not Found)"), `${site}/cakes/missing/`, site), "other 404 message").toBe(false);

    // The same rules on a live page, in its own context so this test's own guard stays clean.
    // Chromium never hands /favicon.ico requests to Playwright routing, so a second local server
    // (node:http, ephemeral port) produces real favicon failures: a 500, a 404 and a dropped connection.
    const server = http.createServer((req, res) => {
      if (req.url === "/favicon.ico?abort") return void req.socket.destroy();
      res.writeHead(req.url === "/favicon.ico?404" ? 404 : 500, { "Access-Control-Allow-Origin": "*" }).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const other = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      const problems = watch(page, site);
      await page.goto("/cakes/");
      const fetchStatus = (url: string) => page.evaluate((u) => fetch(u, { cache: "no-store" }).then((r) => r.status, () => -1), url);
      // Events arrive in order: once a marker logged afterwards is recorded, earlier events are too.
      let step = 0;
      const settle = async () => {
        const marker = `guard-marker-${++step}`;
        await page.evaluate((m) => console.error(m), marker);
        await expect.poll(() => problems.some((p) => p.includes(marker))).toBe(true);
        const found = problems.filter((p) => !p.includes("guard-marker-"));
        problems.length = 0;
        return found;
      };

      expect(await fetchStatus("/favicon.ico"), "the site's real favicon request is a 404").toBe(404);
      expect(await settle(), "the site's favicon 404 is tolerated").toEqual([]);

      expect(await fetchStatus(`${other}/favicon.ico`)).toBe(500);
      // Chromium reports favicon requests only through the console, never as network events.
      expect(await settle(), "a favicon 500 is reported").toEqual(expect.arrayContaining([expect.stringMatching(/\b500\b.*\/favicon\.ico/)]));

      expect(await fetchStatus(`${other}/favicon.ico?404`)).toBe(404);
      expect(await settle(), "another origin's favicon 404 is reported").toEqual(expect.arrayContaining([expect.stringMatching(/\b404\b.*\/favicon\.ico\?404/)]));

      expect(await fetchStatus(`${other}/favicon.ico?abort`)).toBe(-1);
      expect(await settle(), "a failed favicon request is reported").toEqual(expect.arrayContaining([expect.stringMatching(/\/favicon\.ico\?abort/)]));

      expect(await fetchStatus("/cakes/no-such-cake/")).toBe(404);
      expect(await settle(), "any other 404 is reported").toEqual(expect.arrayContaining([`404: ${site}/cakes/no-such-cake/`]));

      await page.evaluate(() => setTimeout(() => { throw new Error("guard-probe exception"); }, 0));
      await page.evaluate(() => console.error("guard-probe console error"));
      const reported = await settle();
      expect(reported, "page errors are reported").toEqual(expect.arrayContaining([expect.stringMatching(/^pageerror: guard-probe exception/)]));
      expect(reported, "other console errors are reported").toEqual(expect.arrayContaining([expect.stringMatching(/^console: guard-probe console error/)]));
    } finally {
      await context.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
