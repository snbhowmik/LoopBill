"use client";

import { useMemo, useState } from "react";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { btn, cx } from "@/components/ui";
import { addPeriods, parseDate, periodUnit, toISODate } from "@/lib/dates";
import { formatCents, fromCents, percentOf, toCents } from "@/lib/money";
import type { ActionState } from "@/lib/validation";
import type { SubscriptionFormOptions } from "@/server/form-data";

export type LineInput = { key: string; productId: string; variantId: string; quantity: string; unitPrice: string };

export type SubscriptionInitial = {
  customerId: string;
  templateId: string;
  planId: string;
  quantity: string;
  startDate: string;
  expiryDate: string;
  paymentTermId: string;
  notes: string;
  discountIds: string[];
  lines: LineInput[];
};

let keySeq = 0;
const newKey = () => `n${++keySeq}`;

export function SubscriptionForm({
  options,
  initial,
  action,
  locked,
  submitLabel,
}: {
  options: SubscriptionFormOptions;
  initial: SubscriptionInitial;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  /** Contract terms can't change once confirmed; only add-ons, seats, discounts and notes. */
  locked?: boolean;
  submitLabel: string;
}) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof SubscriptionInitial>(k: K, value: SubscriptionInitial[K]) => setV((s) => ({ ...s, [k]: value }));

  const plan = options.plans.find((p) => p.id === v.planId);
  const productById = useMemo(() => new Map(options.products.map((p) => [p.id, p])), [options.products]);

  const priceFor = (productId: string, variantId: string) => {
    const p = productById.get(productId);
    if (!p) return "";
    const extra = p.variants.find((x) => x.id === variantId)?.extraCents ?? 0;
    return fromCents(p.priceCents + extra);
  };

  function applyTemplate(templateId: string) {
    const t = options.templates.find((x) => x.id === templateId);
    if (!t) return set("templateId", "");
    const tplPlan = options.plans.find((p) => p.id === t.planId);
    const start = parseDate(v.startDate);
    setV((s) => ({
      ...s,
      templateId,
      planId: t.planId,
      quantity: String(t.quantity),
      paymentTermId: t.paymentTermId ?? s.paymentTermId,
      notes: s.notes || t.notes || "",
      expiryDate:
        t.durationCount && tplPlan && start ? toISODate(addPeriods(start, tplPlan.billingPeriod, t.durationCount)) : s.expiryDate,
      lines: t.lines.map((l) => ({
        key: newKey(),
        productId: l.productId,
        variantId: l.variantId ?? "",
        quantity: String(l.quantity),
        unitPrice: priceFor(l.productId, l.variantId ?? ""),
      })),
    }));
  }

  const updateLine = (key: string, patch: Partial<LineInput>) =>
    set("lines", v.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Live estimate (before discounts).
  const estimate = useMemo(() => {
    let untaxed = 0;
    let tax = 0;
    if (plan) {
      const amount = plan.priceCents * (Number(v.quantity) || 0);
      untaxed += amount;
      tax += percentOf(amount, plan.taxBp);
    }
    for (const l of v.lines) {
      const p = productById.get(l.productId);
      const amount = toCents(l.unitPrice) * (Number(l.quantity) || 0);
      untaxed += amount;
      tax += percentOf(amount, p?.taxBp ?? 0);
    }
    return { untaxed, tax, total: untaxed + tax };
  }, [plan, v.quantity, v.lines, productById]);

  const payload = JSON.stringify(
    v.lines.map(({ productId, variantId, quantity, unitPrice }) => ({ productId, variantId, quantity, unitPrice })),
  );

  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="lines" value={payload} />
      {v.discountIds.map((id) => (
        <input key={id} type="hidden" name="discountIds" value={id} />
      ))}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Contract</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {!locked && options.templates.length > 0 && (
            <Field label="Start from quotation template" name="templateId" hint="Fills in the plan, lines and terms." className="sm:col-span-2">
              <Select name="templateId" value={v.templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">No template</option>
                {options.templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          )}
          {locked && <input type="hidden" name="templateId" value={v.templateId} />}
          <Field label="Customer" name="customerId">
            <Select name="customerId" value={v.customerId} onChange={(e) => set("customerId", e.target.value)} disabled={locked} required>
              <option value="">Select a customer…</option>
              {options.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
              ))}
            </Select>
          </Field>
          <Field label="Recurring plan" name="planId">
            <Select name="planId" value={v.planId} onChange={(e) => set("planId", e.target.value)} disabled={locked} required>
              <option value="">Select a plan…</option>
              {options.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCents(p.priceCents)} / {periodUnit[p.billingPeriod]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Plan quantity (seats)"
            name="quantity"
            hint={plan ? `Minimum ${plan.minQuantity} for ${plan.name}.` : undefined}
          >
            <Input name="quantity" type="number" min={plan?.minQuantity ?? 1} value={v.quantity} onChange={(e) => set("quantity", e.target.value)} required />
          </Field>
          <Field label="Payment terms" name="paymentTermId">
            <Select name="paymentTermId" value={v.paymentTermId} onChange={(e) => set("paymentTermId", e.target.value)} required>
              <option value="">Select…</option>
              {options.terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Start date" name="startDate">
            <Input name="startDate" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} disabled={locked} required />
          </Field>
          <Field label="Expiry date" name="expiryDate" hint="Leave empty for an open-ended subscription.">
            <Input name="expiryDate" type="date" value={v.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} min={v.startDate} />
          </Field>
          {locked && (
            <>
              <input type="hidden" name="customerId" value={v.customerId} />
              <input type="hidden" name="planId" value={v.planId} />
              <input type="hidden" name="startDate" value={v.startDate} />
            </>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Add-on lines</h2>
          <button
            type="button"
            className={btn("secondary", "sm")}
            onClick={() => set("lines", [...v.lines, { key: newKey(), productId: "", variantId: "", quantity: "1", unitPrice: "" }])}
          >
            Add line
          </button>
        </header>
        {v.lines.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Only the plan will be billed. Add products such as add-ons or extra storage.</p>
        ) : (
          <div className="divide-y divide-line">
            {v.lines.map((l) => {
              const product = productById.get(l.productId);
              const amount = toCents(l.unitPrice) * (Number(l.quantity) || 0);
              return (
                <div key={l.key} className="grid grid-cols-2 items-end gap-3 px-5 py-3 md:grid-cols-[2fr_2fr_80px_120px] xl:grid-cols-[2fr_1.6fr_80px_120px_110px_auto]">
                  <label className="col-span-2 text-xs text-muted md:col-span-1">
                    Product
                    <select
                      className="field-control mt-1"
                      value={l.productId}
                      onChange={(e) => updateLine(l.key, { productId: e.target.value, variantId: "", unitPrice: priceFor(e.target.value, "") })}
                    >
                      <option value="">Select…</option>
                      {options.products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted">
                    Variant
                    <select
                      className="field-control mt-1"
                      value={l.variantId}
                      disabled={!product?.variants.length}
                      onChange={(e) => updateLine(l.key, { variantId: e.target.value, unitPrice: priceFor(l.productId, e.target.value) })}
                    >
                      <option value="">{product?.variants.length ? "Base" : "—"}</option>
                      {product?.variants.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}{x.extraCents ? ` (+${formatCents(x.extraCents)})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-muted">
                    Qty
                    <input className="field-control num mt-1" type="number" min={1} value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} />
                  </label>
                  <label className="text-xs text-muted">
                    Unit price
                    <input className="field-control num mt-1" inputMode="decimal" value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })} />
                  </label>
                  <div className="num pb-2 text-right text-sm">
                    {formatCents(amount)}
                    {product && product.taxBp > 0 && <div className="text-xs text-muted">+{fromCents(product.taxBp)}% tax</div>}
                  </div>
                  <button type="button" className={cx(btn("ghost", "sm"), "mb-0.5")} onClick={() => set("lines", v.lines.filter((x) => x.key !== l.key))} aria-label="Remove line">
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end border-t border-line px-5 py-3 text-sm">
          <dl className="num grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-right">
            <dt className="text-muted">Per period, before discounts</dt>
            <dd>{formatCents(estimate.untaxed)}</dd>
            <dt className="text-muted">Estimated tax</dt>
            <dd>{formatCents(estimate.tax)}</dd>
            <dt className="font-medium">Estimated total</dt>
            <dd className="font-semibold">{formatCents(estimate.total)}</dd>
          </dl>
        </div>
      </section>

      <section className="grid gap-6 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2">
        <div>
          <h2 className="mb-1 text-sm font-semibold">Discounts</h2>
          <p className="mb-3 text-xs text-muted">Applied automatically on each invoice while the rule is valid.</p>
          {options.discounts.length === 0 ? (
            <p className="text-sm text-muted">No discount rules yet.</p>
          ) : (
            <div className="space-y-2">
              {options.discounts.map((d) => (
                <Checkbox
                  key={d.id}
                  label={d.name}
                  hint={d.exhausted ? "Usage limit reached" : d.endDate ? `Valid until ${d.endDate}` : undefined}
                  checked={v.discountIds.includes(d.id)}
                  onChange={(e) =>
                    set("discountIds", e.target.checked ? [...v.discountIds, d.id] : v.discountIds.filter((x) => x !== d.id))
                  }
                />
              ))}
            </div>
          )}
        </div>
        <Field label="Internal notes" name="notes">
          <Textarea name="notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={4} />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
