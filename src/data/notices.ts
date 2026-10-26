// Price, availability and image disclosures for the M3 catalog pages, in the approved wording.
// Kept in one place so every page uses identical text and tests can check it exactly.
// Prices are historical reference values (CATALOG.json, prices_verified_current: false): they
// must never be presented as current prices, offers or availability.

import type { CustomExample, RegularCake, SeasonalExample } from "./schema";

/** Shown under the /cakes/ intro and on every cake detail page. */
export const regularCakeNotice =
  "Reference prices come from an earlier Baker’s 24 WhatsApp catalogue. Please confirm current prices and availability directly with Baker’s 24.";

/** Shown under the /custom-cakes/ intro. */
export const customCakeNotice =
  "Custom cakes are quoted individually by Baker’s 24. These past examples show reference quotes only; please confirm price and availability directly with Baker’s 24.";

/** Shown under the /seasonal/ intro. */
export const seasonalNotice =
  "These seasonal items were offered in the past and are not currently available unless Baker’s 24 confirms otherwise.";

/** Explains the visible “Illustrative image” label wherever product imagery appears. */
export const illustrativeImageNotice =
  "Images marked ‘Illustrative image’ are concept artwork, not photographs of Baker’s 24 cakes.";

/** Shown on seasonal records whose name was supplied more than once with different prices. */
export const duplicateSeasonalNameNote =
  "Two reference prices were recorded for this name; the difference between them has not been confirmed.";

/** Text-only product panel, until real photography is available. */
export const photographPending = "Photograph to come";

/** Label for the plain WhatsApp link (business.whatsapp: no pre-filled message). */
export const whatsappLinkLabel = "Ask Baker’s 24 on WhatsApp";

/** “Reference price · 0.5 kg” */
export function regularPriceNote(cake: RegularCake): string {
  return `Reference price · ${cake.weight}`;
}

/** “Reference quote · 1.5 kg”, or “Reference quote · size not recorded” when no weight was supplied. */
export function customQuoteNote(example: CustomExample): string {
  return example.weight_kg === null ? "Reference quote · size not recorded" : `Reference quote · ${example.weight_kg} kg`;
}

/** “Past reference price”, plus the supplied size note when there is one (“· half kg”). */
export function seasonalPriceNote(record: SeasonalExample): string {
  return record.size_note === null ? "Past reference price" : `Past reference price · ${record.size_note}`;
}

/** Names that occur more than once among the seasonal records (each record keeps its own price). */
export function duplicateSeasonalNames(records: readonly SeasonalExample[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { name } of records) (seen.has(name) ? duplicates : seen).add(name);
  return duplicates;
}
