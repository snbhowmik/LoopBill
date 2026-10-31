import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { periodUnit } from "@/lib/dates";
import { Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Quotation templates" };

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  const templates = await db.quotationTemplate.findMany({
    include: { plan: true, paymentTerm: true, _count: { select: { lines: true, subscriptions: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Quotation templates"
        subtitle="Ready-made offers with the right plan and lines, so quotes aren't built from scratch."
        actions={user?.role === "ADMIN" && <LinkButton variant="primary" href="/templates/new">New template</LinkButton>}
      />
      <Card padded={false}>
        {templates.length === 0 ? (
          <EmptyState title="No templates yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Template</Th>
                <Th>Plan</Th>
                <Th align="right">Seats</Th>
                <Th>Contract length</Th>
                <Th align="right">Valid for</Th>
                <Th align="right">Lines</Th>
                <Th align="right">Used</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-surface-2/50">
                  <Td><Link href={`/templates/${t.id}`} className="font-medium text-accent hover:underline">{t.name}</Link></Td>
                  <Td>{t.plan.name}</Td>
                  <Td align="right">{t.quantity}</Td>
                  <Td>{t.durationCount ? `${t.durationCount} ${periodUnit[t.plan.billingPeriod]}${t.durationCount > 1 ? "s" : ""}` : "Open-ended"}</Td>
                  <Td align="right">{t.validityDays} days</Td>
                  <Td align="right">{t._count.lines}</Td>
                  <Td align="right">{t._count.subscriptions}</Td>
                  <Td align="right"><LinkButton size="sm" href={`/subscriptions/new?template=${t.id}`}>Use</LinkButton></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
