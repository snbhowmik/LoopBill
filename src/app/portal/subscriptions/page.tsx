import type { Metadata } from "next";
import { requireCustomer } from "@/lib/auth";
import { Card, EmptyState } from "@/components/ui";
import { customerSubscriptions } from "@/server/portal";
import { SubscriptionCards } from "../subscription-list";

export const metadata: Metadata = { title: "My subscriptions" };

export default async function PortalSubscriptions() {
  const user = await requireCustomer();
  const subs = await customerSubscriptions(user.customerId ?? "");
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Subscriptions</h1>
      {subs.length ? <SubscriptionCards subs={subs} /> : <Card><EmptyState title="No subscriptions yet" /></Card>}
    </>
  );
}
