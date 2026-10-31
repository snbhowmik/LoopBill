import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDate, today as getToday } from "@/lib/dates";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, LinkButton, PageHeader, Stat } from "@/components/ui";
import { runBillingNow } from "./actions";

export const metadata: Metadata = { title: "Billing run" };

export default async function BillingPage() {
  const today = getToday();
  const [due, toActivate, toClose, drafts, runs] = await Promise.all([
    db.subscription.count({ where: { status: "ACTIVE", nextInvoiceDate: { lte: today } } }),
    db.subscription.count({ where: { status: "CONFIRMED", startDate: { lte: today } } }),
    db.subscription.count({ where: { status: "ACTIVE", expiryDate: { lte: today }, plan: { autoClose: true } } }),
    db.invoice.count({ where: { status: "DRAFT" } }),
    db.activity.findMany({
      where: { entity: "subscription", entityId: "billing-run" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Billing run"
        subtitle={`Creates every invoice that is due as of ${formatDate(today)}. Safe to run any number of times — periods are never billed twice or skipped.`}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Subscriptions due" value={due.toLocaleString()} hint="Next invoice date reached" />
        <Stat label="Ready to activate" value={toActivate.toLocaleString()} hint="Confirmed, start date reached" />
        <Stat label="To close at expiry" value={toClose.toLocaleString()} hint="Plans that close on their own" />
        <Stat label="Draft invoices" value={drafts.toLocaleString()} hint="Waiting for confirmation" href="/invoices?status=DRAFT" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Run now">
          <p className="mb-4 text-sm text-ink-2">
            The run activates confirmed subscriptions whose start date has arrived, creates a draft invoice for every
            due billing period (catching up any missed periods), applies taxes and valid discounts, and closes expired
            subscriptions on auto-closing plans. Schedule it daily with <code className="rounded bg-surface-2 px-1 text-[13px]">POST /api/cron/billing</code>.
          </p>
          <ActionForm action={runBillingNow} className="flex flex-col items-start gap-3">
            <div className="flex gap-2">
              <SubmitButton>Run billing</SubmitButton>
              <LinkButton href="/invoices?status=DRAFT">Review drafts</LinkButton>
            </div>
          </ActionForm>
        </Card>
        <Card title="Recent runs">
          {runs.length ? (
            <ol className="space-y-3 text-sm">
              {runs.map((r) => (
                <li key={r.id}>
                  <div>{r.message.replace("Billing run: ", "")}</div>
                  <div className="text-xs text-muted">
                    {r.user?.name ?? "Scheduler"} · {r.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No manual runs yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
