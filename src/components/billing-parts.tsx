import Link from "next/link";
import { db } from "@/lib/db";
import { formatCents, formatMoney, toCents } from "@/lib/money";
import { formatDate, formatPeriod } from "@/lib/dates";
import type { PricingResult } from "@/lib/pricing";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { cx, StatusBadge, Table, Td, Th } from "./ui";

const STEPS: SubscriptionStatus[] = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];

export function StatusStepper({ status }: { status: SubscriptionStatus }) {
  const effective = status === "PAUSED" ? "ACTIVE" : status;
  const at = STEPS.indexOf(effective);
  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-[13px]">
      {STEPS.map((s, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s} className="flex items-center">
            <span
              className={cx(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                current && "bg-accent text-accent-ink font-medium",
                done && "text-accent",
                !current && !done && "text-muted",
              )}
            >
              <span className={cx("grid size-4 place-items-center rounded-full text-[10px]", current ? "bg-white/25" : done ? "bg-accent-soft" : "border border-line-strong")}>
                {done ? "✓" : i + 1}
              </span>
              {s === "ACTIVE" && status === "PAUSED" ? "Paused" : s.charAt(0) + s.slice(1).toLowerCase()}
            </span>
            {i < STEPS.length - 1 && <span className={cx("mx-1 h-px w-5", done ? "bg-accent" : "bg-line-strong")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Line table for a priced (not yet issued) invoice. */
export function PricedLines({ priced }: { priced: PricingResult }) {
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th>
            <Th align="right">Qty</Th>
            <Th align="right">Unit price</Th>
            <Th align="right">Discount</Th>
            <Th>Taxes</Th>
            <Th align="right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {priced.lines.map((l) => (
            <tr key={l.key}>
              <Td>{l.description}</Td>
              <Td align="right">{l.quantity}</Td>
              <Td align="right">{formatCents(l.unitPriceCents)}</Td>
              <Td align="right">{l.discountCents ? `−${formatCents(l.discountCents)}` : "—"}</Td>
              <Td className="text-ink-2 whitespace-nowrap">{l.taxLabel ?? "—"}</Td>
              <Td align="right">{formatCents(l.subtotalCents - l.discountCents)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Totals
        rows={[
          ["Untaxed amount", formatCents(priced.untaxedCents)],
          ...(priced.discountCents ? ([["Discounts", `−${formatCents(priced.discountCents)}`]] as [string, string][]) : []),
          ["Taxes", formatCents(priced.taxCents)],
        ]}
        total={formatCents(priced.totalCents)}
      />
    </>
  );
}

export function Totals({ rows, total, after }: { rows: [string, string][]; total: string; after?: [string, string][] }) {
  return (
    <div className="flex justify-end px-4 py-4">
      <dl className="num grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
        <dt className="border-t border-line pt-2 font-medium">Total</dt>
        <dd className="border-t border-line pt-2 text-right text-base font-semibold">{total}</dd>
        {after?.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export async function ActivityLog({ entity, entityId }: { entity: string; entityId: string }) {
  const items = await db.activity.findMany({
    where: { entity, entityId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  if (!items.length) return <p className="text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="relative pl-4 text-sm">
          <span className="absolute top-1.5 left-0 size-1.5 rounded-full bg-line-strong" />
          <div className="text-ink">{a.message}</div>
          <div className="text-xs text-muted">
            {a.user?.name ?? "System"} ·{" "}
            {a.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE ?? "Asia/Kolkata" })}
          </div>
        </li>
      ))}
    </ol>
  );
}

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  invoiceDate: Date;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  total: { toString(): string };
  amountPaid: { toString(): string };
  customer?: { name: string };
};

export function isOverdue(inv: { status: string; dueDate: Date }, today: Date) {
  return inv.status === "CONFIRMED" && inv.dueDate < today;
}

export function InvoiceTable({
  invoices,
  hrefBase,
  today,
  showCustomer,
  selectable,
}: {
  invoices: InvoiceRow[];
  hrefBase: string;
  today: Date;
  showCustomer?: boolean;
  selectable?: boolean;
}) {
  return (
    <Table>
      <thead>
        <tr>
          {selectable && <Th className="w-8"><span className="sr-only">Select</span></Th>}
          <Th>Number</Th>
          {showCustomer && <Th>Customer</Th>}
          <Th>Period</Th>
          <Th>Invoice date</Th>
          <Th>Due</Th>
          <Th align="right">Total</Th>
          <Th align="right">Balance</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => {
          const balance = toCents(inv.total) - toCents(inv.amountPaid);
          const overdue = isOverdue(inv, today);
          return (
            <tr key={inv.id} className="hover:bg-surface-2/50">
              {selectable && (
                <Td>
                  {inv.status === "DRAFT" && (
                    <input type="checkbox" name="invoiceIds" value={inv.id} form="bulk-invoices" aria-label={`Select ${inv.number}`} className="size-4 accent-[var(--accent)]" />
                  )}
                </Td>
              )}
              <Td>
                <Link href={`${hrefBase}/${inv.id}`} className="num font-medium text-accent hover:underline">
                  {inv.number}
                </Link>
              </Td>
              {showCustomer && <Td>{inv.customer?.name}</Td>}
              <Td className="num whitespace-nowrap text-ink-2">
                {formatPeriod(inv.periodStart, inv.periodEnd)}
              </Td>
              <Td className="num whitespace-nowrap">{formatDate(inv.invoiceDate)}</Td>
              <Td className={cx("num whitespace-nowrap", overdue && "font-medium text-danger")}>{formatDate(inv.dueDate)}</Td>
              <Td align="right">{formatMoney(inv.total)}</Td>
              <Td align="right">{inv.status === "CANCELLED" ? "—" : formatCents(balance)}</Td>
              <Td>
                <StatusBadge status={overdue ? "OVERDUE" : inv.status} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
