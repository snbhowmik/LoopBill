import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, today as getToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { discountUsable } from "@/server/billing";

export const metadata: Metadata = { title: "Discounts" };

export default async function DiscountsPage() {
  const user = await getCurrentUser();
  const today = getToday();
  const discounts = await db.discount.findMany({
    include: { products: { select: { name: true } }, _count: { select: { subscriptions: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader
        title="Discounts"
        subtitle="Rules applied automatically to the invoices of subscriptions they are attached to."
        actions={user?.role === "ADMIN" && <LinkButton variant="primary" href="/discounts/new">New discount</LinkButton>}
      />
      <Card padded={false}>
        {discounts.length === 0 ? (
          <EmptyState title="No discount rules yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th align="right">Value</Th>
                <Th>Applies to</Th>
                <Th>Conditions</Th>
                <Th>Valid</Th>
                <Th align="right">Used</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => {
                const usable = discountUsable(d, today);
                const exhausted = d.usageLimit !== null && d.usedCount >= d.usageLimit;
                return (
                  <tr key={d.id} className="hover:bg-surface-2/50">
                    <Td><Link href={`/discounts/${d.id}`} className="font-medium text-accent hover:underline">{d.name}</Link></Td>
                    <Td align="right">{d.type === "PERCENTAGE" ? `${Number(d.value)}%` : formatMoney(d.value)}</Td>
                    <Td className="text-ink-2">{d.scope === "SUBSCRIPTION" ? "Whole subscription" : d.products.map((p) => p.name).join(", ")}</Td>
                    <Td className="text-ink-2">
                      {[d.minPurchase && `min ${formatMoney(d.minPurchase)}`, d.minQuantity && `min qty ${d.minQuantity}`].filter(Boolean).join(" · ") || "—"}
                    </Td>
                    <Td className="num text-ink-2 whitespace-nowrap">
                      {d.startDate || d.endDate ? `${formatDate(d.startDate)} – ${formatDate(d.endDate)}` : "Always"}
                    </Td>
                    <Td align="right">{d.usedCount}{d.usageLimit !== null && <span className="text-muted"> / {d.usageLimit}</span>}</Td>
                    <Td>
                      {usable ? <Badge tone="accent">Active</Badge> : exhausted ? <Badge tone="warn">Used up</Badge> : !d.active ? <Badge>Disabled</Badge> : <Badge>Expired</Badge>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
