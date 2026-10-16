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
    for (const img of all.filter((i) => i.kind === "temporary")) {
      expect(img.label, img.id).toMatch(/temporary/i);
      expect(img.replaceWith, img.id).toBeTruthy();
    }
  });

  it("keeps the hero cake flagged as temporary until real photography is supplied", () => {
    expect(images.heroCake.kind).toBe("temporary");
  });
});
