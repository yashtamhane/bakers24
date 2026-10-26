import { describe, expect, it } from "vitest";
import {
  ALL,
  emptyMessage,
  matchesFilter,
  normalizeQuery,
  statusMessage,
  type FilterState,
} from "../../src/components/catalog/catalog-filter";
import { collections } from "../../src/data/collections";
import { productCake, productCollections, products } from "../../src/data/products";

// The catalog as the filter sees it: name and collection ids per card, in list order.
const cards = products.map((p) => ({ id: p.id, name: productCake(p).name, categories: productCollections(p).map((c) => c.id) }));
const run = (state: FilterState) => cards.filter((c) => matchesFilter(c.name, c.categories, state)).map((c) => c.id);

describe("catalog filter (M3 Stage 6)", () => {
  it("ignores case, surrounding whitespace and repeated inner spaces in the search text", () => {
    expect(normalizeQuery("  Red   VELVET ")).toBe("red velvet");
    const expected = run({ query: "red velvet", category: ALL });
    expect(expected).toEqual(["cake-03", "cake-21"]); // Red Velvet Truffle, Red Velvet (catalog order)
    for (const query of ["RED VELVET", "  red velvet  ", "Red  Velvet", "\tred velvet\n"]) {
      expect(run({ query, category: ALL }), JSON.stringify(query)).toEqual(expected);
    }
  });

  it("shows every cake for an empty or blank search with All selected", () => {
    for (const query of ["", "   "]) expect(run({ query, category: ALL })).toEqual(products.map((p) => p.id));
  });

  it("matches part of a name, including across the slash in Hazelnut/Nutella Truffle", () => {
    expect(run({ query: "nutella", category: ALL })).toEqual(["cake-09"]);
    expect(run({ query: "hazelnut/nut", category: ALL })).toEqual(["cake-09"]);
  });

  it("each category returns exactly its audited members, in catalog order rather than curated order", () => {
    for (const collection of collections) {
      const members = new Set(collection.members.map((m) => m.id));
      const inCatalogOrder = products.map((p) => p.id).filter((id) => members.has(id));
      expect(run({ query: "", category: collection.id }), collection.id).toEqual(inCatalogOrder);
    }
  });

  it("combines search and category with AND logic", () => {
    expect(run({ query: "truffle", category: "chocolate" })).toEqual(["cake-05", "cake-12"]);
    expect(run({ query: "choco", category: "truffle" })).toEqual(["cake-05", "cake-12"]);
    expect(run({ query: "rasmalai", category: "fruit" })).toEqual([]);
  });

  it("reports counts in the approved form", () => {
    expect(statusMessage(23, 23)).toBe("Showing all 23 cakes");
    expect(statusMessage(6, 23)).toBe("Showing 6 of 23 cakes");
    expect(statusMessage(0, 23)).toBe("Showing 0 of 23 cakes");
  });

  it("explains an empty result without implying that any cake is unavailable", () => {
    const messages = [
      emptyMessage({ query: "  lemon ", category: ALL }, undefined),
      emptyMessage({ query: "rasmalai", category: "fruit" }, "Fruit"),
      emptyMessage({ query: "", category: "fruit" }, "Fruit"),
    ];
    expect(messages[0]).toBe("No cake names in the catalogue match “lemon”.");
    expect(messages[1]).toBe("No Fruit cakes in the catalogue match “rasmalai”.");
    for (const message of messages) expect(message).not.toMatch(/unavailable|out of stock|sold out|in stock|available/i);
  });
});
