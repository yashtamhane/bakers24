// Which reference sample each palette token was tuned against, and why it differs (if it does).

export interface ColorMapping {
  token: string;
  sample: string | null;
  note: string;
}

export const colorMap: readonly ColorMapping[] = [
  { token: "--palette-espresso-950", sample: "desk-hero-shadow", note: "Page background" },
  { token: "--palette-espresso-900", sample: "mmenu-bg", note: "Raised dark surface" },
  { token: "--palette-cocoa-700", sample: "mhome-bg", note: "Cocoa surface; the reference varies with lighting" },
  { token: "--palette-cocoa-600", sample: "mchoc-card", note: "Deep card and chip base" },
  { token: "--palette-cherry-800", sample: null, note: "Spec value; no clean black-cherry area to sample" },
  { token: "--palette-wine-700", sample: "desk-cta-fill", note: "Primary CTA fill" },
  { token: "--palette-wine-600", sample: "mcustom-cta-fill", note: "Brighter wine (custom-cake CTA)" },
  { token: "--palette-clay-500", sample: "mmenu-card", note: "Darkened from reference so cream text passes AA (4.49 → 5.04)" },
  { token: "--palette-rosegold-400", sample: "desk-headline-accent", note: "Headline accent word" },
  { token: "--palette-copper-700", sample: "desk-ivory-eyebrow", note: "Much darker than reference: reference eyebrow is 2.08:1 on ivory" },
  { token: "--palette-taupe-300", sample: "desk-eyebrow", note: "Hero eyebrow" },
  { token: "--palette-sand-200", sample: "desk-body", note: "Warmed slightly toward the palette" },
  { token: "--palette-cream-100", sample: "desk-headline", note: "Primary light text" },
  { token: "--palette-blush-200", sample: "mmenu-chip-active", note: "Active chip / selected tile" },
  { token: "--palette-ivory-50", sample: "desk-ivory-a", note: "Ivory interlude" },
  { token: "--palette-ink-950", sample: "desk-ivory-heading", note: "Heading ink on ivory" },
  { token: "--palette-ink-600", sample: "desk-ivory-body", note: "Body ink on ivory" },
];
