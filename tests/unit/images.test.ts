import { describe, expect, it } from "vitest";
import { images } from "../../src/data/images";

describe("image provenance", () => {
  const all = Object.values(images);

  it("registers every image with a kind, alt text and source", () => {
    for (const img of all) {
      expect(["temporary", "concept", "portfolio"]).toContain(img.kind);
      expect(img.alt.length, img.id).toBeGreaterThan(10);
      expect(img.source.length, img.id).toBeGreaterThan(10);
    }
  });

  it("gives every temporary image a visible label and a note of what replaces it", () => {
    // M1/M2 images say “Temporary image”; M3 product images say “Illustrative image”.
    for (const img of all.filter((i) => i.kind === "temporary")) {
      expect(img.label, img.id).toMatch(/^(Temporary image|Illustrative image)$/);
      expect(img.replaceWith, img.id).toBeTruthy();
    }
  });

  it("keeps the M1/M2 homepage images labelled “Temporary image”", () => {
    for (const img of [images.heroCake, images.collectionBirthday, images.collectionCustom, images.collectionSeasonal]) {
      expect(img.label, img.id).toBe("Temporary image");
    }
  });

  it("labels the three M3 product images “Illustrative image” and never as Baker’s 24 photography", () => {
    const products = [images.productPineapple, images.productRoastedCashewTruffle, images.productRedVelvetTruffle];
    for (const img of products) {
      expect(img.kind, img.id).toBe("temporary");
      expect(img.label, img.id).toBe("Illustrative image");
      expect(img.alt, img.id).toMatch(/^Illustrative /);
      expect(img.source, img.id).toMatch(/references\/approved-design\.png/);
      expect(img.replaceWith, img.id).toMatch(/permission-cleared photograph of Baker’s 24’s own/);
    }
    // Exactly these three product images exist; no other mockup crops were added.
    expect(Object.keys(images).filter((k) => k.startsWith("product")).sort()).toEqual(
      ["productPineapple", "productRedVelvetTruffle", "productRoastedCashewTruffle"],
    );
  });

  it("keeps the hero cake and collection doors flagged as temporary until real photography is supplied", () => {
    for (const img of [images.heroCake, images.collectionBirthday, images.collectionCustom, images.collectionSeasonal]) {
      expect(img.kind, img.id).toBe("temporary");
    }
  });
});
