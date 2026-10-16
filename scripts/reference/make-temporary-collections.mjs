// Builds the TEMPORARY collection-door images for M2 layout testing.
//   node scripts/reference/make-temporary-collections.mjs
//
// Crops of the cake photography ONLY from the three editorial tiles in the approved desktop
// mockup (Birthday Cakes, Custom Cakes, Seasonal Delights). Each rectangle stops above the
// tile's baked-in title and arrow, and sits inside the tile's rounded edge, so no mockup text,
// UI or ivory background is carried over. The lower fade into the tile is done in CSS.
// These are concept renders, not Baker’s 24 products; the page labels them as temporary.
//
// Output: src/assets/temporary/collection-<id>-reference-crop.png (2× lanczos, RGB)

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { REFERENCE_IMAGE, ROOT } from "./regions.mjs";

// Source rectangles in the 1536×1024 reference: [x, y, width, height].
// Tile titles begin at y ≈ 787 in all three tiles, so every crop ends at y 784.
export const COLLECTION_RECTS = {
  birthday: [364, 602, 168, 182],
  custom: [558, 572, 176, 212],
  seasonal: [770, 600, 154, 184],
};
const UPSCALE = 2;

const outDir = path.join(ROOT, "src/assets/temporary");
await fs.mkdir(outDir, { recursive: true });

for (const [id, [left, top, width, height]] of Object.entries(COLLECTION_RECTS)) {
  const out = path.join(outDir, `collection-${id}-reference-crop.png`);
  await sharp(REFERENCE_IMAGE)
    .extract({ left, top, width, height })
    .removeAlpha()
    .resize(width * UPSCALE, height * UPSCALE, { kernel: "lanczos3" })
    .png()
    .toFile(out);
  console.log(`Wrote ${path.relative(ROOT, out)} (${width * UPSCALE}×${height * UPSCALE}) from reference rect [${left}, ${top}, ${width}, ${height}]`);
}
