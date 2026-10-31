import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PAGE_SIZE, pageParam, param } from "@/lib/params";
import { FilterBar, SearchFilter } from "@/components/filters";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Pagination, Table, Td, Th } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const sp = await searchParams;
  const q = param(sp, "q");
  const page = pageParam(sp);
  const where: Prisma.CustomerWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
    : {};
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        user: { select: { id: true } },
        _count: { select: { subscriptions: { where: { status: { in: ["ACTIVE", "PAUSED"] } } } } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
  ]);

  // Outstanding balance per customer on this page, in one query.
  const balances = await db.invoice.groupBy({
    by: ["customerId"],
    where: { customerId: { in: rows.map((r) => r.id) }, status: "CONFIRMED" },
    _sum: { total: true, amountPaid: true },
  });
  const owed = new Map(balances.map((b) => [b.customerId, Number(b._sum.total ?? 0) - Number(b._sum.amountPaid ?? 0)]));
  const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Businesses that subscribe, and whether they can sign in to the portal."
        actions={<LinkButton variant="primary" href="/customers/new">New customer</LinkButton>}
      />
      <Card padded={false}>
        <FilterBar>
          <SearchFilter placeholder="Search name or email…" />
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState title="No customers found" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th align="right">Live subscriptions</Th>
                <Th align="right">Outstanding</Th>
                <Th>Portal</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/50">
                  <Td><Link href={`/customers/${c.id}`} className="font-medium text-accent hover:underline">{c.name}</Link></Td>
                  <Td className="text-ink-2">{c.email}</Td>
                  <Td className="text-ink-2 whitespace-nowrap">{c.phone ?? "—"}</Td>
                  <Td align="right">{c._count.subscriptions}</Td>
                  <Td align="right">{owed.get(c.id) ? fmt.format(owed.get(c.id)!) : "—"}</Td>
                  <Td>{c.user ? <Badge tone="accent">Has login</Badge> : <span className="text-xs text-muted">No login</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/customers" params={{ q }} />
      </Card>
    </>
  );
}
