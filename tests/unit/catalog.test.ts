import { describe, expect, it } from "vitest";
import raw from "../../CATALOG.json";
import { catalog, customExamples, regularCakes, seasonalExamples, unpricedMentions } from "../../src/data/catalog";
import { CatalogSchema } from "../../src/data/schema";

const clone = () => structuredClone(raw) as Record<string, any>;

describe("CATALOG.json", () => {
  it("validates against the strict schema", () => {
    expect(() => CatalogSchema.parse(raw)).not.toThrow();
  });

  it("preserves the expected record counts", () => {
    expect(regularCakes).toHaveLength(23);
    expect(customExamples).toHaveLength(7);
    expect(seasonalExamples).toHaveLength(8);
    expect(unpricedMentions).toEqual(["Tiramisu Tres Leches", "Lotus Biscoff Cheesecake", "Lotus Biscoff Tres Leches"]);
  });

  it("keeps prices flagged as unverified reference values", () => {
    expect(catalog.metadata.prices_verified_current).toBe(false);
  });

  it("lists every regular cake at 0.5 kg with a whole-rupee price", () => {
    for (const cake of regularCakes) {
      expect(cake.weight).toBe("0.5 kg");
      expect(Number.isInteger(cake.reference_price_inr)).toBe(true);
    }
  });

  it("keeps supplied names and prices exactly (spot checks against the source)", () => {
    const byId = Object.fromEntries(regularCakes.map((c) => [c.id, c]));
    expect(byId["cake-01"]).toMatchObject({ name: "Pineapple", reference_price_inr: 380 });
    expect(byId["cake-08"]).toMatchObject({ name: "Melted Ferrero Rocher", reference_price_inr: 750 });
    expect(byId["cake-17"]).toMatchObject({ name: "Belgium Chocolate Premium", reference_price_inr: 600 });
  });

  it("keeps the ambiguous records as supplied", () => {
    const halfRose = seasonalExamples.filter((s) => s.name === "Half Rose Mango Cake").map((s) => s.reference_price_inr);
    expect(halfRose.sort()).toEqual([600, 700]);
    expect(customExamples.find((c) => c.name === "Cc Half")?.weight_kg).toBeNull();
    expect(customExamples.find((c) => c.name === "Anniversary Couple")?.weight_kg).toBeNull();
  });

  it("rejects invented fields such as category, ingredients or allergens", () => {
    for (const field of ["category", "ingredients", "allergens"]) {
      const data = clone();
      data.regular_cakes[0][field] = "made up";
      expect(() => CatalogSchema.parse(data), field).toThrow();
    }
  });

  it("rejects a catalog that claims verified prices", () => {
    const data = clone();
    data.metadata.prices_verified_current = true;
    expect(() => CatalogSchema.parse(data)).toThrow();
  });

  it("rejects duplicate ids", () => {
    const data = clone();
    data.regular_cakes[1].id = data.regular_cakes[0].id;
    expect(() => CatalogSchema.parse(data)).toThrow(/Duplicate id/);
  });

  it("rejects a regular cake listed at another weight", () => {
    const data = clone();
    data.regular_cakes[0].weight = "1 kg";
    expect(() => CatalogSchema.parse(data)).toThrow();
  });
});
