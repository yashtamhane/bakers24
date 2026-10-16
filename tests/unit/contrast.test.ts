import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AA_MINIMUM, contrastRatio, parseHex } from "../../src/lib/color";
import { parseCustomProperties, resolveColor } from "../../src/lib/tokens";
import { contrastPairs } from "../../src/styleguide/contrast-pairs";

const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");
const props = parseCustomProperties(css);

describe("design token contrast (WCAG 2.2 AA)", () => {
  it("parses the token sheet", () => {
    expect(props.size).toBeGreaterThan(40);
  });

  for (const pair of contrastPairs) {
    it(`${pair.use}: ${pair.fg} on ${pair.bg}`, () => {
      const backdrop = pair.over ? resolveColor(props, pair.over) : undefined;
      const bg = resolveColor(props, pair.bg, backdrop);
      const fg = resolveColor(props, pair.fg, bg);
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `${ratio.toFixed(2)}:1 is below ${AA_MINIMUM[pair.level]}:1`).toBeGreaterThanOrEqual(AA_MINIMUM[pair.level]);
    });
  }
});

describe("colour maths", () => {
  it("matches published WCAG reference ratios", () => {
    expect(contrastRatio(parseHex("#000"), parseHex("#fff"))).toBeCloseTo(21, 5);
    expect(contrastRatio(parseHex("#777777"), parseHex("#ffffff"))).toBeCloseTo(4.48, 2);
  });
});
