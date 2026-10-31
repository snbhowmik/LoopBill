import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { toISODate } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, Notice, PageHeader } from "@/components/ui";
import { savePlan } from "../actions";

export const metadata: Metadata = { title: "Recurring plan" };

export default async function PlanPage({ params, searchParams }: PageProps<"/plans/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const saved = (await searchParams).saved;
  const isNew = id === "new";
  const [plan, taxes] = await Promise.all([
    isNew ? null : db.recurringPlan.findUnique({ where: { id }, include: { taxes: true } }),
    db.tax.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if ((!isNew && !plan) || (isNew && user.role !== "ADMIN")) notFound();
  const readOnly = user.role !== "ADMIN";

  return (
    <>
      <PageHeader title={isNew ? "New recurring plan" : plan!.name} back={{ href: "/plans", label: "Recurring plans" }} />
      {readOnly && <div className="mb-4"><Notice>Only an admin can change plans.</Notice></div>}
      {saved && !readOnly && <div className="mb-4"><Notice tone="accent">Plan saved. Changes apply to future invoices.</Notice></div>}
      <ActionForm action={savePlan.bind(null, isNew ? null : id)}>
        <fieldset disabled={readOnly} className="space-y-6">
          <Card title="Pricing">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" name="name" className="sm:col-span-3">
                <Input name="name" defaultValue={plan?.name} required />
              </Field>
              <Field label="Price per unit" name="price">
                <Input name="price" inputMode="decimal" className="num" defaultValue={plan ? fromCents(toCents(plan.price)) : ""} required />
              </Field>
              <Field label="Billing period" name="billingPeriod">
                <Select name="billingPeriod" defaultValue={plan?.billingPeriod ?? "MONTHLY"}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </Select>
              </Field>
              <Field label="Minimum quantity" name="minQuantity">
                <Input name="minQuantity" type="number" min={1} defaultValue={plan?.minQuantity ?? 1} />
              </Field>
              <Field label="Available from" name="availableFrom" hint="Optional">
                <Input name="availableFrom" type="date" defaultValue={toISODate(plan?.availableFrom)} />
              </Field>
              <Field label="Available until" name="availableUntil" hint="Optional">
                <Input name="availableUntil" type="date" defaultValue={toISODate(plan?.availableUntil)} />
              </Field>
            </div>
          </Card>
          <Card title="Taxes">
            <div className="grid gap-2 sm:grid-cols-3">
              {taxes.map((t) => (
                <Checkbox key={t.id} name="taxIds" value={t.id} label={t.name} defaultChecked={plan ? plan.taxes.some((x) => x.id === t.id) : false} />
              ))}
            </div>
          </Card>
          <Card title="What subscriptions on this plan can do">
            <div className="grid gap-4 sm:grid-cols-2">
              <Checkbox name="autoClose" label="Close automatically at expiry" hint="Otherwise it stays open until someone closes or renews it." defaultChecked={plan?.autoClose ?? false} />
              <Checkbox name="closable" label="Can be closed early" hint="Before the expiry date." defaultChecked={plan?.closable ?? true} />
              <Checkbox name="pausable" label="Can be paused" hint="Periods while paused are not billed." defaultChecked={plan?.pausable ?? false} />
              <Checkbox name="renewable" label="Can be renewed" hint="Extends the expiry by one more term." defaultChecked={plan?.renewable ?? true} />
              <Checkbox name="active" label="Available for new subscriptions" defaultChecked={plan?.active ?? true} />
            </div>
          </Card>
          <Card title="Notes">
            <Textarea name="notes" defaultValue={plan?.notes ?? ""} />
          </Card>
          {!readOnly && (
            <div className="flex justify-end">
              <SubmitButton>{isNew ? "Create plan" : "Save plan"}</SubmitButton>
            </div>
          )}
        </fieldset>
      </ActionForm>
    </>
  );
}
