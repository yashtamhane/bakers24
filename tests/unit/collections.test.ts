import { describe, expect, it } from "vitest";
import { regularCakes } from "../../src/data/catalog";
import { collectionCakes, collections } from "../../src/data/collections";

// Words that justify a "name" basis for each collection. A name-basis member must contain one.
const NAME_WORDS: Record<string, RegExp> = {
  chocolate: /choco/i,
  fruit: /fruit|pineapple|blueberry/i,
  truffle: /truffle/i,
  rasmalai: /rasmalai/i,
};

describe("curated collections", () => {
  it("match the reference chip order", () => {
    expect(collections.map((c) => c.label)).toEqual(["Chocolate", "Fruit", "Truffle", "Rasmalai"]);
  });

  it("reference only existing regular cakes, without duplicates", () => {
    const known = new Set(regularCakes.map((c) => c.id));
    for (const collection of collections) {
      const ids = collection.members.map((m) => m.id);
      expect(new Set(ids).size, collection.id).toBe(ids.length);
      for (const id of ids) expect(known.has(id), `${collection.id}: ${id}`).toBe(true);
      expect(() => collectionCakes(collection.id)).not.toThrow();
    }
  });

  it("only mark a member as name-based when its name really contains the collection word", () => {
    for (const collection of collections) {
      const word = NAME_WORDS[collection.id];
      expect(word, `no name rule for ${collection.id}`).toBeDefined();
      for (const cake of collectionCakes(collection.id)) {
        const member = collection.members.find((m) => m.id === cake.id)!;
        if (member.basis === "name") expect(cake.name, collection.id).toMatch(word!);
      }
    }
  });

  it("supports explicit curation beyond name matching (Ferrero Rocher in Chocolate)", () => {
    const chocolate = collections.find((c) => c.id === "chocolate")!;
    expect(chocolate.members[0]).toEqual({ id: "cake-08", basis: "curated" });
    expect(collectionCakes("chocolate")[0]!.name).toBe("Melted Ferrero Rocher");
  });

  it("carry no ingredient, allergen or category claims", () => {
    for (const collection of collections) {
      expect(Object.keys(collection).sort()).toEqual(["id", "label", "members"]);
      for (const member of collection.members) expect(Object.keys(member).sort()).toEqual(["basis", "id"]);
    }
  });
});
