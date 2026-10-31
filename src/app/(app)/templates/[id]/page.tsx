import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { periodUnit } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { saveTemplate } from "../actions";
import { TemplateLinesEditor } from "../lines-editor";

export const metadata: Metadata = { title: "Quotation template" };

export default async function TemplatePage({ params, searchParams }: PageProps<"/templates/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const saved = (await searchParams).saved;
  const isNew = id === "new";
  const [t, plans, terms, products] = await Promise.all([
    isNew ? null : db.quotationTemplate.findUnique({ where: { id }, include: { lines: true } }),
    db.recurringPlan.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.paymentTerm.findMany({ orderBy: { dueDays: "asc" } }),
    db.product.findMany({ where: { active: true }, include: { variants: true }, orderBy: { name: "asc" } }),
  ]);
  if ((!isNew && !t) || (isNew && user.role !== "ADMIN")) notFound();
  const readOnly = user.role !== "ADMIN";

  return (
    <>
      <PageHeader
        title={isNew ? "New quotation template" : t!.name}
        back={{ href: "/templates", label: "Quotation templates" }}
        actions={t && <LinkButton variant="primary" href={`/subscriptions/new?template=${t.id}`}>New quotation from template</LinkButton>}
      />
      {readOnly && <div className="mb-4"><Notice>Only an admin can change templates.</Notice></div>}
      {saved && !readOnly && <div className="mb-4"><Notice tone="accent">Template saved.</Notice></div>}
      <ActionForm action={saveTemplate.bind(null, isNew ? null : id)}>
        <fieldset disabled={readOnly} className="space-y-6">
          <Card title="Offer">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" name="name" className="sm:col-span-3">
                <Input name="name" defaultValue={t?.name} required />
              </Field>
              <Field label="Recurring plan" name="planId">
                <Select name="planId" defaultValue={t?.planId ?? ""} required>
                  <option value="">Select…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.price)} / {periodUnit[p.billingPeriod]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Seats" name="quantity">
                <Input name="quantity" type="number" min={1} defaultValue={t?.quantity ?? 1} />
              </Field>
              <Field label="Contract length (billing periods)" name="durationCount" hint="Empty = open-ended">
                <Input name="durationCount" type="number" min={1} defaultValue={t?.durationCount ?? ""} />
              </Field>
              <Field label="Quotation valid for (days)" name="validityDays">
                <Input name="validityDays" type="number" min={1} defaultValue={t?.validityDays ?? 30} />
              </Field>
              <Field label="Payment terms" name="paymentTermId">
                <Select name="paymentTermId" defaultValue={t?.paymentTermId ?? ""}>
                  <option value="">Choose when quoting</option>
                  {terms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
              </Field>
            </div>
          </Card>
          <Card title="Product lines">
            <TemplateLinesEditor
              disabled={readOnly}
              products={products.map((p) => ({ id: p.id, name: p.name, variants: p.variants.map((v) => ({ id: v.id, label: `${v.attribute}: ${v.value}` })) }))}
              initial={(t?.lines ?? []).map((l) => ({ productId: l.productId, variantId: l.variantId ?? "", quantity: String(l.quantity) }))}
            />
          </Card>
          <Card title="Notes">
            <Textarea name="notes" defaultValue={t?.notes ?? ""} placeholder="Copied into new quotations" />
          </Card>
          {!readOnly && (
            <div className="flex justify-end">
              <SubmitButton>{isNew ? "Create template" : "Save template"}</SubmitButton>
            </div>
          )}
        </fieldset>
      </ActionForm>
    </>
  );
}
