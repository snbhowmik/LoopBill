import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, monthlyFactor, parseDate, periodLabel, toISODate, today as getToday } from "@/lib/dates";
import { formatCents, formatMoney, toCents } from "@/lib/money";
import { param } from "@/lib/params";
import { DateFilter, SelectFilter } from "@/components/filters";
import { RevenueChart } from "@/components/revenue-chart";
import { Card, EmptyState, LinkButton, PageHeader, Stat, StatusBadge, Table, Td, Th } from "@/components/ui";
import { Prisma } from "@/generated/prisma/client";
import type { BillingPeriod } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const today = getToday();
  const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));
  const from = parseDate(param(sp, "from")) ?? defaultFrom;
  const to = parseDate(param(sp, "to")) ?? today;
  const planId = param(sp, "plan");

  const planSub = planId ? Prisma.sql`AND s."planId" = ${planId}` : Prisma.empty;
  const planInv = planId ? Prisma.sql`AND i."subscriptionId" IN (SELECT id FROM "Subscription" WHERE "planId" = ${planId})` : Prisma.empty;
  const fromISO = toISODate(from);
  const toISO = toISODate(to);
  const todayISO = toISODate(today);

  const [byPlan, statusCounts, collectedByMonth, receivables, invoicedInRange, overdueList, plans] = await Promise.all([
    // Recurring revenue of active subscriptions, per plan (per billing period, excl. tax).
    db.$queryRaw<{ id: string; name: string; billingPeriod: BillingPeriod; subs: bigint; seats: bigint; perPeriod: Prisma.Decimal }[]>`
      SELECT p.id, p.name, p."billingPeriod", count(s.id) AS subs, sum(s.quantity) AS seats,
             sum(s.quantity * p.price + coalesce(l.addons, 0)) AS "perPeriod"
      FROM "Subscription" s
      JOIN "RecurringPlan" p ON p.id = s."planId"
      LEFT JOIN (SELECT "subscriptionId", sum(quantity * "unitPrice") AS addons FROM "SubscriptionLine" GROUP BY 1) l
        ON l."subscriptionId" = s.id
      WHERE s.status = 'ACTIVE' ${planSub}
      GROUP BY p.id ORDER BY "perPeriod" DESC`,
    db.$queryRaw<{ status: string; n: bigint }[]>`
      SELECT s.status::text, count(*) AS n FROM "Subscription" s WHERE true ${planSub} GROUP BY 1`,
    db.$queryRaw<{ month: string; cents: bigint }[]>`
      SELECT to_char(date_trunc('month', pay."paidOn"), 'YYYY-MM') AS month, round(sum(pay.amount) * 100)::bigint AS cents
      FROM "Payment" pay JOIN "Invoice" i ON i.id = pay."invoiceId"
      WHERE pay."paidOn" BETWEEN ${fromISO}::date AND ${toISO}::date ${planInv}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ outstanding: Prisma.Decimal | null; overdue: Prisma.Decimal | null; overdueCount: bigint }[]>`
      SELECT sum(i.total - i."amountPaid") AS outstanding,
             sum(i.total - i."amountPaid") FILTER (WHERE i."dueDate" < ${todayISO}::date) AS overdue,
             count(*) FILTER (WHERE i."dueDate" < ${todayISO}::date) AS "overdueCount"
      FROM "Invoice" i WHERE i.status = 'CONFIRMED' ${planInv}`,
    db.$queryRaw<{ invoiced: Prisma.Decimal | null; n: bigint }[]>`
      SELECT sum(i.total) AS invoiced, count(*) AS n FROM "Invoice" i
      WHERE i.status IN ('CONFIRMED', 'PAID') AND i."invoiceDate" BETWEEN ${fromISO}::date AND ${toISO}::date ${planInv}`,
    db.invoice.findMany({
      where: {
        status: "CONFIRMED",
        dueDate: { lt: today },
        ...(planId ? { subscription: { planId } } : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    db.recurringPlan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const planRows = byPlan.map((r) => {
    const perPeriod = toCents(r.perPeriod);
    return { ...r, perPeriod, mrr: Math.round(perPeriod * monthlyFactor[r.billingPeriod]) };
  });
  const mrr = planRows.reduce((a, r) => a + r.mrr, 0);
  const activeCount = Number(statusCounts.find((s) => s.status === "ACTIVE")?.n ?? 0);

  // Fill every month in range so gaps show as zero.
  const months: { key: string; label: string; cents: number }[] = [];
  const got = new Map(collectedByMonth.map((m) => [m.month, Number(m.cents)]));
  for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)); d <= to; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const key = d.toISOString().slice(0, 7);
    months.push({ key, label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }), cents: got.get(key) ?? 0 });
    if (months.length > 36) break;
  }
  const collected = months.reduce((a, m) => a + m.cents, 0);
  const rec = receivables[0];
  const statusOrder = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "PAUSED", "CLOSED"];

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`Subscriptions, revenue and receivables · ${formatDate(from)} – ${formatDate(to)}`}
        actions={<LinkButton href="/billing" variant="primary">Run billing</LinkButton>}
      />
      <div className="mb-6 flex flex-wrap items-end gap-2">
        <DateFilter name="from" label="From" />
        <DateFilter name="to" label="To" />
        <SelectFilter name="plan" label="All plans" options={plans.map((p) => ({ value: p.id, label: p.name }))} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Active subscriptions" value={activeCount.toLocaleString()} href="/subscriptions?status=ACTIVE" />
        <Stat label="Monthly recurring revenue" value={formatCents(mrr)} hint="Excl. tax, normalised to a month" />
        <Stat label="Collected in period" value={formatCents(collected)} tone="accent" href="/payments" />
        <Stat label="Outstanding" value={formatMoney(rec?.outstanding ?? 0)} hint={`Invoiced in period: ${formatMoney(invoicedInRange[0]?.invoiced ?? 0)}`} href="/invoices?status=CONFIRMED" />
        <Stat label="Overdue" value={formatMoney(rec?.overdue ?? 0)} hint={`${Number(rec?.overdueCount ?? 0)} invoices`} tone="danger" href="/invoices?status=OVERDUE" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Payments collected per month">
          <RevenueChart data={months} title="Payments collected per month" />
        </Card>
        <Card title="Subscriptions by status" padded={false}>
          <ul className="divide-y divide-line">
            {statusOrder.map((s) => (
              <li key={s}>
                <Link href={`/subscriptions?status=${s}`} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-surface-2/50">
                  <StatusBadge status={s} />
                  <span className="num font-medium">{Number(statusCounts.find((c) => c.status === s)?.n ?? 0).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recurring revenue by plan" padded={false}>
          {planRows.length ? (
            <Table>
              <thead>
                <tr><Th>Plan</Th><Th align="right">Active</Th><Th align="right">Seats</Th><Th align="right">MRR</Th><Th align="right">Share</Th></tr>
              </thead>
              <tbody>
                {planRows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.name} <span className="text-muted">· {periodLabel[r.billingPeriod]}</span></Td>
                    <Td align="right">{Number(r.subs)}</Td>
                    <Td align="right">{Number(r.seats)}</Td>
                    <Td align="right">{formatCents(r.mrr)}</Td>
                    <Td align="right" className="text-ink-2">{mrr ? `${Math.round((r.mrr / mrr) * 100)}%` : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No active subscriptions" />
          )}
        </Card>
        <Card
          title="Overdue invoices"
          padded={false}
          actions={<Link href="/invoices?status=OVERDUE" className="text-[13px] text-accent hover:underline">View all</Link>}
        >
          {overdueList.length ? (
            <Table>
              <thead>
                <tr><Th>Invoice</Th><Th>Customer</Th><Th align="right">Days late</Th><Th align="right">Balance</Th></tr>
              </thead>
              <tbody>
                {overdueList.map((inv) => (
                  <tr key={inv.id}>
                    <Td><Link href={`/invoices/${inv.id}`} className="num font-medium text-accent hover:underline">{inv.number}</Link></Td>
                    <Td>{inv.customer.name}</Td>
                    <Td align="right" className="text-danger">{Math.round((today.getTime() - inv.dueDate.getTime()) / 86_400_000)}</Td>
                    <Td align="right">{formatCents(toCents(inv.total) - toCents(inv.amountPaid))}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Nothing overdue">Every confirmed invoice is within its payment terms.</EmptyState>
          )}
        </Card>
      </div>
    </>
  );
}
