import "server-only";
import { db, type Tx } from "@/lib/db";
import { logActivity, nextNumber } from "@/lib/activity";
import { addDays, addPeriods, periodLabel, toISODate, today as getToday } from "@/lib/dates";
import { fromCents, toBasisPoints, toCents } from "@/lib/money";
import { priceInvoice, type PricingDiscount, type PricingLine } from "@/lib/pricing";
import type { Prisma } from "@/generated/prisma/client";

const subscriptionForBilling = {
  plan: { include: { taxes: true } },
  paymentTerm: true,
  lines: { include: { product: true, variant: true, taxes: true }, orderBy: { id: "asc" } },
  discounts: { include: { products: { select: { id: true } } } },
} satisfies Prisma.SubscriptionInclude;

type BillableSubscription = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionForBilling }>;
type Discount = BillableSubscription["discounts"][number];

function taxInfo(taxes: { name: string; rate: unknown; active: boolean }[]) {
  const live = taxes.filter((t) => t.active);
  return {
    taxBasisPoints: live.reduce((s, t) => s + toBasisPoints(t.rate as string), 0),
    taxLabel: live.length ? live.map((t) => t.name).join(", ") : null,
  };
}

/** Invoice lines for one billing period: the plan itself plus add-on lines. */
export function invoiceLinesFor(sub: BillableSubscription): PricingLine[] {
  const planLine: PricingLine = {
    key: "plan",
    description: `${sub.plan.name} — ${periodLabel[sub.plan.billingPeriod]} plan`,
    productId: null,
    quantity: sub.quantity,
    unitPriceCents: toCents(sub.plan.price),
    ...taxInfo(sub.plan.taxes),
  };
  const addOns = sub.lines.map<PricingLine>((l) => ({
    key: l.id,
    description: l.variant
      ? `${l.product.name} (${l.variant.attribute}: ${l.variant.value})`
      : l.product.name,
    productId: l.productId,
    quantity: l.quantity,
    unitPriceCents: toCents(l.unitPrice),
    ...taxInfo(l.taxes),
  }));
  return toCents(sub.plan.price) > 0 || addOns.length === 0 ? [planLine, ...addOns] : addOns;
}

/** Whether a discount rule can still be used on a given date. */
export function discountUsable(d: Pick<Discount, "active" | "startDate" | "endDate" | "usageLimit" | "usedCount">, on: Date) {
  if (!d.active) return false;
  if (d.startDate && d.startDate > on) return false;
  if (d.endDate && d.endDate < on) return false;
  if (d.usageLimit !== null && d.usedCount >= d.usageLimit) return false;
  return true;
}

export function toPricingDiscount(d: Discount): PricingDiscount {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    valueCents: toCents(d.value),
    scope: d.scope,
    productIds: d.products.map((p) => p.id),
    minPurchaseCents: d.minPurchase === null ? null : toCents(d.minPurchase),
    minQuantity: d.minQuantity,
  };
}

/** Preview of the next invoice, without side effects. */
export function previewInvoice(sub: BillableSubscription, on: Date = getToday()) {
  const discounts = sub.discounts
    .filter((d) => discountUsable(d, on))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(toPricingDiscount);
  return priceInvoice(invoiceLinesFor(sub), discounts);
}

export type BillResult =
  | { status: "invoiced"; invoiceId: string; number: string }
  | { status: "skipped"; reason: string };

/**
 * Bill the next un-invoiced period of a subscription.
 *
 * The subscription row is locked for the duration of the transaction so that
 * concurrent billing runs serialise; the billing cursor (`invoicedCycles`) and
 * the invoice are written atomically, and a partial unique index on
 * (subscriptionId, periodStart) rejects any duplicate that slips through.
 */
export async function billNextCycle(
  subscriptionId: string,
  opts: { today?: Date; force?: boolean; userId?: string | null } = {},
): Promise<BillResult> {
  const runDate = opts.today ?? getToday();

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Subscription" WHERE "id" = ${subscriptionId} FOR UPDATE`;
      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: subscriptionForBilling,
      });
      if (!sub) return { status: "skipped", reason: "Subscription not found" };
      if (sub.status !== "ACTIVE") return { status: "skipped", reason: "Subscription is not active" };

      const period = sub.plan.billingPeriod;
      const periodStart = addPeriods(sub.startDate, period, sub.invoicedCycles);
      if (sub.expiryDate && periodStart >= sub.expiryDate) {
        await tx.subscription.update({ where: { id: sub.id }, data: { nextInvoiceDate: null } });
        return { status: "skipped", reason: "Subscription has reached its expiry date" };
      }
      if (!opts.force && periodStart > runDate) {
        return { status: "skipped", reason: "Next period is not due yet" };
      }

      let periodEnd = addPeriods(sub.startDate, period, sub.invoicedCycles + 1);
      if (sub.expiryDate && periodEnd > sub.expiryDate) periodEnd = sub.expiryDate;

      // Lock discount rows in a stable order so usage limits are exact under concurrency.
      const usable = await lockUsableDiscounts(tx, sub.discounts, runDate);
      const priced = priceInvoice(invoiceLinesFor(sub), usable.map(toPricingDiscount));

      const number = await nextNumber("invoice", tx);
      const invoice = await tx.invoice.create({
        data: {
          number,
          subscriptionId: sub.id,
          customerId: sub.customerId,
          periodStart,
          periodEnd,
          invoiceDate: runDate,
          dueDate: addDays(runDate, sub.paymentTerm.dueDays),
          untaxedAmount: fromCents(priced.untaxedCents),
          discountAmount: fromCents(priced.discountCents),
          taxAmount: fromCents(priced.taxCents),
          total: fromCents(priced.totalCents),
          lines: {
            create: priced.lines.map((l, i) => ({
              productId: l.productId,
              description: l.description,
              quantity: l.quantity,
              unitPrice: fromCents(l.unitPriceCents),
              subtotal: fromCents(l.subtotalCents),
              discountAmount: fromCents(l.discountCents),
              taxRate: fromCents(l.taxBasisPoints),
              taxLabel: l.taxLabel,
              taxAmount: fromCents(l.taxCents),
              total: fromCents(l.totalCents),
              sortOrder: i,
            })),
          },
          discounts: {
            create: priced.applied.map((a) => ({ discountId: a.id, amount: fromCents(a.amountCents) })),
          },
        },
      });

      for (const a of priced.applied) {
        await tx.discount.update({ where: { id: a.id }, data: { usedCount: { increment: 1 } } });
      }

      const cycles = sub.invoicedCycles + 1;
      const next = addPeriods(sub.startDate, period, cycles);
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          invoicedCycles: cycles,
          nextInvoiceDate: sub.expiryDate && next >= sub.expiryDate ? null : next,
        },
      });

      await logActivity("subscription", sub.id, `Invoice ${number} created`, opts.userId, tx);
      await logActivity(
        "invoice",
        invoice.id,
        priced.applied.length
          ? `Created from ${sub.number} with ${priced.applied.map((a) => a.name).join(", ")}`
          : `Created from ${sub.number}`,
        opts.userId,
        tx,
      );
      return { status: "invoiced", invoiceId: invoice.id, number };
    },
    { timeout: 15_000 },
  );
}

async function lockUsableDiscounts(tx: Tx, discounts: Discount[], on: Date) {
  const candidates = discounts.filter((d) => discountUsable(d, on));
  if (candidates.length === 0) return [];
  const ids = candidates.map((d) => d.id).sort();
  const fresh = await tx.$queryRaw<{ id: string; usedCount: number }[]>`
    SELECT "id", "usedCount" FROM "Discount" WHERE "id" = ANY(${ids}) ORDER BY "id" FOR UPDATE`;
  const usedCount = new Map(fresh.map((r) => [r.id, r.usedCount]));
  return candidates
    .map((d) => ({ ...d, usedCount: usedCount.get(d.id) ?? d.usedCount }))
    .filter((d) => discountUsable(d, on))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export type BillingRunSummary = {
  activated: number;
  invoiced: number;
  closed: number;
  failed: { subscription: string; error: string }[];
  durationMs: number;
};

const MAX_CATCH_UP = 400; // safety cap on periods billed per subscription per run
const CONCURRENCY = 4;

/**
 * Daily billing run. Safe to run any number of times a day: it activates
 * confirmed subscriptions whose start date has arrived, bills every due period
 * (catching up missed ones, never skipping), and closes expired subscriptions
 * on plans that close automatically.
 */
export async function runBilling(opts: { today?: Date; userId?: string | null } = {}) {
  const started = Date.now();
  const runDate = opts.today ?? getToday();
  const summary: BillingRunSummary = { activated: 0, invoiced: 0, closed: 0, failed: [], durationMs: 0 };

  // 1. Activate confirmed subscriptions that have started.
  const activated = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Subscription"
    SET "status" = 'ACTIVE', "activatedAt" = now(), "invoicedCycles" = 0,
        "nextInvoiceDate" = "startDate", "updatedAt" = now()
    WHERE "status" = 'CONFIRMED' AND "startDate" <= ${toISODate(runDate)}::date
    RETURNING "id"`;
  if (activated.length) {
    await db.activity.createMany({
      data: activated.map(({ id }) => ({
        entity: "subscription",
        entityId: id,
        message: "Activated by billing run (start date reached)",
        userId: opts.userId ?? null,
      })),
    });
    summary.activated = activated.length;
  }

  // 2. Bill everything that is due.
  const attempted = new Set<string>();
  for (;;) {
    const due = await db.subscription.findMany({
      where: { status: "ACTIVE", nextInvoiceDate: { lte: runDate }, id: { notIn: [...attempted] } },
      select: { id: true, number: true },
      orderBy: { nextInvoiceDate: "asc" },
      take: 200,
    });
    if (due.length === 0) break;

    let cursor = 0;
    const worker = async () => {
      while (cursor < due.length) {
        const sub = due[cursor++];
        attempted.add(sub.id);
        try {
          for (let i = 0; i < MAX_CATCH_UP; i++) {
            const r = await billNextCycle(sub.id, { today: runDate, userId: opts.userId });
            if (r.status !== "invoiced") break;
            summary.invoiced++;
          }
        } catch (err) {
          summary.failed.push({ subscription: sub.number, error: (err as Error).message });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  // 3. Close expired subscriptions on auto-closing plans.
  const expired = await db.subscription.findMany({
    where: { status: "ACTIVE", expiryDate: { lte: runDate }, plan: { autoClose: true } },
    select: { id: true },
  });
  if (expired.length) {
    const ids = expired.map((s) => s.id);
    await db.subscription.updateMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      data: { status: "CLOSED", closedAt: new Date(), nextInvoiceDate: null },
    });
    await db.activity.createMany({
      data: ids.map((id) => ({
        entity: "subscription",
        entityId: id,
        message: "Closed automatically at expiry",
        userId: opts.userId ?? null,
      })),
    });
    summary.closed = ids.length;
  }

  summary.durationMs = Date.now() - started;
  return summary;
}
