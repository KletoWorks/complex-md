// Number formatting for the bench report.

/** Dollars: two places, three under ten cents so a $0.004 run is not $0.00. "-" when unknown. */
export function usd(x) {
  if (x == null || Number.isNaN(x)) return '-';
  return `$${x.toFixed(Math.abs(x) < 0.1 && x !== 0 ? 3 : 2)}`;
}
