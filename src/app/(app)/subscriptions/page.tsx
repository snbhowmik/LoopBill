import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatCents, toCents } from "@/lib/money";
import { PAGE_SIZE, oneOf, pageParam, param } from "@/lib/params";
import { FilterBar, SearchFilter, SelectFilter, Tabs } from "@/components/filters";
import { Card, EmptyState, LinkButton, PageHeader, Pagination, StatusBadge, Table, Td, Th } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { SubscriptionStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Subscriptions" };

const STATUSES = Object.values(SubscriptionStatus);

export default async function SubscriptionsPage({ searchParams }: PageProps<"/subscriptions">) {
  const sp = await searchParams;
  const status = oneOf(param(sp, "status"), STATUSES);
  const q = param(sp, "q");
  const planId = param(sp, "plan");
  const page = pageParam(sp);

  const base: Prisma.SubscriptionWhereInput = {
    ...(planId ? { planId } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const where = { ...base, ...(status ? { status } : {}) };

  const [rows, total, counts, plans] = await Promise.all([
    db.subscription.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        plan: { select: { name: true, price: true, billingPeriod: true } },
        lines: { select: { quantity: true, unitPrice: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.subscription.count({ where }),
    db.subscription.groupBy({ by: ["status"], where: base, _count: true }),
    db.recurringPlan.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const all = counts.reduce((a, c) => a + c._count, 0);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="Every customer contract, from first quotation to close."
        actions={<LinkButton variant="primary" href="/subscriptions/new">New subscription</LinkButton>}
      />
      <Card padded={false}>
        <Tabs
          name="status"
          tabs={[
            { value: "", label: "All", count: all },
            ...STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase(), count: countOf(s) })),
          ]}
        />
        <FilterBar>
          <SearchFilter placeholder="Search number or customer…" />
          <SelectFilter name="plan" label="All plans" options={plans.map((p) => ({ value: p.id, label: p.name }))} />
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState title="No subscriptions found">Try a different filter, or create a new subscription.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Customer</Th>
                <Th>Plan</Th>
                <Th align="right">Recurring (excl. tax)</Th>
                <Th>Start</Th>
                <Th>Expiry</Th>
                <Th>Next invoice</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const recurring =
                  s.quantity * toCents(s.plan.price) + s.lines.reduce((a, l) => a + l.quantity * toCents(l.unitPrice), 0);
                return (
                  <tr key={s.id} className="hover:bg-surface-2/50">
                    <Td>
                      <Link href={`/subscriptions/${s.id}`} className="num font-medium text-accent hover:underline">
                        {s.number}
                      </Link>
                    </Td>
                    <Td>{s.customer.name}</Td>
                    <Td>
                      {s.plan.name} <span className="text-muted">· {periodLabel[s.plan.billingPeriod]}</span>
                    </Td>
                    <Td align="right">{formatCents(recurring)}</Td>
                    <Td className="num whitespace-nowrap">{formatDate(s.startDate)}</Td>
                    <Td className="num whitespace-nowrap">{formatDate(s.expiryDate)}</Td>
                    <Td className="num whitespace-nowrap">{s.status === "ACTIVE" ? formatDate(s.nextInvoiceDate) : "—"}</Td>
                    <Td><StatusBadge status={s.status} /></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/subscriptions"
          params={{ status, q, plan: planId }}
        />
      </Card>
    </>
  );
}
