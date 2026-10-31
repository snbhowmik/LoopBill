import "server-only";
import { db } from "@/lib/db";
import { toCents } from "@/lib/money";

/** Per-period amount (excl. tax) for display in subscription lists. */
export function recurringCents(s: { quantity: number; plan: { price: { toString(): string } }; lines: { quantity: number; unitPrice: { toString(): string } }[] }) {
  return s.quantity * toCents(s.plan.price) + s.lines.reduce((a, l) => a + l.quantity * toCents(l.unitPrice), 0);
}

export function customerSubscriptions(customerId: string) {
  return db.subscription.findMany({
    where: { customerId, status: { not: "DRAFT" } },
    include: { plan: true, lines: { select: { quantity: true, unitPrice: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}
