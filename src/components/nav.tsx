"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cx } from "./ui";

export type NavSection = { title?: string; items: { href: string; label: string }[] };

export function SideNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-5">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <div className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-muted uppercase">{s.title}</div>}
          <ul className="space-y-0.5">
            {s.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Mobile drawer wrapper; closes on navigation. */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on; navigating away closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (fn: (o: boolean) => boolean) => setOpenOn(fn(open) ? pathname : null);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-md border border-line px-2.5 py-1 text-sm text-ink-2"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-14 z-30 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-line bg-surface p-4 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}
