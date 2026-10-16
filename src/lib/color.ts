// Colour maths for the contrast audit and the reference colour comparison.

export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as Rgb;
}

export function toHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function channelToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(channelToLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over composite of a translucent colour onto an opaque backdrop. */
export function composite(top: Rgb, alpha: number, backdrop: Rgb): Rgb {
  return top.map((c, i) => c * alpha + backdrop[i]! * (1 - alpha)) as unknown as Rgb;
}

function rgbToLab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(channelToLinear) as [number, number, number];
  // sRGB → XYZ (D65), normalised by the reference white.
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 ΔE. Under ~2.3 is barely perceptible; 5–10 is noticeable side by side. */
export function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = rgbToLab(a);
  const [l2, a2, b2] = rgbToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export type ContrastLevel = "text" | "large-text" | "non-text";

/** WCAG AA minimum for a given use. */
export const AA_MINIMUM: Record<ContrastLevel, number> = {
  text: 4.5,
  "large-text": 3,
  "non-text": 3,
};
