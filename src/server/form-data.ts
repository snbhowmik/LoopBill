import "server-only";
import { db } from "@/lib/db";
import { toBasisPoints, toCents } from "@/lib/money";
import { toISODate } from "@/lib/dates";

/** Reference data the subscription and template forms need, in plain JSON. */
export async function subscriptionFormOptions() {
  const [customers, plans, products, terms, discounts, templates] = await Promise.all([
    db.customer.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    db.recurringPlan.findMany({ where: { active: true }, include: { taxes: true }, orderBy: { name: "asc" } }),
    db.product.findMany({
      where: { active: true },
      include: { variants: { orderBy: { value: "asc" } }, taxes: true },
      orderBy: { name: "asc" },
    }),
    db.paymentTerm.findMany({ orderBy: { dueDays: "asc" } }),
    db.discount.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.quotationTemplate.findMany({ include: { lines: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    customers,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: toCents(p.price),
      billingPeriod: p.billingPeriod,
      minQuantity: p.minQuantity,
      availableFrom: toISODate(p.availableFrom),
      availableUntil: toISODate(p.availableUntil),
      taxBp: p.taxes.filter((t) => t.active).reduce((s, t) => s + toBasisPoints(t.rate), 0),
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCents: toCents(p.salesPrice),
      taxBp: p.taxes.filter((t) => t.active).reduce((s, t) => s + toBasisPoints(t.rate), 0),
      variants: p.variants.map((v) => ({
        id: v.id,
        label: `${v.attribute}: ${v.value}`,
        extraCents: toCents(v.extraPrice),
      })),
    })),
    terms: terms.map((t) => ({ id: t.id, name: t.name })),
    discounts: discounts.map((d) => ({
      id: d.id,
      name: d.name,
      endDate: toISODate(d.endDate),
      exhausted: d.usageLimit !== null && d.usedCount >= d.usageLimit,
    })),
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      planId: t.planId,
      quantity: t.quantity,
      durationCount: t.durationCount,
      paymentTermId: t.paymentTermId,
      notes: t.notes,
      lines: t.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    })),
  };
}

export type SubscriptionFormOptions = Awaited<ReturnType<typeof subscriptionFormOptions>>;
