import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, parseDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PAGE_SIZE, oneOf, pageParam, param } from "@/lib/params";
import { DateFilter, FilterBar, SearchFilter, SelectFilter } from "@/components/filters";
import { Card, EmptyState, PageHeader, Pagination, Stat, Table, Td, Th } from "@/components/ui";
import { paymentMethodLabel } from "@/server/invoices";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentMethod } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  const sp = await searchParams;
  const method = oneOf(param(sp, "method"), Object.values(PaymentMethod));
  const q = param(sp, "q");
  const from = parseDate(param(sp, "from"));
  const to = parseDate(param(sp, "to"));
  const page = pageParam(sp);

  const where: Prisma.PaymentWhereInput = {
    ...(method ? { method } : {}),
    ...(from || to ? { paidOn: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { invoice: { number: { contains: q, mode: "insensitive" } } },
            { invoice: { customer: { name: { contains: q, mode: "insensitive" } } } },
            { note: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total, sum, byMethod] = await Promise.all([
    db.payment.findMany({
      where,
      include: { invoice: { select: { id: true, number: true, customer: { select: { name: true } } } } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.payment.count({ where }),
    db.payment.aggregate({ where, _sum: { amount: true } }),
    db.payment.groupBy({ by: ["method"], where, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } } }),
  ]);

  return (
    <>
      <PageHeader title="Payments" subtitle="Money received, matched to the invoice it pays." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Collected (filtered)" value={formatMoney(sum._sum.amount ?? 0)} hint={`${total.toLocaleString()} payments`} tone="accent" />
        {byMethod.slice(0, 3).map((m) => (
          <Stat key={m.method} label={paymentMethodLabel[m.method]} value={formatMoney(m._sum.amount ?? 0)} />
        ))}
      </div>
      <Card padded={false}>
        <FilterBar>
          <SearchFilter placeholder="Invoice, customer or note…" />
          <SelectFilter name="method" label="All methods" options={Object.entries(paymentMethodLabel).map(([value, label]) => ({ value, label }))} />
          <DateFilter name="from" label="Paid from" />
          <DateFilter name="to" label="to" />
        </FilterBar>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                <Th>Method</Th>
                <Th>Note</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50">
                  <Td className="num whitespace-nowrap">{formatDate(p.paidOn)}</Td>
                  <Td>
                    <Link href={`/invoices/${p.invoice.id}`} className="num font-medium text-accent hover:underline">{p.invoice.number}</Link>
                  </Td>
                  <Td>{p.invoice.customer.name}</Td>
                  <Td>{paymentMethodLabel[p.method]}</Td>
                  <Td className="text-ink-2">{p.note ?? "—"}</Td>
                  <Td align="right">{formatMoney(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No payments match">Record payments from an invoice page.</EmptyState>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/payments" params={{ method, q, from: param(sp, "from"), to: param(sp, "to") }} />
      </Card>
    </>
  );
}
