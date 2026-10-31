import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { param } from "@/lib/params";
import { FilterBar, SearchFilter } from "@/components/filters";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const user = await getCurrentUser();
  const q = param(await searchParams, "q");
  const products = await db.product.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    include: { variants: true, taxes: true, _count: { select: { lines: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader
        title="Products"
        subtitle="What customers can subscribe to, with prices, variants and tax rules."
        actions={user?.role === "ADMIN" && <LinkButton variant="primary" href="/products/new">New product</LinkButton>}
      />
      <Card padded={false}>
        <FilterBar>
          <SearchFilter placeholder="Search products…" />
        </FilterBar>
        {products.length === 0 ? (
          <EmptyState title="No products" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th align="right">Sales price</Th>
                <Th align="right">Cost price</Th>
                <Th>Variants</Th>
                <Th>Taxes</Th>
                <Th align="right">In use</Th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2/50">
                  <Td>
                    <Link href={`/products/${p.id}`} className="font-medium text-accent hover:underline">{p.name}</Link>
                    {!p.active && <span className="ml-2"><Badge>Archived</Badge></span>}
                  </Td>
                  <Td>{p.type === "SERVICE" ? "Service" : "Goods"}</Td>
                  <Td align="right">{formatMoney(p.salesPrice)}</Td>
                  <Td align="right" className="text-ink-2">{formatMoney(p.costPrice)}</Td>
                  <Td className="text-ink-2">
                    {p.variants.length
                      ? p.variants.map((v) => `${v.value}${Number(v.extraPrice) ? ` (+${formatMoney(v.extraPrice)})` : ""}`).join(", ")
                      : "—"}
                  </Td>
                  <Td className="text-ink-2">{p.taxes.map((t) => t.name).join(", ") || "—"}</Td>
                  <Td align="right">{p._count.lines}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
