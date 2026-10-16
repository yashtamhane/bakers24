const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** “₹1,500”, “₹1,00,000”. Indian digit grouping; no space after the symbol, as in the reference. */
export function formatInr(amount: number): string {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`Expected a whole, non-negative rupee amount, got ${amount}`);
  return `₹${inr.format(amount)}`;
}
