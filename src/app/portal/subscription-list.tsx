import Link from "next/link";
import { formatDate, periodUnit } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { StatusBadge } from "@/components/ui";
import { recurringCents, type customerSubscriptions } from "@/server/portal";

type Sub = Awaited<ReturnType<typeof customerSubscriptions>>[number];

export function SubscriptionCards({ subs }: { subs: Sub[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {subs.map((s) => (
        <li key={s.id}>
          <Link href={`/portal/subscriptions/${s.id}`} className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{s.plan.name}</div>
                <div className="num text-xs text-muted">{s.number}</div>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-3 flex items-end justify-between text-sm">
              <div className="num">
                <span className="text-lg font-semibold">{formatCents(recurringCents(s))}</span>
                <span className="text-muted"> / {periodUnit[s.plan.billingPeriod]} + tax</span>
              </div>
              <div className="text-right text-xs text-muted">
                {s.status === "QUOTATION"
                  ? `Valid until ${formatDate(s.quotationValidUntil)}`
                  : s.status === "ACTIVE" && s.nextInvoiceDate
                    ? `Next invoice ${formatDate(s.nextInvoiceDate)}`
                    : s.expiryDate
                      ? `Ends ${formatDate(s.expiryDate)}`
                      : null}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
