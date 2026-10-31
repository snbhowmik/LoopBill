// All arithmetic happens in integer minor units (cents) to avoid float drift.
// Decimals from the database are converted at the edges.

type DecimalLike = { toString(): string } | number | string | null | undefined;

export function toCents(value: DecimalLike): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// Percent rates are carried as basis points (18.00% -> 1800).
export function toBasisPoints(rate: DecimalLike): number {
  return toCents(rate);
}

export function percentOf(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / 10000);
}

const currency = process.env.NEXT_PUBLIC_CURRENCY ?? "INR";
const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency,
  minimumFractionDigits: 2,
});

export function formatMoney(value: DecimalLike): string {
  return formatter.format(toCents(value) / 100);
}

export function formatCents(cents: number): string {
  return formatter.format(cents / 100);
}

// Splits `total` across `weights` proportionally, distributing rounding
// remainders so the parts always sum exactly to `total`.
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    parts[order[k].i] += 1;
  }
  return parts;
}
