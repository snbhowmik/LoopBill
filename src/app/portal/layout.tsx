import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { companyName } from "@/lib/mail";
import { Logo } from "@/components/logo";
import { PortalNav } from "./portal-nav";
import { UserMenu } from "@/components/user-menu";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const user = await requireCustomer();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/portal" className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-sm text-muted sm:inline">Customer portal · {companyName()}</span>
          </Link>
          <div className="w-full sm:w-auto sm:min-w-64">
            <UserMenu user={user} />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <PortalNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
