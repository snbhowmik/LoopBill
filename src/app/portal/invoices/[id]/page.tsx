import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { InvoiceDocument } from "@/components/invoice-document";
import { Card, LinkButton, Table, Td, Th } from "@/components/ui";
import { paymentMethodLabel } from "@/server/invoices";

export const metadata: Metadata = { title: "Invoice" };

export default async function PortalInvoice({ params }: PageProps<"/portal/invoices/[id]">) {
  const user = await requireCustomer();
  const { id } = await params;
  const inv = await db.invoice.findFirst({
    where: { id, customerId: user.customerId ?? "", status: { not: "DRAFT" } },
    include: {
      customer: true,
      subscription: { select: { number: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      discounts: { include: { discount: { select: { name: true } } } },
      payments: { orderBy: { paidOn: "desc" } },
    },
  });
  if (!inv) notFound();
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/portal/invoices" className="text-[13px] text-muted hover:text-ink">← Invoices</Link>
        <LinkButton href={`/print/invoices/${inv.id}`} target="_blank">Print / PDF</LinkButton>
      </div>
      <Card padded={false}>
        <InvoiceDocument invoice={inv} />
      </Card>
      {inv.payments.length > 0 && (
        <Card title="Payments received" padded={false} className="mt-6">
          <Table>
            <thead><tr><Th>Date</Th><Th>Method</Th><Th align="right">Amount</Th></tr></thead>
            <tbody>
              {inv.payments.map((p) => (
                <tr key={p.id}>
                  <Td className="num whitespace-nowrap">{formatDate(p.paidOn)}</Td>
                  <Td>{paymentMethodLabel[p.method]}</Td>
                  <Td align="right">{formatMoney(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
