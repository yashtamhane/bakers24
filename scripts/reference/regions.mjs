// Measured regions of references/approved-design.png (1536×1024).
// All rectangles are in source-image pixels: [x, y, width, height].
// Panel bounds were measured from the near-black gutters between mockups.
// The reference image is read-only; every script writes to .reference-output/.

import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const REFERENCE_IMAGE = path.join(ROOT, "references/approved-design.png");
export const OUTPUT_DIR = path.join(ROOT, ".reference-output");

/**
 * Each panel maps to the viewport width it represents. Mobile panels are not
 * drawn at a shared scale, so comparisons always normalise by width.
 */
export const PANELS = {
  "desktop-home": { rect: [10, 9, 971, 1004], viewportWidth: 1440, label: "Desktop homepage" },
  "mobile-home": { rect: [997, 9, 235, 492], viewportWidth: 390, label: "Mobile homepage" },
  "mobile-menu": { rect: [1249, 9, 276, 537], viewportWidth: 390, label: "Mobile catalog — Our Cakes" },
  "mobile-chocolate": { rect: [997, 518, 234, 496], viewportWidth: 390, label: "Chocolate Collection" },
  "mobile-custom": { rect: [1249, 561, 276, 452], viewportWidth: 390, label: "Custom Cake — step 1" },
};

/**
 * Colour sample regions.
 * - "fill": median colour of the region (flat surfaces, button fills).
 * - "ink-light": mean of the brightest 12% of pixels (light text on dark).
 * - "ink-dark": mean of the darkest 12% of pixels (dark text on light).
 */
export const COLOR_SAMPLES = [
  // Desktop hero
  { id: "desk-hero-shadow", panel: "desktop-home", rect: [24, 96, 40, 40], mode: "fill", role: "Deepest hero shadow (top-left)" },
  { id: "desk-hero-bg", panel: "desktop-home", rect: [300, 340, 60, 30], mode: "fill", role: "Hero backdrop behind copy" },
  { id: "desk-headline", panel: "desktop-home", rect: [84, 168, 230, 48], mode: "ink-light", role: "Headline ivory (“Moments”)" },
  { id: "desk-headline-accent", panel: "desktop-home", rect: [84, 276, 145, 48], mode: "ink-light", role: "Headline accent (“Here.”)" },
  { id: "desk-eyebrow", panel: "desktop-home", rect: [82, 140, 280, 10], mode: "ink-light", role: "Hero eyebrow text" },
  { id: "desk-body", panel: "desktop-home", rect: [83, 362, 220, 30], mode: "ink-light", role: "Hero body text" },
  { id: "desk-cta-fill", panel: "desktop-home", rect: [88, 418, 18, 30], mode: "fill", role: "Primary CTA fill" },
  { id: "desk-ivory-a", panel: "desktop-home", rect: [24, 860, 40, 40], mode: "fill", role: "Ivory section (lower left)" },
  { id: "desk-ivory-b", panel: "desktop-home", rect: [310, 590, 30, 30], mode: "fill", role: "Ivory section (beside headline)" },
  { id: "desk-ivory-heading", panel: "desktop-home", rect: [86, 612, 210, 40], mode: "ink-dark", role: "Ivory heading ink (“For Every”)" },
  { id: "desk-ivory-body", panel: "desktop-home", rect: [84, 768, 200, 44], mode: "ink-dark", role: "Ivory body text" },
  { id: "desk-ivory-eyebrow", panel: "desktop-home", rect: [83, 588, 80, 9], mode: "ink-dark", role: "Ivory eyebrow (“OUR CAKES”)" },
  { id: "desk-band", panel: "desktop-home", rect: [905, 930, 60, 50], mode: "fill", role: "Closing dark band" },

  // Mobile homepage
  { id: "mhome-bg", panel: "mobile-home", rect: [1150, 105, 40, 20], mode: "fill", role: "Hero backdrop (upper)" },
  { id: "mhome-headline", panel: "mobile-home", rect: [1030, 176, 115, 26], mode: "ink-light", role: "Headline ivory" },
  { id: "mhome-accent", panel: "mobile-home", rect: [1110, 207, 78, 26], mode: "ink-light", role: "Headline accent (“Better”)" },
  { id: "mhome-cta-fill", panel: "mobile-home", rect: [1034, 326, 12, 24], mode: "fill", role: "Primary CTA fill" },

  // Mobile menu
  { id: "mmenu-bg", panel: "mobile-menu", rect: [1440, 84, 50, 14], mode: "fill", role: "Menu backdrop near title" },
  { id: "mmenu-card", panel: "mobile-menu", rect: [1450, 216, 40, 14], mode: "fill", role: "Card surface (text side)" },
  { id: "mmenu-chip-active", panel: "mobile-menu", rect: [1268, 108, 8, 16], mode: "fill", role: "Active chip fill" },
  { id: "mmenu-chip", panel: "mobile-menu", rect: [1308, 110, 3, 12], mode: "fill", role: "Inactive chip fill" },
  { id: "mmenu-title", panel: "mobile-menu", rect: [1342, 68, 88, 22], mode: "ink-light", role: "Page title ink" },
  { id: "mmenu-card-title", panel: "mobile-menu", rect: [1392, 176, 88, 16], mode: "ink-light", role: "Card title ink" },

  // Chocolate collection
  { id: "mchoc-bg", panel: "mobile-chocolate", rect: [1150, 655, 40, 12], mode: "fill", role: "Collection backdrop" },
  { id: "mchoc-card", panel: "mobile-chocolate", rect: [1180, 776, 30, 12], mode: "fill", role: "Card surface (text side)" },

  // Custom cake
  { id: "mcustom-bg", panel: "mobile-custom", rect: [1410, 668, 70, 14], mode: "fill", role: "Step backdrop" },
  { id: "mcustom-cta-fill", panel: "mobile-custom", rect: [1276, 960, 24, 22], mode: "fill", role: "Bottom CTA fill" },
  { id: "mcustom-selected", panel: "mobile-custom", rect: [1318, 827, 46, 4], mode: "fill", role: "Selected size tile" },
];

/**
 * Text lines used to score serif candidates. Light text on a dark ground.
 * The phrases are what the mockup renders inside each rectangle. renderPx is the estimated
 * real CSS size (ink height ÷ panel scale), so optical-size axes behave as they would live.
 */
export const FONT_SAMPLES = [
  { id: "desk-line-1", kind: "serif", rect: [80, 166, 236, 50], renderPx: 88, text: "Moments", role: "Desktop headline line 1" },
  { id: "desk-line-2", kind: "serif", rect: [80, 220, 304, 52], renderPx: 88, text: "Taste Better", role: "Desktop headline line 2" },
  { id: "mobile-line-1", kind: "serif", rect: [1026, 172, 134, 32], renderPx: 50, text: "Moments", role: "Mobile headline line 1" },
  { id: "desk-body-1", kind: "sans", rect: [80, 359, 240, 20], renderPx: 16, text: "Artisanal cakes, crafted with care for", role: "Desktop hero body line 1" },
];
