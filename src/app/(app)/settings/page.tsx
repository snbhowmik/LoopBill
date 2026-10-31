import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { fromCents, toCents } from "@/lib/money";
import { ActionForm, Checkbox, Input, SubmitButton } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { saveTax, saveTerm } from "./actions";

export const metadata: Metadata = { title: "Taxes & payment terms" };

const row = "grid grid-cols-[1fr_110px_auto] items-center gap-2 border-b border-line px-5 py-3 last:border-0 [&>[role]]:col-span-3 [&>[role]]:mb-0";

export default async function SettingsPage() {
  await requireAdmin();
  const [taxes, terms] = await Promise.all([
    db.tax.findMany({ orderBy: [{ active: "desc" }, { rate: "desc" }] }),
    db.paymentTerm.findMany({ orderBy: { dueDays: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Taxes & payment terms" subtitle="Rules used to calculate every invoice automatically." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Taxes" padded={false}>
          <p className="border-b border-line px-5 py-3 text-xs text-muted">Assign taxes to products and plans. Rates are applied to the discounted line amount.</p>
          {taxes.map((t) => (
            <ActionForm key={t.id} action={saveTax.bind(null, t.id)} className={`${row} grid-cols-[1fr_90px_auto_auto]`}>
              <Input name="name" defaultValue={t.name} aria-label="Tax name" />
              <div className="relative"><Input name="rate" defaultValue={fromCents(toCents(t.rate))} className="num pr-6" aria-label="Rate" /><span className="absolute top-2 right-2.5 text-sm text-muted">%</span></div>
              <Checkbox name="active" label="Active" defaultChecked={t.active} />
              <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
            </ActionForm>
          ))}
          <ActionForm action={saveTax.bind(null, null)} className={`${row} bg-surface-2/50`} resetOnSuccess>
            <Input name="name" placeholder="New tax, e.g. GST 28%" aria-label="New tax name" />
            <div className="relative"><Input name="rate" placeholder="Rate" className="num pr-6" aria-label="New tax rate" /><span className="absolute top-2 right-2.5 text-sm text-muted">%</span></div>
            <SubmitButton size="sm">Add</SubmitButton>
          </ActionForm>
        </Card>
        <Card title="Payment terms" padded={false}>
          <p className="border-b border-line px-5 py-3 text-xs text-muted">The due date of an invoice is its invoice date plus these days.</p>
          {terms.map((t) => (
            <ActionForm key={t.id} action={saveTerm.bind(null, t.id)} className={row}>
              <Input name="name" defaultValue={t.name} aria-label="Term name" />
              <div className="relative"><Input name="dueDays" type="number" min={0} defaultValue={t.dueDays} className="num pr-12" aria-label="Due days" /><span className="absolute top-2 right-2.5 text-sm text-muted">days</span></div>
              <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
            </ActionForm>
          ))}
          <ActionForm action={saveTerm.bind(null, null)} className={`${row} bg-surface-2/50`} resetOnSuccess>
            <Input name="name" placeholder="New term, e.g. 45 days" aria-label="New term name" />
            <div className="relative"><Input name="dueDays" type="number" min={0} placeholder="0" className="num pr-12" aria-label="New term due days" /><span className="absolute top-2 right-2.5 text-sm text-muted">days</span></div>
            <SubmitButton size="sm">Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
