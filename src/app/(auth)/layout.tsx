import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="relative hidden overflow-hidden bg-[#16322b] p-12 text-[#e9f1ec] lg:flex lg:flex-col lg:justify-between">
        <Logo tone="light" />
        <div className="max-w-md">
          <p className="text-[34px] leading-tight font-semibold tracking-tight">
            Recurring revenue, without the spreadsheet.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[#b7cbc2]">
            Plans, quotations, subscriptions, invoices and payments in one place — billed on time,
            every time, and never twice.
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
          {[
            ["Draft → Closed", "Clear lifecycle"],
            ["Auto taxes", "And discounts"],
            ["Live", "Revenue reports"],
          ].map(([a, b]) => (
            <div key={a}>
              <dt className="font-medium">{a}</dt>
              <dd className="text-[#9fb7ad]">{b}</dd>
            </div>
          ))}
        </dl>
        <svg aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] opacity-[0.07]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" />
        </svg>
      </aside>
      <main className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
