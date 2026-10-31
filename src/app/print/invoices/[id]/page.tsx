import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: PageProps<"/print/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: inv ? `Invoice ${inv.number}` : "Invoice" };
}

export default async function PrintInvoicePage({ params }: PageProps<"/print/invoices/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: { select: { number: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      discounts: { include: { discount: { select: { name: true } } } },
    },
  });
  // Customers may only print their own invoices.
  if (!inv || (user.role === "CUSTOMER" && inv.customerId !== user.customerId)) notFound();

  return (
    <div className="min-h-screen bg-canvas py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl justify-end px-4">
        <PrintButton />
      </div>
      <div className="mx-auto max-w-3xl rounded-xl border border-line bg-surface print:max-w-none print:rounded-none print:border-0">
        <InvoiceDocument invoice={inv} />
      </div>
    </div>
  );
}
