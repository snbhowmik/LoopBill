import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDate, periodLabel, today as getToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ActivityLog, InvoiceTable, PricedLines, StatusStepper } from "@/components/billing-parts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { SubscriptionActions } from "@/components/subscription-actions";
import { Badge, Card, DescriptionList, EmptyState, LinkButton, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { discountUsable, previewInvoice } from "@/server/billing";
import { availableActions } from "@/server/subscriptions";
import { invoiceNow, subscriptionAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/subscriptions/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await db.subscription.findUnique({ where: { id }, select: { number: true } });
  return { title: s?.number ?? "Subscription" };
}

export default async function SubscriptionPage({ params }: PageProps<"/subscriptions/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const sub = await db.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: { include: { taxes: true } },
      paymentTerm: true,
      template: true,
      lines: { include: { product: true, variant: true, taxes: true }, orderBy: { id: "asc" } },
      discounts: { include: { products: { select: { id: true } } } },
      invoices: { orderBy: { periodStart: "desc" }, take: 12 },
      _count: { select: { invoices: true } },
    },
  });
  if (!sub) notFound();

  const today = getToday();
  const actions = availableActions(sub, user.role, today);
  const preview = previewInvoice(sub, today);
  const quotationExpired = sub.status === "QUOTATION" && sub.quotationValidUntil && sub.quotationValidUntil < today;
  const canInvoice = sub.status === "ACTIVE" && sub.nextInvoiceDate !== null;

  return (
    <>
      <PageHeader
        back={{ href: "/subscriptions", label: "Subscriptions" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{sub.number}</span>
            <StatusBadge status={sub.status} />
          </span>
        }
        subtitle={
          <>
            <Link href={`/customers/${sub.customerId}`} className="text-ink hover:underline">{sub.customer.name}</Link> ·{" "}
            {sub.plan.name} ({periodLabel[sub.plan.billingPeriod]})
          </>
        }
        actions={
          <>
            {sub.status !== "CLOSED" && <LinkButton href={`/subscriptions/${sub.id}/edit`}>Edit</LinkButton>}
            {canInvoice && (
              <ActionForm action={invoiceNow.bind(null, sub.id)} className="contents">
                <SubmitButton variant="secondary">Invoice next period now</SubmitButton>
              </ActionForm>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
        <StatusStepper status={sub.status} />
        <SubscriptionActions actions={actions} action={subscriptionAction.bind(null, sub.id)} />
      </div>

      {quotationExpired && (
        <div className="mb-6">
          <Notice tone="warn">This quotation expired on {formatDate(sub.quotationValidUntil)}. Send it again to renew its validity.</Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Details">
            <DescriptionList
              items={[
                ["Customer", <Link key="c" href={`/customers/${sub.customerId}`} className="text-accent hover:underline">{sub.customer.name}</Link>],
                ["Plan", `${sub.plan.name} · ${formatMoney(sub.plan.price)} per unit / ${periodLabel[sub.plan.billingPeriod].toLowerCase()}`],
                ["Start date", formatDate(sub.startDate)],
                ["Expiry date", sub.expiryDate ? formatDate(sub.expiryDate) : "Open-ended"],
                ["Payment terms", sub.paymentTerm.name],
                ["Next invoice", sub.status === "ACTIVE" ? (sub.nextInvoiceDate ? formatDate(sub.nextInvoiceDate) : "No further periods") : "—"],
                ["Quotation template", sub.template?.name ?? "—"],
                ["Quotation valid until", formatDate(sub.quotationValidUntil)],
                ["Plan rules", [
                  sub.plan.autoClose ? "closes automatically at expiry" : "stays open after expiry",
                  sub.plan.closable ? "can close early" : "no early close",
                  sub.plan.pausable ? "pausable" : "not pausable",
                  sub.plan.renewable ? "renewable" : "not renewable",
                ].join(" · ")],
              ]}
            />
            {sub.notes && <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{sub.notes}</p>}
          </Card>

          <Card
            title={sub.status === "ACTIVE" || sub.status === "PAUSED" ? "Next invoice preview" : "Order lines"}
            padded={false}
          >
            <PricedLines priced={preview} />
          </Card>

          <Card
            title={`Invoices (${sub._count.invoices})`}
            padded={false}
            actions={sub._count.invoices > 12 ? <Link href={`/invoices?q=${encodeURIComponent(sub.number)}`} className="text-[13px] text-accent hover:underline">View all</Link> : null}
          >
            {sub.invoices.length ? (
              <InvoiceTable invoices={sub.invoices} hrefBase="/invoices" today={today} />
            ) : (
              <EmptyState title="No invoices yet">Invoices are created on each billing date once the subscription is active.</EmptyState>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Discounts">
            {sub.discounts.length === 0 ? (
              <p className="text-sm text-muted">No discounts applied.</p>
            ) : (
              <ul className="space-y-3">
                {sub.discounts.map((d) => {
                  const usable = discountUsable(d, today);
                  const applied = preview.applied.find((a) => a.id === d.id);
                  const skipped = preview.skipped.find((a) => a.id === d.id);
                  return (
                    <li key={d.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/discounts/${d.id}`} className="font-medium hover:underline">{d.name}</Link>
                        {applied ? <Badge tone="accent">Applies</Badge> : usable ? <Badge tone="warn">Not met</Badge> : <Badge>Inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted">
                        {!usable
                          ? d.usageLimit !== null && d.usedCount >= d.usageLimit
                            ? "Usage limit reached"
                            : "Outside its validity dates"
                          : skipped?.reason ?? `−${formatMoney(applied!.amountCents / 100)} on next invoice`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Activity">
            <ActivityLog entity="subscription" entityId={sub.id} />
          </Card>
        </div>
      </div>
    </>
  );
}
