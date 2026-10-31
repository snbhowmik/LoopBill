// Integration tests against the real database (DATABASE_URL). They create
// their own records and remove them afterwards.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays, addPeriods, today } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { billNextCycle, runBilling } from "./billing";
import { cancelInvoice } from "./invoices";
import { transition } from "./subscriptions";

const tag = `test-${Date.now()}`;
const created = { customers: [] as string[], plans: [] as string[], discounts: [] as string[], terms: [] as string[] };
const admin = { id: "", email: "", name: "Test", role: "ADMIN" as const, customerId: null };

async function makeSubscription(opts: { startDaysAgo: number; quantity?: number; discountIds?: string[]; planId?: string }) {
  const customer = await db.customer.create({ data: { name: tag, email: `${tag}-${Math.random()}@example.test` } });
  created.customers.push(customer.id);
  const start = addDays(today(), -opts.startDaysAgo);
  return db.subscription.create({
    data: {
      number: `${tag}-${Math.random().toString(36).slice(2, 8)}`,
      customerId: customer.id,
      planId: opts.planId ?? created.plans[0],
      paymentTermId: created.terms[0],
      status: "ACTIVE",
      quantity: opts.quantity ?? 2,
      startDate: start,
      nextInvoiceDate: start,
      discounts: { connect: (opts.discountIds ?? []).map((id) => ({ id })) },
    },
  });
}

const invoicesOf = (subscriptionId: string) =>
  db.invoice.findMany({ where: { subscriptionId }, orderBy: { periodStart: "asc" } });

beforeAll(async () => {
  const tax = await db.tax.create({ data: { name: `${tag} 18%`, rate: "18.00" } });
  const plan = await db.recurringPlan.create({
    data: { name: tag, price: "100.00", billingPeriod: "MONTHLY", pausable: true, taxes: { connect: [{ id: tax.id }] } },
  });
  created.plans.push(plan.id);
  const term = await db.paymentTerm.create({ data: { name: tag, dueDays: 15 } });
  created.terms.push(term.id);
  const user = await db.user.create({ data: { email: `${tag}@example.test`, name: "Test", role: "ADMIN" } });
  admin.id = user.id;
  admin.email = user.email;
});

afterAll(async () => {
  const subs = await db.subscription.findMany({ where: { customerId: { in: created.customers } }, select: { id: true } });
  const subIds = subs.map((s) => s.id);
  const invIds = (await db.invoice.findMany({ where: { subscriptionId: { in: subIds } }, select: { id: true } })).map((i) => i.id);
  await db.activity.deleteMany({ where: { entityId: { in: [...subIds, ...invIds] } } });
  await db.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
  await db.invoice.deleteMany({ where: { id: { in: invIds } } });
  await db.subscription.deleteMany({ where: { id: { in: subIds } } });
  await db.customer.deleteMany({ where: { id: { in: created.customers } } });
  await db.discount.deleteMany({ where: { id: { in: created.discounts } } });
  await db.recurringPlan.deleteMany({ where: { id: { in: created.plans } } });
  await db.tax.deleteMany({ where: { name: { startsWith: tag } } });
  await db.paymentTerm.deleteMany({ where: { id: { in: created.terms } } });
  await db.user.deleteMany({ where: { id: admin.id } });
  await db.$disconnect();
});

describe("billing engine", () => {
  it("bills each period exactly once under concurrent runs", async () => {
    const sub = await makeSubscription({ startDaysAgo: 0 });
    const results = await Promise.all(Array.from({ length: 6 }, () => billNextCycle(sub.id)));
    expect(results.filter((r) => r.status === "invoiced")).toHaveLength(1);
    const invoices = await invoicesOf(sub.id);
    expect(invoices).toHaveLength(1);
    // 2 × 100 + 18% tax
    expect(toCents(invoices[0].total)).toBe(23_600);
  });

  it("catches up every missed period without gaps", async () => {
    const sub = await makeSubscription({ startDaysAgo: 95 });
    for (let i = 0; i < 10; i++) if ((await billNextCycle(sub.id)).status !== "invoiced") break;
    const invoices = await invoicesOf(sub.id);
    expect(invoices.length).toBe(4); // periods starting 95, ~65, ~34, ~4 days ago
    for (let i = 1; i < invoices.length; i++) {
      expect(invoices[i].periodStart.getTime()).toBe(invoices[i - 1].periodEnd.getTime());
    }
    const s = await db.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(s.nextInvoiceDate?.getTime()).toBe(addPeriods(sub.startDate, "MONTHLY", 4).getTime());
  });

  it("never exceeds a discount's usage limit, even concurrently", async () => {
    const d = await db.discount.create({ data: { name: `${tag} once`, type: "FIXED", value: "10.00", usageLimit: 1 } });
    created.discounts.push(d.id);
    const subs = await Promise.all([0, 1, 2, 3].map(() => makeSubscription({ startDaysAgo: 0, discountIds: [d.id] })));
    await Promise.all(subs.map((s) => billNextCycle(s.id)));
    const usages = await db.invoiceDiscount.count({ where: { discountId: d.id } });
    expect(usages).toBe(1);
    expect((await db.discount.findUniqueOrThrow({ where: { id: d.id } })).usedCount).toBe(1);
  });

  it("returns a discount use when its invoice is cancelled", async () => {
    const d = await db.discount.create({ data: { name: `${tag} pct`, type: "PERCENTAGE", value: "50.00", usageLimit: 5 } });
    created.discounts.push(d.id);
    const sub = await makeSubscription({ startDaysAgo: 0, discountIds: [d.id] });
    const r = await billNextCycle(sub.id);
    expect(r.status).toBe("invoiced");
    const inv = (await invoicesOf(sub.id))[0];
    expect(toCents(inv.discountAmount)).toBe(10_000);
    await cancelInvoice(inv.id, admin);
    expect((await db.discount.findUniqueOrThrow({ where: { id: d.id } })).usedCount).toBe(0);
  });

  it("does not bill periods that ended while paused", async () => {
    const sub = await makeSubscription({ startDaysAgo: 0 });
    await billNextCycle(sub.id);
    await transition(sub.id, "pause", admin);
    expect((await billNextCycle(sub.id, { force: true })).status).toBe("skipped");
    await transition(sub.id, "resume", admin);
    expect((await invoicesOf(sub.id)).length).toBe(1);
  });

  it("billing run is idempotent", async () => {
    await makeSubscription({ startDaysAgo: 40 });
    await runBilling();
    const second = await runBilling();
    expect(second.invoiced).toBe(0);
    expect(second.failed).toHaveLength(0);
  });
});
