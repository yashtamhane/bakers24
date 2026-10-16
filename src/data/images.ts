// Image provenance. Every image used on a page is registered here with what it is, so
// temporary, conceptual and real bakery work can never be confused.
//   temporary   layout-testing stand-in; always visibly labelled; must be replaced before review sign-off
//   concept     illustrative imagery for the proposal (approved, labelled as concept)
//   portfolio   actual Baker’s 24 work, used with permission

import type { ImageMetadata } from "astro";
import heroCakeReferenceCrop from "../assets/temporary/hero-cake-reference-crop.png";

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
} as const satisfies Record<string, ManagedImage>;
