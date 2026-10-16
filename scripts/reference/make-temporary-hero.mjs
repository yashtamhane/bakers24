// Builds the TEMPORARY hero cake image for M1 layout testing.
//   node scripts/reference/make-temporary-hero.mjs
//
// This is a crop of the cake ONLY from the approved mobile mockup (approved for temporary
// layout testing; never final imagery). The page background is built separately from CSS/SVG,
// so the crop's left and top edges are feathered into it, and the mockup's button corner and
// slider indicator (which sit inside the rectangle) are faded out. The crop stops inside the
// drawn phone frame. The page labels this image as temporary wherever it appears.
//
// Output: src/assets/temporary/hero-cake-reference-crop.png (2× lanczos, RGBA)

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { REFERENCE_IMAGE, ROOT } from "./regions.mjs";

// Source rectangle in the 1536×1024 reference: inside the phone frame (frame starts at x 1230,
// y 497). In the 390px-wide mobile layout this spans x 191–383, y 569–808 (status bar included).
export const CAKE_RECT = [1112, 352, 117, 145];
const UPSCALE = 2;

const [left, top, width, height] = CAKE_RECT;
const W = width * UPSCALE;
const H = height * UPSCALE;

// Alpha mask, computed per pixel (fractions of the crop):
//   - soft fade along the left edge (0 → 0.14) and top edge (0 → 0.10, covers the button corner)
//   - a soft transparent spot over the mockup's slider indicator glyphs (x 0–0.26, y 0.79–0.85)
const smooth = (e0, e1, v) => {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const alpha = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const fx = x / W;
    const fy = y / H;
    const spot = Math.hypot((fx - 0.12) / 0.2, (fy - 0.815) / 0.075);
    const a = smooth(0, 0.14, fx) * smooth(0.0, 0.1, fy) * smooth(0.75, 1.15, spot);
    alpha[y * W + x] = Math.round(a * 255);
  }
}

const rgb = await sharp(REFERENCE_IMAGE).extract({ left, top, width, height }).removeAlpha().resize(W, H, { kernel: "lanczos3" }).raw().toBuffer();

const out = path.join(ROOT, "src/assets/temporary/hero-cake-reference-crop.png");
await fs.mkdir(path.dirname(out), { recursive: true });
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toFile(out);
console.log(`Wrote ${path.relative(ROOT, out)} (${W}×${H}) from reference rect [${CAKE_RECT.join(", ")}]`);
