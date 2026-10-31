import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, periodLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Badge, Card, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Recurring plans" };

export default async function PlansPage() {
  const user = await getCurrentUser();
  const plans = await db.recurringPlan.findMany({
    include: { _count: { select: { subscriptions: { where: { status: { in: ["ACTIVE", "PAUSED"] } } } } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader
        title="Recurring plans"
        subtitle="How much a subscription costs per unit, how often it bills, and what customers may do with it."
        actions={user?.role === "ADMIN" && <LinkButton variant="primary" href="/plans/new">New plan</LinkButton>}
      />
      <Card padded={false}>
        <Table>
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th align="right">Price / unit</Th>
              <Th>Billing</Th>
              <Th align="right">Min qty</Th>
              <Th>Available</Th>
              <Th>Rules</Th>
              <Th align="right">Live subs</Th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2/50">
                <Td>
                  <Link href={`/plans/${p.id}`} className="font-medium text-accent hover:underline">{p.name}</Link>
                  {!p.active && <span className="ml-2"><Badge>Archived</Badge></span>}
                </Td>
                <Td align="right">{formatMoney(p.price)}</Td>
                <Td>{periodLabel[p.billingPeriod]}</Td>
                <Td align="right">{p.minQuantity}</Td>
                <Td className="num text-ink-2 whitespace-nowrap">
                  {p.availableFrom || p.availableUntil ? `${formatDate(p.availableFrom)} – ${formatDate(p.availableUntil)}` : "Always"}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {p.autoClose && <Badge tone="info">Auto-close</Badge>}
                    {p.closable && <Badge>Closable</Badge>}
                    {p.pausable && <Badge>Pausable</Badge>}
                    {p.renewable && <Badge>Renewable</Badge>}
                  </div>
                </Td>
                <Td align="right">{p._count.subscriptions}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
