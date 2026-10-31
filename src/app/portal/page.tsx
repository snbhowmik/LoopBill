import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { today as getToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { InvoiceTable } from "@/components/billing-parts";
import { Card, EmptyState, Notice, Stat } from "@/components/ui";
import { customerSubscriptions } from "@/server/portal";
import { SubscriptionCards } from "./subscription-list";

export const metadata: Metadata = { title: "My account" };

export default async function PortalHome() {
  const user = await requireCustomer();
  const customerId = user.customerId ?? "";
  const today = getToday();
  const [subs, open, due] = await Promise.all([
    customerSubscriptions(customerId),
    db.invoice.findMany({ where: { customerId, status: "CONFIRMED" }, orderBy: { dueDate: "asc" }, take: 10 }),
    db.invoice.aggregate({ where: { customerId, status: "CONFIRMED" }, _sum: { total: true, amountPaid: true } }),
  ]);
  const quotes = subs.filter((s) => s.status === "QUOTATION");
  const live = subs.filter((s) => s.status === "ACTIVE" || s.status === "PAUSED" || s.status === "CONFIRMED");
  const owed = Number(due._sum.total ?? 0) - Number(due._sum.amountPaid ?? 0);
  const overdue = open.filter((i) => i.dueDate < today).length;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted">Your subscriptions and invoices, all in one place.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Active subscriptions" value={live.length} />
        <Stat label="Amount due" value={formatMoney(owed)} tone={overdue ? "danger" : undefined} hint={overdue ? `${overdue} overdue` : "Nothing overdue"} />
        <Stat label="Quotations to review" value={quotes.length} />
      </div>

      {quotes.length > 0 && (
        <div className="mt-6">
          <Notice tone="info">
            You have {quotes.length} quotation{quotes.length > 1 ? "s" : ""} waiting for your approval. Open {quotes.length > 1 ? "one" : "it"} to review and accept.
          </Notice>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Subscriptions</h2>
          <Link href="/portal/subscriptions" className="text-sm text-accent hover:underline">View all</Link>
        </div>
        {[...quotes, ...live].length ? <SubscriptionCards subs={[...quotes, ...live]} /> : <Card><EmptyState title="No active subscriptions" /></Card>}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Unpaid invoices</h2>
          <Link href="/portal/invoices" className="text-sm text-accent hover:underline">All invoices</Link>
        </div>
        <Card padded={false}>
          {open.length ? <InvoiceTable invoices={open} hrefBase="/portal/invoices" today={today} /> : <EmptyState title="You're all paid up" />}
        </Card>
      </section>
    </>
  );
}
