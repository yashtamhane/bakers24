import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import catalog from "../../CATALOG.json" with { type: "json" };
import { business } from "../../src/data/business";
import { formatInr } from "../../src/lib/format";
import { illustrativeImageNotice, photographPending, regularCakeNotice, regularPriceNote } from "../../src/data/notices";

// M3 Stage 8b: /cakes/ routes, content, JavaScript, commerce wording, accessibility and layout.
// Names, prices and wording come from CATALOG.json and the approved data modules, never from a
// copy. Filter behaviour already covered by catalog-filter.spec.ts is not repeated here; this file
// adds the gaps (query-parameter scope, live region, page-specific JavaScript, layout).

type RegularCake = Parameters<typeof regularPriceNote>[0];
const cakes = catalog.regular_cakes as RegularCake[];
const CAKES = "/cakes/";
/** Approved decisions R3/R4: the only three cakes with an illustrative image. */
const ILLUSTRATIVE_IDS = ["cake-01", "cake-02", "cake-03"];
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** Active-commerce, availability-promise and promotional wording that must never appear. */
const PROHIBITED = /\b(bestsellers?|best seller|in stock|out of stock|sold out|available now|now available|add to (cart|bag)|cart|checkout|buy now|order now|order online|place (an )?order|offers?|deals?|discounts?|promo(tion)?s?|combo|delivery|deliver|valid till|limited time|hurry|countdown|ends soon|favou?rites?)\b/i;

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
async function open(page: Page, path = CAKES) {
  const response = await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  return response;
}

const cards = (page: Page) => page.getByRole("list", { name: "All cakes" }).locator(":scope > li");
const visibleCards = (page: Page) => page.getByRole("list", { name: "All cakes" }).locator(":scope > li:visible");
const chip = (page: Page, name: string) => page.getByRole("group", { name: "Category" }).getByRole("button", { name, exact: true });
const search = (page: Page) => page.getByLabel("Search by cake name");

/** Enlarged text the way every earlier M3 check did it: root font size 200%, not browser zoom. */
async function enlargeText(page: Page) {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
}

/** Heading levels in document order, and whether any level is skipped going down. */
const headingOutline = (page: Page) =>
  page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => Number(h.tagName[1]));
    return { levels, h1: levels.filter((l) => l === 1).length, skips: levels.some((l, i) => i > 0 && l > levels[i - 1]! + 1) };
  });

/** Page overflow, text outside the viewport, and words split across lines (a "/" counts as a break). */
const layout = (page: Page, wordsIn: string) =>
  page.evaluate((selector) => {
    const vw = document.documentElement.clientWidth;
    const outside: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || !el.checkVisibility() || el.closest(".skip-link, .visually-hidden")) continue;
      const row = el.closest(".chip-group"); // a sideways-scrolling chip row clips its own content
      if (row && getComputedStyle(row).flexWrap !== "wrap") continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5)) outside.push(n.textContent.trim().slice(0, 24));
    }
    const split: string[] = [];
    for (const el of document.querySelectorAll(selector)) {
      if (!el.checkVisibility()) continue;
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

// ---------- routes and navigation ----------
test.describe("catalog routes", () => {
  test("/cakes/ responds, is noindex and has the catalog heading", async ({ page }) => {
    const response = await open(page);
    expect(response?.status(), "/cakes/ status").toBe(200);
    await expect(page).toHaveTitle("Our Cakes · Baker’s 24 (concept proposal)");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Our Cakes");
  });

  test("the 23 card links resolve, and are the only cake detail routes built", async ({ page, request }) => {
    await open(page);
    const hrefs = await cards(page).locator("a").evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs, "one link per regular cake").toHaveLength(cakes.length);
    expect(new Set(hrefs).size, "card links are unique").toBe(cakes.length);
    for (const href of hrefs) {
      expect(href, "detail link shape").toMatch(/^\/cakes\/[a-z0-9]+(-[a-z0-9]+)*\/$/);
      expect((await request.get(href)).status(), `${href} status`).toBe(200);
    }
    // The build output holds exactly these routes under /cakes/ (the webServer builds before tests).
    const built = fs.readdirSync(new URL("../../dist/cakes/", import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `/cakes/${d.name}/`);
    expect(built.sort(), "built /cakes/<slug>/ routes equal the 23 card links").toEqual([...hrefs].sort());
  });

  test("no unapproved product routes exist", async ({ request }) => {
    for (const path of ["/cakes/mango-cake/", "/cakes/half-rose-mango-cake/", "/cakes/belgium-dark-chocolate/", "/cakes/birthday/", "/custom-cakes/mermaid/", "/seasonal/mango-cake/"]) {
      expect((await request.get(path)).status(), `${path} must not exist`).toBe(404);
    }
  });

  test("homepage links and the custom and seasonal collections resolve", async ({ page, request }) => {
    await open(page, "/");
    const internal = await page.locator('a[href^="/"]').evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href") ?? ""))]);
    for (const path of ["/cakes/", "/custom-cakes/", "/seasonal/"]) expect(internal, `homepage links to ${path}`).toContain(path);
    for (const href of internal) expect((await request.get(href)).status(), `homepage link ${href}`).toBe(200);
  });
});

// ---------- content ----------
test.describe("catalog content", () => {
  test("shows the 23 regular cakes in catalog order with their reference prices", async ({ page }) => {
    await open(page);
    await expect(cards(page)).toHaveCount(cakes.length);
    const rows = await cards(page).evaluateAll((lis) =>
      lis.map((li) => ({
        id: li.id,
        href: li.querySelector("a")?.getAttribute("href"),
        name: li.querySelector(".cake-card__name")?.textContent,
        price: li.querySelector(".price-note__price")?.textContent,
        qualifier: li.querySelector(".price-note__qualifier")?.textContent,
      })),
    );
    rows.forEach((row, i) => {
      const cake = cakes[i]!;
      expect(row.name, `card ${i + 1} name`).toBe(cake.name);
      expect(row.price, `${cake.name} price`).toBe(formatInr(cake.reference_price_inr));
      expect(row.qualifier, `${cake.name} qualifier`).toBe(regularPriceNote(cake));
      expect(row.href, `${cake.name} link matches its list item`).toBe(`/cakes/${row.id.replace("cake-item-", "")}/`);
    });
    for (const cake of cakes) await expect(page.getByRole("link", { name: cake.name, exact: true }), `${cake.name} link name`).toHaveCount(1);
  });

  test("three illustrative images and 20 text-only placeholders, with the approved notices", async ({ page }) => {
    await open(page);
    const illustrative = cakes.filter((c) => ILLUSTRATIVE_IDS.includes(c.id)).map((c) => c.name);
    const rows = await cards(page).evaluateAll((lis) =>
      lis.map((li) => ({
        name: li.querySelector(".cake-card__name")?.textContent,
        label: li.querySelector(".cake-card__label")?.textContent,
        alt: li.querySelector("img")?.getAttribute("alt") ?? null,
        pending: li.querySelector(".cake-card__pending")?.textContent ?? null,
      })),
    );
    expect(rows.filter((r) => r.label === "Illustrative image").map((r) => r.name), "illustrative images").toEqual(illustrative);
    for (const r of rows.filter((x) => x.label)) expect(r.alt, `${r.name} alt text`).toBeTruthy();
    expect(rows.filter((r) => r.pending === photographPending), "text-only placeholders").toHaveLength(cakes.length - illustrative.length);
    expect(rows.filter((r) => r.pending !== null).every((r) => r.alt === null), "placeholders carry no image").toBe(true);
    const notices = await page.locator(".catalog-intro__notice").allTextContents();
    expect(notices, "catalog notices").toEqual([regularCakeNotice, illustrativeImageNotice]);
  });

  test("makes no ordering, availability or promotional claims; WhatsApp is the plain link", async ({ page }) => {
    await open(page);
    const text = await page.locator("main").innerText();
    expect(text, "the approved price wording is present").toContain("Reference price");
    expect(text.match(PROHIBITED), "prohibited wording in /cakes/").toBeNull();
    await expect(page.locator("main [class*=heart], main [aria-label*=avourite i], main input[type=number], main select, main form[action]"), "no hearts, quantity, size or order controls").toHaveCount(0);
    const whatsapp = await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    expect(whatsapp.length, "at least the footer WhatsApp link").toBeGreaterThan(0);
    for (const href of whatsapp) expect(href, "WhatsApp link, no prefilled message").toBe(business.whatsapp.href);
  });
});

// ---------- JavaScript and filtering gaps ----------
test.describe("catalog JavaScript", () => {
  test("only /cakes/ ships a script: one inline module, no external scripts", async ({ request }) => {
    const scripts = async (path: string) => {
      const html = await (await request.get(path)).text();
      return [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1] ?? "");
    };
    const onCakes = await scripts(CAKES);
    expect(onCakes, "/cakes/ scripts").toHaveLength(1);
    expect(onCakes[0], "the filter is an inline module script").toMatch(/type="module"/);
    expect(onCakes[0], "no external script").not.toMatch(/\ssrc=/);
    for (const path of ["/", "/custom-cakes/", "/seasonal/", "/cakes/pineapple/", "/cakes/belgium-chocolate-premium/"]) {
      expect(await scripts(path), `${path} has no script`).toEqual([]);
    }
  });

  test("search text stays out of the URL; only the category is kept", async ({ page }) => {
    await open(page);
    await search(page).fill("truffle");
    await expect(page.getByRole("status")).toHaveText(/^Showing \d+ of 23 cakes$/);
    expect(new URL(page.url()).search, "no search parameter").toBe("");
    await chip(page, "Chocolate").click();
    expect([...new URL(page.url()).searchParams.keys()], "only the category parameter").toEqual(["category"]);
    await expect(search(page)).toHaveValue("truffle");
  });

  test("every category's count equals its visible cards, in catalog order", async ({ page }) => {
    await open(page);
    const status = page.getByRole("status");
    const order = cakes.map((c) => c.name);
    for (const name of ["Chocolate", "Fruit", "Truffle", "Rasmalai", "All"]) {
      await chip(page, name).click();
      const visible = await visibleCards(page).locator(".cake-card__name").allTextContents();
      await expect(status, `${name} status`).toHaveText(name === "All" ? "Showing all 23 cakes" : `Showing ${visible.length} of 23 cakes`);
      expect(visible.length, `${name} shows at least one cake`).toBeGreaterThan(0);
      expect(visible, `${name} keeps catalog order`).toEqual(order.filter((n) => visible.includes(n)));
    }
  });

  test("the header search icon stays unavailable, as approved (D7)", async ({ page }) => {
    await open(page);
    const searchIcon = page.getByRole("banner").getByRole("button", { name: "Search cakes" });
    await expect(searchIcon).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("banner").getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });
});

// ---------- accessibility ----------
test.describe("catalog accessibility", () => {
  test("no axe violations unfiltered; one h1 and no skipped heading levels", async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
    const outline = await headingOutline(page);
    expect(outline.h1, "exactly one h1").toBe(1);
    expect(outline.skips, `heading levels ${outline.levels.join(",")}`).toBe(false);
  });

  test("Tab order, visible focus and 44px targets for the filter controls", async ({ page, browserName, isMobile }) => {
    test.skip(browserName === "webkit" && isMobile, "Mobile WebKit does not move focus with Tab");
    await open(page);
    const expected = ["Skip to content", "Back to home", "Baker’s 24", "Search cakes", "Search by cake name", "All", "Chocolate", "Fruit", "Truffle", "Rasmalai", "Reset filters", cakes[0]!.name];
    for (const name of expected) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused, `Tab reaches “${name}”`).toHaveAccessibleName(name);
      // Elements with `transition: all` animate the outline for 0.01ms under reduced motion: poll.
      await expect.poll(() => focused.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)), `${name} focus outline`).toBeGreaterThanOrEqual(2);
    }
    const controls = page.locator(".catalog-filter__input, .catalog-filter .chip, .catalog-filter__reset");
    for (const box of await controls.evaluateAll((els) => els.map((e) => [e.textContent?.trim() || "search field", e.getBoundingClientRect().width, e.getBoundingClientRect().height] as const))) {
      expect(Math.min(box[1], box[2]), `${box[0]} target size`).toBeGreaterThanOrEqual(44);
    }
  });

  test("honours reduced motion on the filter chips", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    const durations = await page.locator(".catalog-filter .chip").first().evaluate((el) => getComputedStyle(el).transitionDuration.split(",").map(parseFloat));
    expect(Math.max(...durations), "chip transition under reduced motion").toBeLessThanOrEqual(0.0001);
  });
});

// ---------- responsive layout and enlarged text ----------
// Viewports are set explicitly, so these run once per engine (mobile projects), not again on desktop.
test.describe("catalog layout", () => {
  test.skip(({ isMobile }) => !isMobile, "explicit-viewport layout checks run in the mobile projects only");

  for (const width of [320, 375, 390, 430]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      expect((await layout(page, ".cake-card__name")).overflow, `${width}px overflow`).toBeLessThanOrEqual(0);
    });
  }

  for (const width of [320, 375, 390, 430]) {
    test(`200% text at ${width}px: text contained, card titles never split mid-word`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      await enlargeText(page);
      const result = await layout(page, ".cake-card__name");
      expect(result.overflow, "page overflow").toBeLessThanOrEqual(0);
      if (width === 320 || width === 390) expect(result.outside, "text outside the viewport").toEqual([]);
      expect(result.split, "card-title words split across lines (Stage 8a)").toEqual([]);
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
