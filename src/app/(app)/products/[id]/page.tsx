import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { fromCents, toCents } from "@/lib/money";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, Notice, PageHeader } from "@/components/ui";
import { saveProduct } from "../actions";
import { VariantsEditor } from "../variants-editor";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[id]">) {
  const user = await requireStaff();
  const { id } = await params;
  const saved = (await searchParams).saved;
  const isNew = id === "new";
  const [product, taxes] = await Promise.all([
    isNew ? null : db.product.findUnique({ where: { id }, include: { variants: { orderBy: { value: "asc" } }, taxes: true } }),
    db.tax.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!isNew && !product) notFound();
  if (isNew && user.role !== "ADMIN") notFound();
  const readOnly = user.role !== "ADMIN";
  const money = (d: { toString(): string } | undefined) => (d ? fromCents(toCents(d)) : "");

  return (
    <>
      <PageHeader title={isNew ? "New product" : product!.name} back={{ href: "/products", label: "Products" }} />
      {readOnly && <div className="mb-4"><Notice>Only an admin can change products.</Notice></div>}
      {saved && !readOnly && <div className="mb-4"><Notice tone="accent">Product saved.</Notice></div>}
      <ActionForm action={saveProduct.bind(null, isNew ? null : id)}>
        <fieldset disabled={readOnly} className="space-y-6">
          <Card title="Product">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="name" className="sm:col-span-2">
                <Input name="name" defaultValue={product?.name} required />
              </Field>
              <Field label="Type" name="type">
                <Select name="type" defaultValue={product?.type ?? "SERVICE"}>
                  <option value="SERVICE">Service</option>
                  <option value="GOODS">Goods</option>
                </Select>
              </Field>
              <div className="flex items-end pb-2">
                <Checkbox name="active" label="Available for new subscriptions" defaultChecked={product?.active ?? true} />
              </div>
              <Field label="Sales price" name="salesPrice">
                <Input name="salesPrice" inputMode="decimal" className="num" defaultValue={money(product?.salesPrice)} required />
              </Field>
              <Field label="Cost price" name="costPrice" hint="Used for margin; never shown to customers.">
                <Input name="costPrice" inputMode="decimal" className="num" defaultValue={money(product?.costPrice)} />
              </Field>
              <Field label="Notes" name="notes" className="sm:col-span-2">
                <Textarea name="notes" defaultValue={product?.notes ?? ""} />
              </Field>
            </div>
          </Card>
          <Card title="Taxes">
            <p className="mb-3 text-xs text-muted">Calculated automatically on every invoice line for this product.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {taxes.map((t) => (
                <Checkbox key={t.id} name="taxIds" value={t.id} label={t.name} defaultChecked={product?.taxes.some((x) => x.id === t.id) ?? false} />
              ))}
            </div>
          </Card>
          <Card title="Variants">
            <p className="mb-3 text-xs text-muted">Each variant adds its extra price on top of the sales price.</p>
            <VariantsEditor
              disabled={readOnly}
              initial={(product?.variants ?? []).map((v) => ({ id: v.id, attribute: v.attribute, value: v.value, extraPrice: money(v.extraPrice) }))}
            />
          </Card>
          {!readOnly && (
            <div className="flex justify-end">
              <SubmitButton>{isNew ? "Create product" : "Save product"}</SubmitButton>
            </div>
          )}
        </fieldset>
      </ActionForm>
    </>
  );
}
