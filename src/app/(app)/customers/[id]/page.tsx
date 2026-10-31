import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDate, periodLabel, today as getToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { InvoiceTable } from "@/components/billing-parts";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/forms";
import { Card, EmptyState, LinkButton, Notice, PageHeader, Stat, StatusBadge, Table, Td, Th } from "@/components/ui";
import { saveCustomer } from "../actions";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params, searchParams }: PageProps<"/customers/[id]">) {
  await requireStaff();
  const { id } = await params;
  const saved = (await searchParams).saved;
  const isNew = id === "new";
  const c = isNew
    ? null
    : await db.customer.findUnique({
        where: { id },
        include: {
          user: { select: { email: true, active: true } },
          subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
          invoices: { orderBy: { invoiceDate: "desc" }, take: 10 },
        },
      });
  if (!isNew && !c) notFound();

  const today = getToday();
  const totals = c
    ? await db.invoice.aggregate({ where: { customerId: c.id, status: { in: ["CONFIRMED", "PAID"] } }, _sum: { total: true, amountPaid: true } })
    : null;

  const form = (
    <ActionForm action={saveCustomer.bind(null, isNew ? null : id)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name"><Input name="name" defaultValue={c?.name} required /></Field>
        <Field label="Billing email" name="email"><Input name="email" type="email" defaultValue={c?.email} required /></Field>
        <Field label="Company" name="company"><Input name="company" defaultValue={c?.company ?? ""} /></Field>
        <Field label="Phone" name="phone"><Input name="phone" defaultValue={c?.phone ?? ""} /></Field>
        <Field label="Tax ID" name="taxId"><Input name="taxId" defaultValue={c?.taxId ?? ""} /></Field>
        <Field label="Address" name="address" className="sm:col-span-2"><Textarea name="address" rows={2} defaultValue={c?.address ?? ""} /></Field>
      </div>
      <div className="flex justify-end"><SubmitButton>{isNew ? "Create customer" : "Save"}</SubmitButton></div>
    </ActionForm>
  );

  if (isNew) {
    return (
      <>
        <PageHeader title="New customer" back={{ href: "/customers", label: "Customers" }} />
        <Card>{form}</Card>
      </>
    );
  }

  const invoiced = Number(totals?._sum.total ?? 0);
  const paid = Number(totals?._sum.amountPaid ?? 0);
  return (
    <>
      <PageHeader
        title={c!.name}
        subtitle={c!.email}
        back={{ href: "/customers", label: "Customers" }}
        actions={<LinkButton variant="primary" href={`/subscriptions/new?customer=${c!.id}`}>New subscription</LinkButton>}
      />
      {saved && <div className="mb-4"><Notice tone="accent">Customer saved.</Notice></div>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live subscriptions" value={c!.subscriptions.filter((s) => s.status === "ACTIVE" || s.status === "PAUSED").length} />
        <Stat label="Invoiced" value={formatMoney(invoiced)} />
        <Stat label="Paid" value={formatMoney(paid)} tone="accent" />
        <Stat label="Outstanding" value={formatMoney(invoiced - paid)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Subscriptions" padded={false}>
            {c!.subscriptions.length ? (
              <Table>
                <thead><tr><Th>Number</Th><Th>Plan</Th><Th>Start</Th><Th>Expiry</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {c!.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <Td><Link href={`/subscriptions/${s.id}`} className="num font-medium text-accent hover:underline">{s.number}</Link></Td>
                      <Td>{s.plan.name} <span className="text-muted">· {periodLabel[s.plan.billingPeriod]}</span></Td>
                      <Td className="num">{formatDate(s.startDate)}</Td>
                      <Td className="num">{formatDate(s.expiryDate)}</Td>
                      <Td><StatusBadge status={s.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No subscriptions yet" />
            )}
          </Card>
          <Card title="Recent invoices" padded={false}>
            {c!.invoices.length ? <InvoiceTable invoices={c!.invoices} hrefBase="/invoices" today={today} /> : <EmptyState title="No invoices yet" />}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Details">{form}</Card>
          <Card title="Portal access">
            <p className="text-sm text-ink-2">
              {c!.user
                ? `${c!.user.email} can sign in to see subscriptions and invoices.`
                : `No login yet. The customer can create one at the sign-up page using ${c!.email}; it links to this record automatically.`}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
