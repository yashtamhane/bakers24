// Crops each mockup panel out of the approved reference.
//   npm run ref:crop
// Writes .reference-output/panels/<panel>.png (native) and <panel>@<width>.png (scaled to the
// viewport width the panel represents). The reference image itself is never modified.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { OUTPUT_DIR, PANELS, REFERENCE_IMAGE } from "./regions.mjs";

const dir = path.join(OUTPUT_DIR, "panels");
await fs.mkdir(dir, { recursive: true });

for (const [id, { rect, viewportWidth, label }] of Object.entries(PANELS)) {
  const [left, top, width, height] = rect;
  const native = sharp(REFERENCE_IMAGE).extract({ left, top, width, height });
  await native.clone().png().toFile(path.join(dir, `${id}.png`));
  const scaledHeight = Math.round((height * viewportWidth) / width);
  await native.clone().resize(viewportWidth, scaledHeight, { kernel: "lanczos3" }).png().toFile(path.join(dir, `${id}@${viewportWidth}.png`));
  console.log(`${id.padEnd(18)} ${width}×${height} → ${viewportWidth}×${scaledHeight}  (${label}, scale ${(width / viewportWidth).toFixed(3)})`);
}
