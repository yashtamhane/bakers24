// Strict schema for the supplied CATALOG.json.
//
// Objects are strict: an unexpected key (for example an invented `category`, `ingredients`
// or `allergens` field) fails validation instead of silently reaching the page.

import { z } from "astro/zod";

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}-\\d{2}$`), `id must look like ${prefix}-NN`);
const rupees = z.number().int().positive();

export const RegularCakeSchema = z.strictObject({
  id: id("cake"),
  name: z.string().min(1),
  weight: z.literal("0.5 kg"),
  reference_price_inr: rupees,
  status: z.literal("screenshot-derived; reconfirm"),
});

export const CustomExampleSchema = z.strictObject({
  id: id("custom"),
  name: z.string().min(1),
  weight_kg: z.number().positive().nullable(),
  reference_price_inr: rupees,
  status: z.literal("reference example, not fixed quote"),
});

export const SeasonalExampleSchema = z.strictObject({
  id: id("seasonal"),
  name: z.string().min(1),
  size_note: z.string().min(1).nullable(),
  reference_price_inr: rupees,
  status: z.literal("historic/seasonal, not currently available unless confirmed"),
});

export const CatalogSchema = z
  .strictObject({
    metadata: z.strictObject({
      purpose: z.literal("Proposal demo only"),
      source: z.string().min(1),
      // Prices are reference values. If someone flips this to true, validation stops the build
      // so the change is deliberate and reviewed rather than accidental.
      prices_verified_current: z.literal(false),
      currency: z.literal("INR"),
      note: z.string().min(1),
    }),
    regular_cakes: z.array(RegularCakeSchema).min(1),
    custom_design_examples: z.array(CustomExampleSchema),
    seasonal_examples: z.array(SeasonalExampleSchema),
    instagram_mentioned_unpriced: z.array(z.string().min(1)),
  })
  .superRefine((catalog, ctx) => {
    const ids = [...catalog.regular_cakes, ...catalog.custom_design_examples, ...catalog.seasonal_examples].map((r) => r.id);
    const seen = new Set<string>();
    for (const value of ids) {
      if (seen.has(value)) ctx.addIssue({ code: "custom", message: `Duplicate id ${value}` });
      seen.add(value);
    }
  });

export type Catalog = z.infer<typeof CatalogSchema>;
export type RegularCake = z.infer<typeof RegularCakeSchema>;
export type CustomExample = z.infer<typeof CustomExampleSchema>;
export type SeasonalExample = z.infer<typeof SeasonalExampleSchema>;
