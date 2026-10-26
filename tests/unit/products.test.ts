import { describe, expect, it } from "vitest";
import { business } from "../../src/data/business";
import { customExamples, regularCakes, seasonalExamples } from "../../src/data/catalog";
import { collections } from "../../src/data/collections";
import { images } from "../../src/data/images";
import {
  customCakeNotice,
  customQuoteNote,
  duplicateSeasonalNameNote,
  duplicateSeasonalNames,
  illustrativeImageNotice,
  photographPending,
  regularCakeNotice,
  regularPriceNote,
  seasonalNotice,
  seasonalPriceNote,
  whatsappLinkLabel,
} from "../../src/data/notices";
import { getProductBySlug, productCake, productCollections, productImage, products, RESERVED_SLUGS } from "../../src/data/products";

// The approved M3 mapping: catalog id → slug, and the three illustrative images (R3/R4, D5).
const APPROVED = [
  ["cake-01", "pineapple", "productPineapple"],
  ["cake-02", "roasted-cashew-truffle", "productRoastedCashewTruffle"],
  ["cake-03", "red-velvet-truffle", "productRedVelvetTruffle"],
  ["cake-04", "plain-rasmalai"],
  ["cake-05", "choco-walnut-truffle"],
  ["cake-06", "rose-gulkand"],
  ["cake-07", "roasted-almond-truffle"],
  ["cake-08", "melted-ferrero-rocher"],
  ["cake-09", "hazelnut-nutella-truffle"],
  ["cake-10", "nutty-choco"],
  ["cake-11", "oreo-cream"],
  ["cake-12", "choco-truffle"],
  ["cake-13", "choco-vanilla"],
  ["cake-14", "kitkat-cake-cream"],
  ["cake-15", "premium-rasmalai"],
  ["cake-16", "choco-chips-cream"],
  ["cake-17", "belgium-chocolate-premium"],
  ["cake-18", "choco-overload-cream"],
  ["cake-19", "butterscotch"],
  ["cake-20", "blueberry"],
  ["cake-21", "red-velvet"],
  ["cake-22", "black-forest"],
  ["cake-23", "mixed-fruit-exotic"],
] as const;

// Words that would turn a historical reference price into a sales claim.
const PROMOTIONAL = /\b(offer|deal|promo(tion)?|combo|discount|sale|limited|valid|bestseller|in stock|available now|order now|delivery)\b|\b2 for\b/i;

describe("product mapping", () => {
  it("maps all 23 regular cakes, in catalog order", () => {
    expect(products).toHaveLength(23);
    expect(products.map((p) => p.id)).toEqual(regularCakes.map((c) => c.id));
  });

  it("uses exactly the approved slugs and images", () => {
    expect(products.map((p) => [p.id, p.slug, ...(p.image ? [p.image] : [])])).toEqual(APPROVED.map((row) => [...row]));
  });

  it("keeps slugs unique, lowercase, hyphenated and clear of reserved routes", () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(RESERVED_SLUGS, slug).not.toContain(slug);
    }
    expect(RESERVED_SLUGS).toEqual(["birthday", "custom-cakes", "seasonal", "index"]);
  });

  it("stores no catalog fields itself: names, weights and prices come from CATALOG.json", () => {
    for (const p of products) {
      expect(Object.keys(p).every((k) => ["id", "slug", "image"].includes(k)), p.id).toBe(true);
      expect(productCake(p), p.id).toBe(regularCakes.find((c) => c.id === p.id));
    }
    // Spot checks against the supplied data (unchanged by M3).
    expect(productCake(getProductBySlug("pineapple")!)).toMatchObject({ name: "Pineapple", weight: "0.5 kg", reference_price_inr: 380 });
    expect(productCake(getProductBySlug("hazelnut-nutella-truffle")!).name).toBe("Hazelnut/Nutella Truffle");
    expect(productCake(getProductBySlug("belgium-chocolate-premium")!)).toMatchObject({ name: "Belgium Chocolate Premium", reference_price_inr: 600 });
  });

  it("keeps Red Velvet and Red Velvet Truffle as distinct products", () => {
    expect(productCake(getProductBySlug("red-velvet")!).name).toBe("Red Velvet");
    expect(productCake(getProductBySlug("red-velvet-truffle")!).name).toBe("Red Velvet Truffle");
  });

  it("finds products by slug, and nothing for unknown or reserved slugs", () => {
    for (const p of products) expect(getProductBySlug(p.slug)).toBe(p);
    for (const slug of ["birthday", "seasonal", "belgium-dark-chocolate", ""]) expect(getProductBySlug(slug)).toBeUndefined();
  });
});

describe("product images", () => {
  it("gives exactly three cakes an illustrative image and leaves the other 20 text-only", () => {
    const withImage = products.filter((p) => productImage(p));
    expect(withImage.map((p) => p.id)).toEqual(["cake-01", "cake-02", "cake-03"]);
    expect(products.filter((p) => !productImage(p))).toHaveLength(20);
  });

  it("keeps the rejected crops out: Plain Rasmalai, Melted Ferrero Rocher, Choco Walnut Truffle and Belgium Chocolate Premium are text-only", () => {
    for (const id of ["cake-04", "cake-08", "cake-05", "cake-17"]) {
      const p = products.find((x) => x.id === id)!;
      expect(p.image, id).toBeUndefined();
      expect(productImage(p), id).toBeUndefined();
    }
  });

  it("only uses registered images labelled “Illustrative image”", () => {
    const registered = new Set<unknown>(Object.values(images));
    for (const p of products.filter((x) => x.image)) {
      const img = productImage(p)!;
      expect(registered.has(img), p.id).toBe(true);
      expect(img.label, p.id).toBe("Illustrative image");
      expect(img.kind, p.id).toBe("temporary");
    }
  });
});

describe("product filter groups", () => {
  it("derive membership from the audited collections, unchanged", () => {
    for (const p of products) {
      const expected = collections.filter((c) => c.members.some((m) => m.id === p.id)).map((c) => c.id);
      expect(productCollections(p).map((c) => c.id), p.id).toEqual(expected);
    }
  });

  it("match the approved counts: Chocolate 8, Fruit 3, Truffle 6, Rasmalai 2; six cakes in no group", () => {
    const count = (id: string) => products.filter((p) => productCollections(p).some((c) => c.id === id)).length;
    expect({ chocolate: count("chocolate"), fruit: count("fruit"), truffle: count("truffle"), rasmalai: count("rasmalai") }).toEqual({
      chocolate: 8,
      fruit: 3,
      truffle: 6,
      rasmalai: 2,
    });
    const ungrouped = products.filter((p) => productCollections(p).length === 0).map((p) => p.id);
    expect(ungrouped).toEqual(["cake-06", "cake-11", "cake-14", "cake-19", "cake-21", "cake-22"]);
  });

  it("never leaves a filter group empty", () => {
    for (const c of collections) expect(products.some((p) => productCollections(p).includes(c)), c.id).toBe(true);
  });
});

describe("price and availability notices", () => {
  it("use the approved wording exactly", () => {
    expect(regularCakeNotice).toBe(
      "Reference prices come from an earlier Baker’s 24 WhatsApp catalogue. Please confirm current prices and availability directly with Baker’s 24.",
    );
    expect(customCakeNotice).toBe(
      "Custom cakes are quoted individually by Baker’s 24. These past examples show reference quotes only; please confirm price and availability directly with Baker’s 24.",
    );
    expect(seasonalNotice).toBe(
      "These seasonal items were offered in the past and are not currently available unless Baker’s 24 confirms otherwise.",
    );
    expect(illustrativeImageNotice).toBe("Images marked ‘Illustrative image’ are concept artwork, not photographs of Baker’s 24 cakes.");
    expect(duplicateSeasonalNameNote).toBe("Two reference prices were recorded for this name; the difference between them has not been confirmed.");
    expect(photographPending).toBe("Photograph to come");
    expect(whatsappLinkLabel).toBe("Ask Baker’s 24 on WhatsApp");
  });

  it("label every regular cake price as a reference price at its supplied weight", () => {
    for (const cake of regularCakes) expect(regularPriceNote(cake), cake.id).toBe("Reference price · 0.5 kg");
  });

  it("label custom examples as reference quotes, keeping missing sizes and the supplied “Cc Half” name", () => {
    const byName = (name: string) => customExamples.find((c) => c.name === name)!;
    expect(customQuoteNote(byName("Mermaid"))).toBe("Reference quote · 1.5 kg");
    expect(customQuoteNote(byName("Custom"))).toBe("Reference quote · 3 kg");
    expect(customQuoteNote(byName("Cc Half"))).toBe("Reference quote · size not recorded");
    expect(customQuoteNote(byName("Anniversary Couple"))).toBe("Reference quote · size not recorded");
    expect(customExamples.map((c) => c.name)).toContain("Cc Half");
  });

  it("label seasonal records as past reference prices, with the supplied size note only where one exists", () => {
    const mango = seasonalExamples.find((s) => s.name === "Mango Cake")!;
    expect(seasonalPriceNote(mango)).toBe("Past reference price · half kg");
    const bento = seasonalExamples.find((s) => s.name === "Bento Cheesecake")!;
    expect(bento.reference_price_inr).toBe(399);
    expect(seasonalPriceNote(bento)).toBe("Past reference price");
    for (const s of seasonalExamples) expect(seasonalPriceNote(s), s.id).toMatch(/^Past reference price( · .+)?$/);
  });

  it("keep both Half Rose Mango Cake records, each with its own price", () => {
    expect([...duplicateSeasonalNames(seasonalExamples)]).toEqual(["Half Rose Mango Cake"]);
    const halfRose = seasonalExamples.filter((s) => s.name === "Half Rose Mango Cake");
    expect(halfRose.map((s) => [s.id, s.reference_price_inr])).toEqual([
      ["seasonal-03", 600],
      ["seasonal-04", 700],
    ]);
  });

  it("make no promotional or availability claims", () => {
    const texts = [
      regularCakeNotice,
      customCakeNotice,
      seasonalNotice,
      illustrativeImageNotice,
      duplicateSeasonalNameNote,
      photographPending,
      whatsappLinkLabel,
      ...regularCakes.map(regularPriceNote),
      ...customExamples.map(customQuoteNote),
      ...seasonalExamples.map(seasonalPriceNote),
    ];
    for (const text of texts) expect(text).not.toMatch(PROMOTIONAL);
  });

  it("pair the WhatsApp label with the existing plain link (no pre-filled message)", () => {
    expect(business.whatsapp.href).toBe("https://wa.me/919028902800");
    expect(business.whatsapp.href).not.toContain("?");
  });
});
