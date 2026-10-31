import { describe, expect, it } from "vitest";
import { allocate } from "./money";
import { addPeriods, parseDate, periodsBetween, toISODate } from "./dates";
import { priceInvoice, type PricingDiscount, type PricingLine } from "./pricing";

const line = (over: Partial<PricingLine> = {}): PricingLine => ({
  key: "l1",
  description: "Item",
  productId: "p1",
  quantity: 1,
  unitPriceCents: 10_000,
  taxBasisPoints: 0,
  taxLabel: null,
  ...over,
});

const discount = (over: Partial<PricingDiscount> = {}): PricingDiscount => ({
  id: "d1",
  name: "Promo",
  type: "PERCENTAGE",
  valueCents: 1000,
  scope: "SUBSCRIPTION",
  productIds: [],
  minPurchaseCents: null,
  minQuantity: null,
  ...over,
});

describe("priceInvoice", () => {
  it("computes subtotal, tax and total", () => {
    const r = priceInvoice([line({ quantity: 3, unitPriceCents: 999, taxBasisPoints: 1800 })], []);
    expect(r.untaxedCents).toBe(2997);
    expect(r.taxCents).toBe(539); // 539.46
    expect(r.totalCents).toBe(3536);
  });

  it("taxes the discounted amount", () => {
    const r = priceInvoice([line({ taxBasisPoints: 1800 })], [discount({ valueCents: 1000 })]);
    expect(r.discountCents).toBe(1000);
    expect(r.taxCents).toBe(1620);
    expect(r.totalCents).toBe(10_620);
  });

  it("applies product-scoped discounts only to matching lines", () => {
    const r = priceInvoice(
      [line({ key: "a", productId: "p1" }), line({ key: "b", productId: "p2" })],
      [discount({ scope: "PRODUCTS", productIds: ["p2"], type: "FIXED", valueCents: 2500 })],
    );
    expect(r.lines[0].discountCents).toBe(0);
    expect(r.lines[1].discountCents).toBe(2500);
  });

  it("never discounts below zero", () => {
    const r = priceInvoice([line()], [discount({ type: "FIXED", valueCents: 50_000 })]);
    expect(r.discountCents).toBe(10_000);
    expect(r.totalCents).toBe(0);
  });

  it("respects minimum quantity and purchase", () => {
    const lines = [line({ quantity: 4 })];
    const r1 = priceInvoice(lines, [discount({ minQuantity: 5 })]);
    expect(r1.applied).toHaveLength(0);
    expect(r1.skipped[0].reason).toMatch(/quantity/);
    const r2 = priceInvoice(lines, [discount({ minPurchaseCents: 50_000 })]);
    expect(r2.applied).toHaveLength(0);
    const r3 = priceInvoice(lines, [discount({ minQuantity: 4, minPurchaseCents: 40_000 })]);
    expect(r3.applied[0].amountCents).toBe(4000);
  });

  it("allocates a fixed discount across lines without losing a cent", () => {
    const r = priceInvoice(
      [line({ key: "a", unitPriceCents: 3333 }), line({ key: "b", unitPriceCents: 3333 }), line({ key: "c", unitPriceCents: 3334 })],
      [discount({ type: "FIXED", valueCents: 1000 })],
    );
    expect(r.lines.reduce((s, l) => s + l.discountCents, 0)).toBe(1000);
  });

  it("stacks discounts on the remaining amount", () => {
    const r = priceInvoice(
      [line()],
      [discount({ id: "a", valueCents: 1000 }), discount({ id: "b", valueCents: 1000 })],
    );
    expect(r.discountCents).toBe(1000 + 900);
  });
});

describe("allocate", () => {
  it("sums exactly to the total", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("billing periods", () => {
  const jan31 = parseDate("2026-01-31")!;
  it("clamps month ends without drifting", () => {
    expect(toISODate(addPeriods(jan31, "MONTHLY", 1))).toBe("2026-02-28");
    expect(toISODate(addPeriods(jan31, "MONTHLY", 2))).toBe("2026-03-31");
    expect(toISODate(addPeriods(parseDate("2028-02-29")!, "YEARLY", 1))).toBe("2029-02-28");
  });
  it("counts periods covering a range", () => {
    expect(periodsBetween(jan31, parseDate("2027-01-31")!, "MONTHLY")).toBe(12);
    expect(periodsBetween(jan31, parseDate("2026-02-10")!, "WEEKLY")).toBe(2);
  });
});
