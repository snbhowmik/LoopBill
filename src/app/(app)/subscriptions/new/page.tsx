import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { addPeriods, toISODate, today } from "@/lib/dates";
import { fromCents } from "@/lib/money";
import { param } from "@/lib/params";
import { PageHeader } from "@/components/ui";
import { subscriptionFormOptions } from "@/server/form-data";
import { createSubscription } from "../actions";
import { SubscriptionForm } from "../subscription-form";

export const metadata: Metadata = { title: "New subscription" };

export default async function NewSubscriptionPage({ searchParams }: PageProps<"/subscriptions/new">) {
  await requireStaff();
  const sp = await searchParams;
  const options = await subscriptionFormOptions();
  const start = today();

  // Opening from a template ("Use") pre-fills the form from it.
  const tpl = options.templates.find((t) => t.id === param(sp, "template"));
  const tplPlan = tpl && options.plans.find((p) => p.id === tpl.planId);
  const priceFor = (productId: string, variantId: string | null) => {
    const p = options.products.find((x) => x.id === productId);
    const extra = p?.variants.find((v) => v.id === variantId)?.extraCents ?? 0;
    return p ? fromCents(p.priceCents + extra) : "";
  };
  return (
    <>
      <PageHeader
        title="New subscription"
        subtitle="Saved as a draft. Send it as a quotation when it's ready."
        back={{ href: "/subscriptions", label: "Subscriptions" }}
      />
      <SubscriptionForm
        options={options}
        action={createSubscription}
        submitLabel="Create draft"
        initial={{
          customerId: param(sp, "customer") ?? "",
          templateId: tpl?.id ?? "",
          planId: tpl?.planId ?? "",
          quantity: String(tpl?.quantity ?? 1),
          startDate: toISODate(start),
          expiryDate:
            tpl?.durationCount && tplPlan ? toISODate(addPeriods(start, tplPlan.billingPeriod, tpl.durationCount)) : "",
          paymentTermId: tpl?.paymentTermId ?? options.terms[0]?.id ?? "",
          notes: tpl?.notes ?? "",
          discountIds: [],
          lines: (tpl?.lines ?? []).map((l, i) => ({
            key: `t${i}`,
            productId: l.productId,
            variantId: l.variantId ?? "",
            quantity: String(l.quantity),
            unitPrice: priceFor(l.productId, l.variantId),
          })),
        }}
      />
    </>
  );
}
