// Presentation mapping for the 23 regular cakes in CATALOG.json (M3 catalog).
//
// This file holds only what the catalog does not: a URL slug for each cake's page and, for three
// cakes, an illustrative image. Names, weights and reference prices are always read from the
// catalog, and filter groups from the audited collections in collections.ts, so nothing here
// can drift from the supplied data. No descriptions, ingredients, allergens or availability.
//
// Slugs are listed explicitly (not generated from names): “Hazelnut/Nutella Truffle” contains a
// slash, and “Red Velvet” must stay distinct from “Red Velvet Truffle”.

import { getRegularCake } from "./catalog";
import { collections, type Collection } from "./collections";
import { images, type ManagedImage } from "./images";
import type { RegularCake } from "./schema";

/** Registered illustrative product images (see images.ts). */
export type ProductImageKey = Extract<keyof typeof images, `product${string}`>;

export interface ProductEntry {
  /** Catalog id, e.g. "cake-01". */
  id: string;
  /** URL segment under /cakes/. */
  slug: string;
  /** Illustrative image, if one is approved; otherwise the cake is shown text-only. */
  image?: ProductImageKey;
}

/** Route segments that a product slug must never take. */
export const RESERVED_SLUGS: readonly string[] = ["birthday", "custom-cakes", "seasonal", "index"];

// Catalog order. Three illustrative images only (approved M3 decisions R3/R4); the other 20
// cakes, including Belgium Chocolate Premium (D5), are text-only until real photography exists.
export const products: readonly ProductEntry[] = [
  { id: "cake-01", slug: "pineapple", image: "productPineapple" },
  { id: "cake-02", slug: "roasted-cashew-truffle", image: "productRoastedCashewTruffle" },
  { id: "cake-03", slug: "red-velvet-truffle", image: "productRedVelvetTruffle" },
  { id: "cake-04", slug: "plain-rasmalai" },
  { id: "cake-05", slug: "choco-walnut-truffle" },
  { id: "cake-06", slug: "rose-gulkand" },
  { id: "cake-07", slug: "roasted-almond-truffle" },
  { id: "cake-08", slug: "melted-ferrero-rocher" },
  { id: "cake-09", slug: "hazelnut-nutella-truffle" },
  { id: "cake-10", slug: "nutty-choco" },
  { id: "cake-11", slug: "oreo-cream" },
  { id: "cake-12", slug: "choco-truffle" },
  { id: "cake-13", slug: "choco-vanilla" },
  { id: "cake-14", slug: "kitkat-cake-cream" },
  { id: "cake-15", slug: "premium-rasmalai" },
  { id: "cake-16", slug: "choco-chips-cream" },
  { id: "cake-17", slug: "belgium-chocolate-premium" },
  { id: "cake-18", slug: "choco-overload-cream" },
  { id: "cake-19", slug: "butterscotch" },
  { id: "cake-20", slug: "blueberry" },
  { id: "cake-21", slug: "red-velvet" },
  { id: "cake-22", slug: "black-forest" },
  { id: "cake-23", slug: "mixed-fruit-exotic" },
];

/** The supplied catalog record (name, weight, reference price) for a product. */
export function productCake(product: ProductEntry): RegularCake {
  return getRegularCake(product.id);
}

/** The illustrative image for a product, or undefined for a text-only product. */
export function productImage(product: ProductEntry): ManagedImage | undefined {
  return product.image ? images[product.image] : undefined;
}

/** Audited filter groups containing this product, in chip order (may be empty). */
export function productCollections(product: ProductEntry): Collection[] {
  return collections.filter((c) => c.members.some((m) => m.id === product.id));
}

export function getProductBySlug(slug: string): ProductEntry | undefined {
  return products.find((p) => p.slug === slug);
}
