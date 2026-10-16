// The three editorial “doors” on the homepage, in the approved reference’s order.
//
// These are navigation entry points, not product groupings: they assign no catalog items and
// make no claim about which cakes are available. The destination pages are built in later
// milestones (catalog M3, custom-cake and seasonal pages later), so until then these links
// lead to routes that do not exist yet, exactly like the hero’s “Explore Cakes”.

import { images } from "./images";

export interface HomeCollection {
  id: "birthday" | "custom" | "seasonal";
  /** Two words, set on two lines as in the reference (“Birthday / Cakes”). */
  title: readonly [string, string];
  href: string;
  image: (typeof images)[keyof typeof images];
}

export const homeCollections: readonly HomeCollection[] = [
  { id: "birthday", title: ["Birthday", "Cakes"], href: "/cakes/", image: images.collectionBirthday },
  { id: "custom", title: ["Custom", "Cakes"], href: "/custom-cakes/", image: images.collectionCustom },
  { id: "seasonal", title: ["Seasonal", "Delights"], href: "/seasonal/", image: images.collectionSeasonal },
];
