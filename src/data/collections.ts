// Curated product collections.
//
// Membership is an explicit, reviewed list of catalog ids, not keyword matching at runtime.
// Collections are editorial groupings only: they make no claim about ingredients, allergens
// or recipes, and nothing here should be rendered as such.
//
// `basis` records why a product is included, so every membership decision can be audited:
//   "name"     the product's own name contains the collection word (e.g. “Choco Truffle”)
//   "curated"  approved editorial placement (e.g. Melted Ferrero Rocher in Chocolate)

import { getRegularCake } from "./catalog";

export type MembershipBasis = "name" | "curated";

export interface CollectionMember {
  id: string;
  basis: MembershipBasis;
}

export interface Collection {
  id: string;
  /** Chip label, matching the reference (“Chocolate”, “Fruit”, “Truffle”, “Rasmalai”). */
  label: string;
  members: readonly CollectionMember[];
}

const byName = (...ids: string[]): CollectionMember[] => ids.map((id) => ({ id, basis: "name" }));
const curated = (...ids: string[]): CollectionMember[] => ids.map((id) => ({ id, basis: "curated" }));

// Chip order follows the approved reference: All, Chocolate, Fruit, Truffle, Rasmalai.
export const collections: readonly Collection[] = [
  {
    id: "chocolate",
    label: "Chocolate",
    // Order follows the reference's Chocolate Collection screen (Ferrero first).
    members: [
      ...curated("cake-08"), // Melted Ferrero Rocher (approved curated placement)
      ...byName("cake-05", "cake-17", "cake-12", "cake-10", "cake-13", "cake-16", "cake-18"),
    ],
    // Not yet placed, awaiting the client's confirmation: cake-09 Hazelnut/Nutella Truffle,
    // cake-14 Kitkat Cake Cream, cake-11 Oreo Cream, cake-22 Black Forest.
  },
  {
    id: "fruit",
    label: "Fruit",
    members: byName("cake-01", "cake-20", "cake-23"), // Pineapple, Blueberry, Mixed Fruit Exotic
  },
  {
    id: "truffle",
    label: "Truffle",
    members: byName("cake-02", "cake-03", "cake-05", "cake-07", "cake-09", "cake-12"),
  },
  {
    id: "rasmalai",
    label: "Rasmalai",
    members: byName("cake-04", "cake-15"),
  },
];

export function getCollection(id: string): Collection {
  const collection = collections.find((c) => c.id === id);
  if (!collection) throw new Error(`Unknown collection: ${id}`);
  return collection;
}

/** Products in a collection, in curated order. Throws on any id missing from the catalog. */
export function collectionCakes(id: string) {
  return getCollection(id).members.map((m) => getRegularCake(m.id));
}
