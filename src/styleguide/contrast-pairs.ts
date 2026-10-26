// Every foreground/background pairing the design uses. Audited by tests/unit/contrast.test.ts
// and listed on /_styleguide. Add a row whenever a new pairing is introduced.

import type { ContrastLevel } from "../lib/color";

export interface ContrastPair {
  use: string;
  fg: string;
  bg: string;
  /** Opaque token a translucent `bg` (or `fg`) is composited onto. */
  over?: string;
  level: ContrastLevel;
}

export const contrastPairs: readonly ContrastPair[] = [
  // Dark surfaces
  { use: "Body and headline text on espresso", fg: "--color-text", bg: "--color-bg", level: "text" },
  { use: "Soft body text on espresso", fg: "--color-text-soft", bg: "--color-bg", level: "text" },
  { use: "Eyebrow on espresso", fg: "--color-text-eyebrow", bg: "--color-bg", level: "text" },
  { use: "Accent word on espresso", fg: "--color-accent", bg: "--color-bg", level: "large-text" },
  { use: "Accent word on cocoa", fg: "--color-accent", bg: "--color-surface-cocoa", level: "large-text" },
  { use: "Soft text on cocoa", fg: "--color-text-soft", bg: "--color-surface-cocoa", level: "text" },
  { use: "Text on black cherry", fg: "--color-text", bg: "--color-surface-cherry", level: "text" },

  // Buttons
  { use: "Primary button label", fg: "--color-cta-text", bg: "--color-cta", level: "text" },
  { use: "Primary button label (hover)", fg: "--color-cta-text", bg: "--color-cta-hover", level: "text" },
  // The wine fill alone is 1.56:1 on espresso; the reference's rose-gold edge carries the boundary.
  { use: "Primary button edge on espresso", fg: "--color-cta-edge", bg: "--color-bg", level: "non-text" },
  { use: "Outline button edge on espresso", fg: "--color-accent", bg: "--color-bg", level: "non-text" },
  { use: "Outline button label on ivory", fg: "--color-cta", bg: "--color-surface-ivory", level: "text" },

  // Chips
  { use: "Chip label", fg: "--color-chip-text", bg: "--color-chip-bg", over: "--color-bg", level: "text" },
  { use: "Chip label over brightest permitted backdrop", fg: "--color-chip-text", bg: "--color-chip-bg", over: "--color-backdrop-limit", level: "text" },
  { use: "Chip border on espresso", fg: "--color-chip-border", bg: "--color-bg", level: "non-text" },
  { use: "Active chip label", fg: "--color-chip-active-text", bg: "--color-chip-active-bg", level: "text" },
  { use: "Active chip vs espresso (selected state)", fg: "--color-chip-active-bg", bg: "--color-bg", level: "non-text" },

  // Product card
  { use: "Card title and price on card surface", fg: "--color-text", bg: "--color-surface-card", level: "text" },
  { use: "Card text on glass over brightest permitted backdrop", fg: "--color-text", bg: "--color-card-glass", over: "--color-backdrop-limit", level: "text" },

  // Ivory interlude
  { use: "Heading on ivory", fg: "--color-text-on-ivory", bg: "--color-surface-ivory", level: "text" },
  { use: "Body text on ivory", fg: "--color-text-on-ivory-soft", bg: "--color-surface-ivory", level: "text" },
  { use: "Eyebrow on ivory", fg: "--color-eyebrow-on-ivory", bg: "--color-surface-ivory", level: "text" },

  // Focus
  { use: "Focus ring on espresso", fg: "--color-focus", bg: "--color-bg", level: "non-text" },
  // Rose-gold is 2.90:1 on the card surface, so controls inside cards use a cream ring.
  { use: "Focus ring on card", fg: "--color-focus-on-card", bg: "--color-surface-card", level: "non-text" },
  { use: "Focus ring on ivory", fg: "--color-focus-on-ivory", bg: "--color-surface-ivory", level: "non-text" },

  // M3 catalog pages: espresso-900 page background (--color-bg-raised, the reference menu backdrop)
  { use: "Catalog title and contact label on catalog background", fg: "--color-text", bg: "--color-bg-raised", level: "text" },
  { use: "Catalog notice and phone number (sand) on catalog background", fg: "--color-text-soft", bg: "--color-bg-raised", level: "text" },
  { use: "Catalog eyebrow on catalog background", fg: "--color-text-eyebrow", bg: "--color-bg-raised", level: "text" },
  { use: "Catalog chip label on catalog background", fg: "--color-chip-text", bg: "--color-chip-bg", over: "--color-bg-raised", level: "text" },
  // Chip borders are 2.82:1 on cocoa, so catalog pages use the espresso-900 background instead.
  { use: "Catalog chip border on catalog background", fg: "--color-chip-border", bg: "--color-bg-raised", level: "non-text" },
  { use: "Catalog active chip vs catalog background", fg: "--color-chip-active-bg", bg: "--color-bg-raised", level: "non-text" },
  { use: "WhatsApp outline link edge on catalog background", fg: "--color-accent", bg: "--color-bg-raised", level: "non-text" },
  { use: "Focus ring on catalog background", fg: "--color-focus", bg: "--color-bg-raised", level: "non-text" },
  // Linked cake cards draw their ring outside the card, on the catalog background.
  { use: "Cake card focus ring (cream) on catalog background", fg: "--color-focus-on-card", bg: "--color-bg-raised", level: "non-text" },

  // M3 cake cards: clay surface. Every card text is cream; sand and taupe fail AA here.
  { use: "Cake card name, price and price qualifier on clay card", fg: "--color-text", bg: "--color-surface-card", level: "text" },
  { use: "“Photograph to come” (sand) on text-only panel", fg: "--color-text-soft", bg: "--color-surface-cocoa-deep", level: "text" },
  { use: "“Illustrative image” label on its espresso pill", fg: "--color-text", bg: "--color-bg", level: "text" },
];
