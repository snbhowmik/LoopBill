import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { today as getToday } from "@/lib/dates";
import { PAGE_SIZE, pageParam } from "@/lib/params";
import { InvoiceTable } from "@/components/billing-parts";
import { Card, EmptyState, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "My invoices" };

export default async function PortalInvoices({ searchParams }: PageProps<"/portal/invoices">) {
  const user = await requireCustomer();
  const page = pageParam(await searchParams);
  const where = { customerId: user.customerId ?? "", status: { not: "DRAFT" as const } };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: { invoiceDate: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.invoice.count({ where }),
  ]);
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Invoices</h1>
      <Card padded={false}>
        {rows.length ? <InvoiceTable invoices={rows} hrefBase="/portal/invoices" today={getToday()} /> : <EmptyState title="No invoices yet" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/portal/invoices" params={{}} />
      </Card>
    </>
  );
}
