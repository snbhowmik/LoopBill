import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { toISODate } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Card, Notice, PageHeader } from "@/components/ui";
import { saveDiscount } from "../actions";

export const metadata: Metadata = { title: "Discount" };

export default async function DiscountPage({ params, searchParams }: PageProps<"/discounts/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const saved = (await searchParams).saved;
  const isNew = id === "new";
  const [d, products] = await Promise.all([
    isNew ? null : db.discount.findUnique({ where: { id }, include: { products: { select: { id: true } }, _count: { select: { subscriptions: true } } } }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if ((!isNew && !d) || (isNew && user.role !== "ADMIN")) notFound();
  const readOnly = user.role !== "ADMIN";
  const m = (x: { toString(): string } | null | undefined) => (x ? fromCents(toCents(x)) : "");

  return (
    <>
      <PageHeader
        title={isNew ? "New discount" : d!.name}
        subtitle={d ? `Used ${d.usedCount}${d.usageLimit !== null ? ` of ${d.usageLimit}` : ""} times · attached to ${d._count.subscriptions} subscriptions` : undefined}
        back={{ href: "/discounts", label: "Discounts" }}
      />
      {readOnly && <div className="mb-4"><Notice>Only an admin can create or change discount rules. Attach existing rules to a subscription from its edit page.</Notice></div>}
      {saved && !readOnly && <div className="mb-4"><Notice tone="accent">Discount saved.</Notice></div>}
      <ActionForm action={saveDiscount.bind(null, isNew ? null : id)}>
        <fieldset disabled={readOnly} className="space-y-6">
          <Card title="Rule">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" name="name" className="sm:col-span-3">
                <Input name="name" defaultValue={d?.name} placeholder="e.g. 10% off 20+ seats" required />
              </Field>
              <Field label="Type" name="type">
                <Select name="type" defaultValue={d?.type ?? "PERCENTAGE"}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
                </Select>
              </Field>
              <Field label="Value" name="value" hint="Percent, or amount per invoice">
                <Input name="value" inputMode="decimal" className="num" defaultValue={m(d?.value)} required />
              </Field>
              <Field label="Applies to" name="scope">
                <Select name="scope" defaultValue={d?.scope ?? "SUBSCRIPTION"}>
                  <option value="SUBSCRIPTION">Whole subscription</option>
                  <option value="PRODUCTS">Specific products</option>
                </Select>
              </Field>
            </div>
          </Card>
          <Card title="Conditions & limits">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Minimum purchase" name="minPurchase" hint="Of the lines it applies to">
                <Input name="minPurchase" inputMode="decimal" className="num" defaultValue={m(d?.minPurchase)} />
              </Field>
              <Field label="Minimum quantity" name="minQuantity">
                <Input name="minQuantity" type="number" min={1} defaultValue={d?.minQuantity ?? ""} />
              </Field>
              <Field label="Usage limit" name="usageLimit" hint="Number of invoices it may appear on">
                <Input name="usageLimit" type="number" min={1} defaultValue={d?.usageLimit ?? ""} />
              </Field>
              <Field label="Start date" name="startDate">
                <Input name="startDate" type="date" defaultValue={toISODate(d?.startDate)} />
              </Field>
              <Field label="End date" name="endDate">
                <Input name="endDate" type="date" defaultValue={toISODate(d?.endDate)} />
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox name="active" label="Enabled" defaultChecked={d?.active ?? true} />
              </div>
            </div>
          </Card>
          <Card title="Products (when applying to specific products)">
            <div className="grid gap-2 sm:grid-cols-3">
              {products.map((p) => (
                <Checkbox key={p.id} name="productIds" value={p.id} label={p.name} defaultChecked={d?.products.some((x) => x.id === p.id) ?? false} />
              ))}
            </div>
          </Card>
          {!readOnly && (
            <div className="flex justify-end">
              <SubmitButton>{isNew ? "Create discount" : "Save discount"}</SubmitButton>
            </div>
          )}
        </fieldset>
      </ActionForm>
    </>
  );
}
