import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { toISODate } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { Notice, PageHeader } from "@/components/ui";
import { subscriptionFormOptions } from "@/server/form-data";
import { updateSubscription } from "../../actions";
import { SubscriptionForm } from "../../subscription-form";

export const metadata: Metadata = { title: "Edit subscription" };

export default async function EditSubscriptionPage({ params }: PageProps<"/subscriptions/[id]/edit">) {
  await requireStaff();
  const { id } = await params;
  const sub = await db.subscription.findUnique({
    where: { id },
    include: { lines: { orderBy: { id: "asc" } }, discounts: { select: { id: true } } },
  });
  if (!sub) notFound();
  if (sub.status === "CLOSED") redirect(`/subscriptions/${id}`);

  const options = await subscriptionFormOptions();
  const locked = sub.status !== "DRAFT" && sub.status !== "QUOTATION";
  return (
    <>
      <PageHeader title={`Edit ${sub.number}`} back={{ href: `/subscriptions/${id}`, label: sub.number }} />
      {locked && (
        <div className="mb-4">
          <Notice>
            This subscription is {sub.status.toLowerCase()}, so its customer, plan and start date are fixed. Changes to
            seats, add-ons, discounts and expiry apply from the next invoice.
          </Notice>
        </div>
      )}
      <SubscriptionForm
        options={options}
        action={updateSubscription.bind(null, id)}
        locked={locked}
        submitLabel="Save changes"
        initial={{
          customerId: sub.customerId,
          templateId: sub.templateId ?? "",
          planId: sub.planId,
          quantity: String(sub.quantity),
          startDate: toISODate(sub.startDate),
          expiryDate: toISODate(sub.expiryDate),
          paymentTermId: sub.paymentTermId,
          notes: sub.notes ?? "",
          discountIds: sub.discounts.map((d) => d.id),
          lines: sub.lines.map((l) => ({
            key: l.id,
            productId: l.productId,
            variantId: l.variantId ?? "",
            quantity: String(l.quantity),
            unitPrice: fromCents(toCents(l.unitPrice)),
          })),
        }}
      />
    </>
  );
}
