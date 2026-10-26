// Builds the ILLUSTRATIVE product images for the M3 catalog.
//   node scripts/reference/make-temporary-products.mjs
//
// Crops of the cake photography ONLY from three menu cards in the approved mobile catalog mockup
// (“Our Cakes” panel). Each rectangle sits inside the card's image area, clear of the card's
// name, price and heart icon, so no mockup text or UI is carried over. These are concept
// renders, not Baker’s 24 products: the site labels them “Illustrative image” wherever shown.
//
// Only these three are approved. The mockup's Plain Rasmalai, Melted Ferrero Rocher and Choco
// Walnut Truffle images are too small or partial to use, and its “Belgium Dark Chocolate” image
// is not a photograph of Belgium Chocolate Premium; those cakes stay text-only.
//
// Output: src/assets/temporary/product-<slug>-reference-crop.png (2× lanczos, RGB)

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { REFERENCE_IMAGE, ROOT } from "./regions.mjs";

// Source rectangles in the 1536×1024 reference: [x, y, width, height].
// Approved at x 1271; moved to x 1275 (width −4) at Checkpoint 1 because columns 1271–1274 are the
// mockup card's flat glass surface, not photograph (measured: a sharp luminance step at x ≈ 1275
// in all three cards). The remaining few corner pixels of the card's rounded image frame are
// hidden by the rounded corners the catalog layout gives every image.
export const PRODUCT_RECTS = {
  pineapple: [1275, 146, 101, 91], // mockup card “Pineapple Cake” → catalog cake-01 “Pineapple”
  "roasted-cashew-truffle": [1275, 255, 103, 93], // mockup card “Roasted Cashew Truffle” → cake-02
  "red-velvet-truffle": [1275, 366, 104, 86], // mockup card “Red Velvet Truffle” → cake-03
};
const UPSCALE = 2;

const outDir = path.join(ROOT, "src/assets/temporary");
await fs.mkdir(outDir, { recursive: true });

for (const [slug, [left, top, width, height]] of Object.entries(PRODUCT_RECTS)) {
  const out = path.join(outDir, `product-${slug}-reference-crop.png`);
  await sharp(REFERENCE_IMAGE)
    .extract({ left, top, width, height })
    .removeAlpha()
    .resize(width * UPSCALE, height * UPSCALE, { kernel: "lanczos3" })
    .png()
    .toFile(out);
  console.log(`Wrote ${path.relative(ROOT, out)} (${width * UPSCALE}×${height * UPSCALE}) from reference rect [${left}, ${top}, ${width}, ${height}]`);
}
