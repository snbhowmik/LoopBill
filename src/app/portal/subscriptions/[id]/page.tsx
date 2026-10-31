import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { formatDate, periodLabel, today as getToday } from "@/lib/dates";
import { InvoiceTable, PricedLines, StatusStepper } from "@/components/billing-parts";
import { SubscriptionActions } from "@/components/subscription-actions";
import { Card, DescriptionList, EmptyState, Notice, StatusBadge } from "@/components/ui";
import { previewInvoice } from "@/server/billing";
import { availableActions } from "@/server/subscriptions";
import { portalSubscriptionAction } from "../../actions";

export const metadata: Metadata = { title: "Subscription" };

export default async function PortalSubscription({ params }: PageProps<"/portal/subscriptions/[id]">) {
  const user = await requireCustomer();
  const { id } = await params;
  const sub = await db.subscription.findFirst({
    where: { id, customerId: user.customerId ?? "", status: { not: "DRAFT" } },
    include: {
      plan: { include: { taxes: true } },
      paymentTerm: true,
      lines: { include: { product: true, variant: true, taxes: true }, orderBy: { id: "asc" } },
      discounts: { include: { products: { select: { id: true } } } },
      invoices: { where: { status: { not: "DRAFT" } }, orderBy: { periodStart: "desc" }, take: 12 },
    },
  });
  if (!sub) notFound();

  const today = getToday();
  const actions = availableActions(sub, "CUSTOMER", today);
  const expired = sub.status === "QUOTATION" && sub.quotationValidUntil && sub.quotationValidUntil < today;
  const preview = previewInvoice(sub, today);

  return (
    <>
      <Link href="/portal/subscriptions" className="mb-2 inline-block text-[13px] text-muted hover:text-ink">← Subscriptions</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {sub.plan.name} <StatusBadge status={sub.status} />
          </h1>
          <p className="num mt-1 text-sm text-muted">{sub.number} · billed {periodLabel[sub.plan.billingPeriod].toLowerCase()}</p>
        </div>
        <SubscriptionActions
          actions={expired ? actions.filter((a) => a !== "confirm") : actions}
          action={portalSubscriptionAction.bind(null, sub.id)}
          labels={{ confirm: "Accept quotation", close: "Cancel subscription" }}
        />
      </div>

      {sub.status === "QUOTATION" && (
        <div className="mb-6">
          <Notice tone={expired ? "warn" : "info"}>
            {expired
              ? `This quotation expired on ${formatDate(sub.quotationValidUntil)}. Contact us for an updated offer.`
              : `Review the offer below and accept it before ${formatDate(sub.quotationValidUntil)}.`}
          </Notice>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-line bg-surface p-4">
        <StatusStepper status={sub.status} />
      </div>

      <div className="space-y-6">
        <Card title="Details">
          <DescriptionList
            items={[
              ["Start date", formatDate(sub.startDate)],
              ["Expiry date", sub.expiryDate ? formatDate(sub.expiryDate) : "Open-ended"],
              ["Payment terms", sub.paymentTerm.name],
              ["Next invoice", sub.status === "ACTIVE" && sub.nextInvoiceDate ? formatDate(sub.nextInvoiceDate) : "—"],
            ]}
          />
        </Card>
        <Card title={sub.status === "QUOTATION" ? "What you'll pay each period" : "Next invoice preview"} padded={false}>
          <PricedLines priced={preview} />
        </Card>
        <Card title="Invoices" padded={false}>
          {sub.invoices.length ? <InvoiceTable invoices={sub.invoices} hrefBase="/portal/invoices" today={today} /> : <EmptyState title="No invoices yet" />}
        </Card>
      </div>
    </>
  );
}
