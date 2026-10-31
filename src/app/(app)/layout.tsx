import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { MobileNav, SideNav, type NavSection } from "@/components/nav";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireStaff();
  const sections: NavSection[] = [
    { items: [{ href: "/dashboard", label: "Overview" }] },
    {
      title: "Sales",
      items: [
        { href: "/subscriptions", label: "Subscriptions" },
        { href: "/customers", label: "Customers" },
        { href: "/templates", label: "Quotation templates" },
      ],
    },
    {
      title: "Billing",
      items: [
        { href: "/invoices", label: "Invoices" },
        { href: "/payments", label: "Payments" },
        { href: "/billing", label: "Billing run" },
      ],
    },
    {
      title: "Catalog",
      items: [
        { href: "/products", label: "Products" },
        { href: "/plans", label: "Recurring plans" },
        { href: "/discounts", label: "Discounts" },
      ],
    },
    ...(user.role === "ADMIN"
      ? [
          {
            title: "Administration",
            items: [
              { href: "/users", label: "Users & access" },
              { href: "/settings", label: "Taxes & payment terms" },
              { href: "/emails", label: "Email log" },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 pt-5 pb-6">
          <Link href="/dashboard"><Logo /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SideNav sections={sections} />
        </div>
        <div className="border-t border-line p-4">
          <UserMenu user={user} />
        </div>
      </aside>
      <header className="relative flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Link href="/dashboard"><Logo /></Link>
        <MobileNav>
          <SideNav sections={sections} />
          <div className="mt-6 border-t border-line pt-4">
            <UserMenu user={user} />
          </div>
        </MobileNav>
      </header>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
