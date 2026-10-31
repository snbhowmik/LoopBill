import type { Metadata } from "next";
import { db } from "@/lib/db";
import { parseDate, today as getToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PAGE_SIZE, pageParam, param } from "@/lib/params";
import { InvoiceTable } from "@/components/billing-parts";
import { DateFilter, FilterBar, SearchFilter, Tabs } from "@/components/filters";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SelectAll } from "@/components/select-all";
import { Card, EmptyState, LinkButton, PageHeader, Pagination, Stat } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";
import { bulkInvoiceAction } from "./actions";

export const metadata: Metadata = { title: "Invoices" };

const VIEWS = ["DRAFT", "CONFIRMED", "OVERDUE", "PAID", "CANCELLED"] as const;

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const sp = await searchParams;
  const today = getToday();
  const view = VIEWS.find((v) => v === param(sp, "status"));
  const q = param(sp, "q");
  const from = parseDate(param(sp, "from"));
  const to = parseDate(param(sp, "to"));
  const page = pageParam(sp);

  const base: Prisma.InvoiceWhereInput = {
    ...(from || to ? { invoiceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { subscription: { number: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const overdueWhere: Prisma.InvoiceWhereInput = { status: "CONFIRMED", dueDate: { lt: today } };
  const where: Prisma.InvoiceWhereInput =
    view === "OVERDUE" ? { ...base, ...overdueWhere } : view ? { ...base, status: view } : base;

  const [rows, total, byStatus, overdue, sums] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { customer: { select: { name: true } } },
      orderBy: [{ invoiceDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.invoice.count({ where }),
    db.invoice.groupBy({ by: ["status"], where: base, _count: true }),
    db.invoice.aggregate({ where: { ...base, ...overdueWhere }, _count: true, _sum: { total: true, amountPaid: true } }),
    db.invoice.aggregate({ where: { ...where, status: view === "CANCELLED" ? "CANCELLED" : { not: "CANCELLED" } }, _sum: { total: true, amountPaid: true } }),
  ]);

  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const invoiced = Number(sums._sum.total ?? 0);
  const collected = Number(sums._sum.amountPaid ?? 0);
  const overdueAmount = Number(overdue._sum.total ?? 0) - Number(overdue._sum.amountPaid ?? 0);
  const hasDrafts = rows.some((r) => r.status === "DRAFT");

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Created automatically from subscriptions on each billing date."
        actions={<LinkButton href="/billing" variant="primary">Run billing</LinkButton>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Invoiced (filtered)" value={formatMoney(invoiced)} />
        <Stat label="Collected" value={formatMoney(collected)} tone="accent" />
        <Stat label="Outstanding" value={formatMoney(invoiced - collected)} />
        <Stat label="Overdue" value={formatMoney(overdueAmount)} hint={`${overdue._count} invoices`} tone="danger" href="/invoices?status=OVERDUE" />
      </div>
      <Card padded={false}>
        <Tabs
          name="status"
          tabs={[
            { value: "", label: "All", count: byStatus.reduce((a, b) => a + b._count, 0) },
            { value: "DRAFT", label: "Draft", count: count("DRAFT") },
            { value: "CONFIRMED", label: "Confirmed", count: count("CONFIRMED") },
            { value: "OVERDUE", label: "Overdue", count: overdue._count },
            { value: "PAID", label: "Paid", count: count("PAID") },
            { value: "CANCELLED", label: "Cancelled", count: count("CANCELLED") },
          ]}
        />
        <FilterBar>
          <SearchFilter placeholder="Invoice, customer or subscription…" />
          <DateFilter name="from" label="Invoice date from" />
          <DateFilter name="to" label="to" />
        </FilterBar>
        {hasDrafts && (
          <ActionForm id="bulk-invoices" action={bulkInvoiceAction} className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-4 py-2.5 [&>[role]]:mb-0 [&>[role]]:w-full">
            <SelectAll form="bulk-invoices" />
            <div className="flex gap-2">
              <SubmitButton size="sm" variant="secondary" name="action" value="confirm">Confirm selected</SubmitButton>
              <SubmitButton size="sm" name="action" value="confirmSend">Confirm &amp; send selected</SubmitButton>
            </div>
          </ActionForm>
        )}
        {rows.length ? (
          <InvoiceTable invoices={rows} hrefBase="/invoices" today={today} showCustomer selectable={hasDrafts} />
        ) : (
          <EmptyState title="No invoices match">Change the filters, or run billing to create due invoices.</EmptyState>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/invoices" params={{ status: view, q, from: param(sp, "from"), to: param(sp, "to") }} />
      </Card>
    </>
  );
}
