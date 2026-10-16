import { describe, expect, it } from "vitest";
import { formatInr } from "../../src/lib/format";

describe("formatInr", () => {
  it("formats reference prices the way the approved design shows them", () => {
    expect(formatInr(380)).toBe("₹380");
    expect(formatInr(1500)).toBe("₹1,500");
  });

  it("uses Indian digit grouping", () => {
    expect(formatInr(100000)).toBe("₹1,00,000");
  });

  it("refuses fractional or negative amounts instead of rounding silently", () => {
    expect(() => formatInr(399.5)).toThrow();
    expect(() => formatInr(-1)).toThrow();
  });
});
