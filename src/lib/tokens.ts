// Reads design-token values out of tokens.css so tests and the style guide audit the real
// stylesheet rather than a duplicated copy of it.

import { composite, parseHex, toHex, type Rgb } from "./color";

/** Every `--name: value;` declaration in the first `:root` block. */
export function parseCustomProperties(css: string): Map<string, string> {
  const root = css.match(/:root\s*{([\s\S]*?)\n\s*}/);
  const props = new Map<string, string>();
  if (!root?.[1]) return props;
  const body = root[1].replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    props.set(match[1]!, match[2]!.trim());
  }
  return props;
}

/**
 * Resolves a token to an opaque sRGB colour. Supports hex, `var(--x)` and the
 * `color-mix(in srgb, var(--x) N%, transparent)` form used for translucent fills, which
 * is composited onto `backdrop` (required for translucent tokens).
 */
export function resolveColor(props: Map<string, string>, name: string, backdrop?: Rgb, depth = 0): Rgb {
  if (depth > 10) throw new Error(`Token reference loop at ${name}`);
  const raw = props.get(name);
  if (!raw) throw new Error(`Unknown token ${name}`);

  if (raw.startsWith("#")) return parseHex(raw);

  const alias = raw.match(/^var\((--[\w-]+)\)$/);
  if (alias) return resolveColor(props, alias[1]!, backdrop, depth + 1);

  const mix = raw.match(/^color-mix\(in srgb,\s*var\((--[\w-]+)\)\s+([\d.]+)%,\s*transparent\)$/);
  if (mix) {
    if (!backdrop) throw new Error(`${name} is translucent; a backdrop is required to resolve it`);
    return composite(resolveColor(props, mix[1]!, undefined, depth + 1), Number(mix[2]) / 100, backdrop);
  }

  throw new Error(`Unsupported colour value for ${name}: ${raw}`);
}

export function resolveColorHex(props: Map<string, string>, name: string, backdrop?: Rgb): string {
  return toHex(resolveColor(props, name, backdrop));
}
