// The single source of product data is the supplied CATALOG.json at the project root.
// It is parsed once at build time; invalid data fails the build.

import raw from "../../CATALOG.json";
import { CatalogSchema, type RegularCake } from "./schema";

export const catalog = CatalogSchema.parse(raw);

export const regularCakes = catalog.regular_cakes;
export const customExamples = catalog.custom_design_examples;
export const seasonalExamples = catalog.seasonal_examples;
export const unpricedMentions = catalog.instagram_mentioned_unpriced;

const cakesById = new Map(regularCakes.map((cake) => [cake.id, cake]));

export function getRegularCake(id: string): RegularCake {
  const cake = cakesById.get(id);
  if (!cake) throw new Error(`Unknown regular cake id: ${id}`);
  return cake;
}
