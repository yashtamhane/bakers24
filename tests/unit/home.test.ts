import { describe, expect, it } from "vitest";
import { business, conceptNotice } from "../../src/data/business";
import { homeCollections } from "../../src/data/home-collections";
import { images } from "../../src/data/images";

describe("homepage collection doors", () => {
  it("are the reference's three collections, in its order", () => {
    expect(homeCollections.map((c) => c.title.join(" "))).toEqual(["Birthday Cakes", "Custom Cakes", "Seasonal Delights"]);
  });

  it("each lead somewhere different, as trailing-slash site paths", () => {
    const hrefs = homeCollections.map((c) => c.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/[a-z-]+\/$/);
  });

  it("use registered images, labelled temporary until real photography is supplied", () => {
    const registered = new Set<unknown>(Object.values(images));
    for (const c of homeCollections) {
      expect(registered.has(c.image), c.id).toBe(true);
      expect(c.image.kind, c.id).toBe("temporary");
    }
  });
});

describe("business facts", () => {
  it("uses the WhatsApp number from CONTENT.md, opening a chat with no pre-filled message", () => {
    expect(business.whatsapp.display).toBe("+91 90289 02800");
    expect(business.whatsapp.href).toBe("https://wa.me/919028902800");
  });

  it("links the shop's Instagram profile", () => {
    expect(business.instagram.href).toBe("https://www.instagram.com/bakers24pcmc/");
    expect(business.instagram.handle).toBe("@bakers24pcmc");
  });

  it("keeps the address flagged as unverified", () => {
    expect(business.address.verified).toBe(false);
    expect(business.address.lines.join(" ")).toContain("411017");
  });

  it("publishes no unconfirmed details (hours, email, delivery)", () => {
    const text = JSON.stringify(business).toLowerCase();
    for (const unconfirmed of ["hour", "10:30", "11:59", "gmail", "email", "delivery"]) expect(text).not.toContain(unconfirmed);
  });

  it("carries the concept-demonstration wording CONTENT.md requires", () => {
    expect(conceptNotice).toBe("Concept demonstration — products, prices and availability subject to confirmation.");
  });
});
