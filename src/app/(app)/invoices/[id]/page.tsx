import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDate, toISODate, today as getToday } from "@/lib/dates";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { ActivityLog, isOverdue } from "@/components/billing-parts";
import { ActionForm, ConfirmButton, Field, Input, Select, SubmitButton } from "@/components/forms";
import { InvoiceDocument } from "@/components/invoice-document";
import { Card, LinkButton, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { paymentMethodLabel } from "@/server/invoices";
import { addPayment, invoiceAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: inv?.number ?? "Invoice" };
}

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  await requireStaff();
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: { select: { id: true, number: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      discounts: { include: { discount: { select: { name: true } } } },
      payments: { orderBy: { paidOn: "desc" }, include: { recordedBy: { select: { name: true } } } },
    },
  });
  if (!inv) notFound();

  const today = getToday();
  const outstanding = toCents(inv.total) - toCents(inv.amountPaid);
  const overdue = isOverdue(inv, today);
  const act = invoiceAction.bind(null, inv.id);

  return (
    <>
      <PageHeader
        back={{ href: "/invoices", label: "Invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{inv.number}</span>
            <StatusBadge status={overdue ? "OVERDUE" : inv.status} />
          </span>
        }
        subtitle={
          <>
            {inv.customer.name}
            {inv.subscription && (
              <>
                {" · "}
                <Link href={`/subscriptions/${inv.subscription.id}`} className="text-accent hover:underline">{inv.subscription.number}</Link>
              </>
            )}
            {inv.sentAt && <> · sent {formatDate(inv.sentAt)}</>}
          </>
        }
        actions={
          <ActionForm action={act} className="flex flex-wrap items-center justify-end gap-2 [&>[role]]:mb-0 [&>[role]]:w-full">
            <LinkButton href={`/print/invoices/${inv.id}`} target="_blank">Print</LinkButton>
            {inv.status === "DRAFT" && (
              <>
                <SubmitButton variant="secondary" name="action" value="confirm">Confirm</SubmitButton>
                <SubmitButton name="action" value="confirmSend">Confirm &amp; send</SubmitButton>
              </>
            )}
            {(inv.status === "CONFIRMED" || inv.status === "PAID") && (
              <SubmitButton variant={inv.sentAt ? "secondary" : "primary"} name="action" value="send">
                {inv.sentAt ? "Send again" : "Send"}
              </SubmitButton>
            )}
            {(inv.status === "DRAFT" || (inv.status === "CONFIRMED" && toCents(inv.amountPaid) === 0)) && (
              <ConfirmButton name="action" value="cancel">Cancel invoice</ConfirmButton>
            )}
          </ActionForm>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card padded={false}>
            <InvoiceDocument invoice={inv} />
          </Card>

          <Card title="Payments" padded={false}>
            {inv.payments.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Note</Th>
                    <Th>Recorded by</Th>
                    <Th align="right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <Td className="num whitespace-nowrap">{formatDate(p.paidOn)}</Td>
                      <Td className="whitespace-nowrap">{paymentMethodLabel[p.method]}</Td>
                      <Td className="text-ink-2">{p.note ?? "—"}</Td>
                      <Td className="text-ink-2">{p.recordedBy?.name ?? "—"}</Td>
                      <Td align="right">{formatMoney(p.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">No payments recorded.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Balance">
            <dl className="num space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Total</dt><dd>{formatMoney(inv.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Paid</dt><dd className="text-accent">{formatMoney(inv.amountPaid)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <dt>Outstanding</dt>
                <dd className={overdue ? "text-danger" : undefined}>{inv.status === "CANCELLED" ? "—" : formatMoney(fromCents(outstanding))}</dd>
              </div>
              <div className="flex justify-between text-xs"><dt className="text-muted">Due date</dt><dd className={overdue ? "text-danger" : "text-ink-2"}>{formatDate(inv.dueDate)}</dd></div>
            </dl>
          </Card>

          {inv.status === "CONFIRMED" && outstanding > 0 && (
            <Card title="Record payment">
              <ActionForm action={addPayment.bind(null, inv.id)} className="space-y-3" resetOnSuccess>
                <Field label="Method" name="method">
                  <Select name="method" defaultValue="BANK_TRANSFER">
                    {Object.entries(paymentMethodLabel).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount" name="amount">
                    <Input name="amount" inputMode="decimal" defaultValue={fromCents(outstanding)} className="num" />
                  </Field>
                  <Field label="Date" name="paidOn">
                    <Input name="paidOn" type="date" defaultValue={toISODate(today)} max={toISODate(today)} />
                  </Field>
                </div>
                <Field label="Note" name="note">
                  <Input name="note" placeholder="Bank reference, cheque no.…" />
                </Field>
                <SubmitButton className="w-full">Record payment</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {inv.status === "DRAFT" && (
            <Card title="Record payment">
              <p className="text-sm text-muted">Confirm the invoice before recording payments against it.</p>
            </Card>
          )}

          <Card title="Activity">
            <ActivityLog entity="invoice" entityId={inv.id} />
          </Card>
        </div>
      </div>
    </>
  );
}
