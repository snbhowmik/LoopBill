import { allocate, percentOf } from "./money";

// Pure invoice pricing: given lines and candidate discounts, produce per-line
// discounts, taxes and totals. No database access, so it is fully unit-tested.

export type PricingLine = {
  key: string;
  description: string;
  productId: string | null;
  quantity: number;
  unitPriceCents: number;
  taxBasisPoints: number; // sum of applicable tax rates
  taxLabel: string | null;
};

export type PricingDiscount = {
  id: string;
  name: string;
  type: "FIXED" | "PERCENTAGE";
  valueCents: number; // FIXED: amount in cents; PERCENTAGE: basis points
  scope: "PRODUCTS" | "SUBSCRIPTION";
  productIds: string[];
  minPurchaseCents: number | null;
  minQuantity: number | null;
};

export type PricedLine = PricingLine & {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export type PricingResult = {
  lines: PricedLine[];
  applied: { id: string; name: string; amountCents: number }[];
  skipped: { id: string; name: string; reason: string }[];
  untaxedCents: number; // before discounts
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

export function priceInvoice(
  lines: PricingLine[],
  discounts: PricingDiscount[],
): PricingResult {
  const priced = lines.map((l) => ({
    ...l,
    subtotalCents: l.quantity * l.unitPriceCents,
    discountCents: 0,
    taxCents: 0,
    totalCents: 0,
  }));

  const untaxedCents = priced.reduce((s, l) => s + l.subtotalCents, 0);
  const applied: PricingResult["applied"] = [];
  const skipped: PricingResult["skipped"] = [];

  for (const d of discounts) {
    const eligible = priced.filter((l) =>
      d.scope === "SUBSCRIPTION" ? true : l.productId !== null && d.productIds.includes(l.productId),
    );
    if (eligible.length === 0) {
      skipped.push({ id: d.id, name: d.name, reason: "No matching products" });
      continue;
    }

    const eligibleSubtotal = eligible.reduce((s, l) => s + l.subtotalCents, 0);
    const eligibleQty = eligible.reduce((s, l) => s + l.quantity, 0);
    if (d.minPurchaseCents !== null && eligibleSubtotal < d.minPurchaseCents) {
      skipped.push({ id: d.id, name: d.name, reason: "Below minimum purchase" });
      continue;
    }
    if (d.minQuantity !== null && eligibleQty < d.minQuantity) {
      skipped.push({ id: d.id, name: d.name, reason: "Below minimum quantity" });
      continue;
    }

    // Discounts stack on what is left after earlier discounts.
    const remaining = eligible.map((l) => l.subtotalCents - l.discountCents);
    const remainingTotal = remaining.reduce((a, b) => a + b, 0);
    if (remainingTotal <= 0) {
      skipped.push({ id: d.id, name: d.name, reason: "Nothing left to discount" });
      continue;
    }

    let parts: number[];
    if (d.type === "PERCENTAGE") {
      const amount = Math.min(percentOf(remainingTotal, d.valueCents), remainingTotal);
      parts = allocate(amount, remaining);
    } else {
      parts = allocate(Math.min(d.valueCents, remainingTotal), remaining);
    }

    const amount = parts.reduce((a, b) => a + b, 0);
    if (amount <= 0) {
      skipped.push({ id: d.id, name: d.name, reason: "Zero amount" });
      continue;
    }
    eligible.forEach((l, i) => (l.discountCents += parts[i]));
    applied.push({ id: d.id, name: d.name, amountCents: amount });
  }

  for (const l of priced) {
    const taxable = l.subtotalCents - l.discountCents;
    l.taxCents = percentOf(taxable, l.taxBasisPoints);
    l.totalCents = taxable + l.taxCents;
  }

  const discountCents = priced.reduce((s, l) => s + l.discountCents, 0);
  const taxCents = priced.reduce((s, l) => s + l.taxCents, 0);
  return {
    lines: priced,
    applied,
    skipped,
    untaxedCents,
    discountCents,
    taxCents,
    totalCents: untaxedCents - discountCents + taxCents,
  };
}
