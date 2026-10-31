import { formatDate, formatPeriod } from "@/lib/dates";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import { companyEmail, companyName } from "@/lib/mail";
import { Logo } from "./logo";
import { Totals } from "./billing-parts";

type Dec = { toString(): string };

export type InvoiceForDocument = {
  number: string;
  status: string;
  invoiceDate: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  untaxedAmount: Dec;
  discountAmount: Dec;
  taxAmount: Dec;
  total: Dec;
  amountPaid: Dec;
  customer: { name: string; email: string; company: string | null; address: string | null; taxId: string | null; phone: string | null };
  subscription: { number: string } | null;
  lines: { id: string; description: string; quantity: number; unitPrice: Dec; discountAmount: Dec; taxLabel: string | null; taxAmount: Dec; subtotal: Dec }[];
  discounts: { id: string; amount: Dec; discount: { name: string } }[];
};

/** The invoice as the customer sees it: used on screen, in the portal and for printing. */
export function InvoiceDocument({ invoice: inv }: { invoice: InvoiceForDocument }) {
  const outstanding = toCents(inv.total) - toCents(inv.amountPaid);
  return (
    <article className="p-6 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Logo />
          <div className="mt-3 text-sm text-ink-2">
            <div className="font-medium text-ink">{companyName()}</div>
            <div>{companyEmail()}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs tracking-wider text-muted uppercase">{inv.status === "DRAFT" ? "Draft invoice" : "Invoice"}</div>
          <div className="num text-xl font-semibold">{inv.number}</div>
          {inv.status === "PAID" && <div className="mt-1 text-sm font-medium text-accent">Paid in full</div>}
          {inv.status === "CANCELLED" && <div className="mt-1 text-sm font-medium text-danger">Cancelled</div>}
        </div>
      </header>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs text-muted">Bill to</div>
          <div className="font-medium">{inv.customer.name}</div>
          {inv.customer.company && inv.customer.company !== inv.customer.name && <div>{inv.customer.company}</div>}
          {inv.customer.address && <div className="text-ink-2">{inv.customer.address}</div>}
          <div className="text-ink-2">{inv.customer.email}</div>
          {inv.customer.phone && <div className="text-ink-2">{inv.customer.phone}</div>}
          {inv.customer.taxId && <div className="text-ink-2">Tax ID: {inv.customer.taxId}</div>}
        </div>
        <dl className="num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-muted">Invoice date</dt><dd className="text-right">{formatDate(inv.invoiceDate)}</dd>
          <dt className="text-muted">Due date</dt><dd className="text-right">{formatDate(inv.dueDate)}</dd>
          <dt className="text-muted">Billing period</dt><dd className="text-right whitespace-nowrap">{formatPeriod(inv.periodStart, inv.periodEnd)}</dd>
          {inv.subscription && (<><dt className="text-muted">Subscription</dt><dd className="text-right">{inv.subscription.number}</dd></>)}
        </dl>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-strong text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 px-3 text-right font-medium">Qty</th>
              <th className="py-2 px-3 text-right font-medium">Unit price</th>
              <th className="py-2 px-3 text-right font-medium">Discount</th>
              <th className="py-2 px-3 font-medium">Taxes</th>
              <th className="py-2 pl-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="num">
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-2.5 pr-3 font-sans">{l.description}</td>
                <td className="py-2.5 px-3 text-right">{l.quantity}</td>
                <td className="py-2.5 px-3 text-right">{formatMoney(l.unitPrice)}</td>
                <td className="py-2.5 px-3 text-right">{toCents(l.discountAmount) ? `−${formatMoney(l.discountAmount)}` : "—"}</td>
                <td className="py-2.5 px-3 font-sans text-ink-2 whitespace-nowrap">{l.taxLabel ?? "—"}</td>
                <td className="py-2.5 pl-3 text-right">{formatMoney(fromCents(toCents(l.subtotal) - toCents(l.discountAmount)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="-mx-4">
        <Totals
          rows={[
            ["Untaxed amount", formatMoney(inv.untaxedAmount)],
            ...inv.discounts.map((d) => [d.discount.name, `−${formatMoney(d.amount)}`] as [string, string]),
            ["Taxes", formatMoney(inv.taxAmount)],
          ]}
          total={formatMoney(inv.total)}
          after={
            inv.status === "CANCELLED"
              ? []
              : [
                  ["Paid", formatMoney(inv.amountPaid)],
                  ["Amount due", formatMoney(fromCents(outstanding))],
                ]
          }
        />
      </div>
    </article>
  );
}
