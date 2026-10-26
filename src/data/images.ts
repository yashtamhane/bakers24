// Image provenance. Every image used on a page is registered here with what it is, so
// temporary, conceptual and real bakery work can never be confused.
//   temporary   layout-testing stand-in; always visibly labelled; must be replaced before review sign-off
//   concept     illustrative imagery for the proposal (approved, labelled as concept)
//   portfolio   actual Baker’s 24 work, used with permission

import type { ImageMetadata } from "astro";
import heroCakeReferenceCrop from "../assets/temporary/hero-cake-reference-crop.png";
import collectionBirthdayReferenceCrop from "../assets/temporary/collection-birthday-reference-crop.png";
import collectionCustomReferenceCrop from "../assets/temporary/collection-custom-reference-crop.png";
import collectionSeasonalReferenceCrop from "../assets/temporary/collection-seasonal-reference-crop.png";
import productPineappleReferenceCrop from "../assets/temporary/product-pineapple-reference-crop.png";
import productRoastedCashewTruffleReferenceCrop from "../assets/temporary/product-roasted-cashew-truffle-reference-crop.png";
import productRedVelvetTruffleReferenceCrop from "../assets/temporary/product-red-velvet-truffle-reference-crop.png";

export type ImageKind = "temporary" | "concept" | "portfolio";

export interface ManagedImage {
  id: string;
  kind: ImageKind;
  src: ImageMetadata;
  alt: string;
  /** Short visible label for temporary/concept images. */
  label?: string;
  source: string;
  replaceWith?: string;
}

export const images = {
  heroCake: {
    id: "hero-cake",
    kind: "temporary",
    src: heroCakeReferenceCrop,
    alt: "Close-up of a chocolate cake topped with a raspberry and chocolate curls.",
    label: "Temporary image",
    source: "Crop of the cake only from references/approved-design.png (scripts/reference/make-temporary-hero.mjs).",
    replaceWith:
      "Hero cake photograph: close-up of a chocolate drip cake top (raspberry, chocolate shards, gold leaf), dark warm backdrop, cake filling the lower-right corner; at least 1200×1500px.",
  },
  collectionBirthday: {
    id: "collection-birthday",
    kind: "temporary",
    src: collectionBirthdayReferenceCrop,
    alt: "A pink frosted cake crowned with red flowers, berries and blueberries.",
    label: "Temporary image",
    source: "Crop of the Birthday Cakes tile photo (above its title) from references/approved-design.png (scripts/reference/make-temporary-collections.mjs).",
    replaceWith:
      "A real Baker’s 24 birthday cake, photographed upright in warm low light against a dark backdrop, cake centred in the upper two-thirds; portrait, at least 900×1200px.",
  },
  collectionCustom: {
    id: "collection-custom",
    kind: "temporary",
    src: collectionCustomReferenceCrop,
    alt: "A chocolate drip cake topped with tall chocolate shards and gold flecks.",
    label: "Temporary image",
    source: "Crop of the Custom Cakes tile photo (above its title) from references/approved-design.png (scripts/reference/make-temporary-collections.mjs).",
    replaceWith:
      "A real Baker’s 24 custom (made-to-order) cake from the shop’s portfolio, used with permission; portrait, warm low light, at least 900×1200px.",
  },
  collectionSeasonal: {
    id: "collection-seasonal",
    kind: "temporary",
    src: collectionSeasonalReferenceCrop,
    alt: "A cream cake piled with mango cubes, whipped cream rosettes and small golden flowers.",
    label: "Temporary image",
    source: "Crop of the Seasonal Delights tile photo (above its title) from references/approved-design.png (scripts/reference/make-temporary-collections.mjs).",
    replaceWith:
      "A real Baker’s 24 seasonal cake (for example a mango cake, if the shop confirms it), portrait, warm low light, at least 900×1200px.",
  },

  // M3 catalog: illustrative product images. Concept renders from the approved mockup's menu
  // cards, not photographs of Baker’s 24 cakes; labelled “Illustrative image” wherever shown.
  productPineapple: {
    id: "product-pineapple",
    kind: "temporary",
    src: productPineappleReferenceCrop,
    alt: "Illustrative cream cake with a glazed top, cream rosettes and red cherries.",
    label: "Illustrative image",
    source:
      "Crop of the “Pineapple Cake” menu card photo from references/approved-design.png, rect [1275, 146, 101, 91] (scripts/reference/make-temporary-products.mjs).",
    replaceWith:
      "A permission-cleared photograph of Baker’s 24’s own Pineapple cake, warm low light, cake filling the frame; at least 800×700px.",
  },
  productRoastedCashewTruffle: {
    id: "product-roasted-cashew-truffle",
    kind: "temporary",
    src: productRoastedCashewTruffleReferenceCrop,
    alt: "Illustrative chocolate drip cake topped with chocolate pieces and nuts.",
    label: "Illustrative image",
    source:
      "Crop of the “Roasted Cashew Truffle” menu card photo from references/approved-design.png, rect [1275, 255, 103, 93] (scripts/reference/make-temporary-products.mjs).",
    replaceWith:
      "A permission-cleared photograph of Baker’s 24’s own Roasted Cashew Truffle cake, warm low light, cake filling the frame; at least 800×700px.",
  },
  productRedVelvetTruffle: {
    id: "product-red-velvet-truffle",
    kind: "temporary",
    src: productRedVelvetTruffleReferenceCrop,
    alt: "Illustrative dark cake with a red crumb top, a ring of chocolate pearls and red sprinkles.",
    label: "Illustrative image",
    source:
      "Crop of the “Red Velvet Truffle” menu card photo from references/approved-design.png, rect [1275, 366, 104, 86] (scripts/reference/make-temporary-products.mjs).",
    replaceWith:
      "A permission-cleared photograph of Baker’s 24’s own Red Velvet Truffle cake, warm low light, cake filling the frame; at least 800×700px.",
  },
} as const satisfies Record<string, ManagedImage>;
