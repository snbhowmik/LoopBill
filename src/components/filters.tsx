"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { cx } from "./ui";

/** Updates the URL query string; server components re-render from it. */
function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("page");
    const s = q.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  return { update, params, pending };
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 border-b border-line px-4 py-3">{children}</div>;
}

export function SearchFilter({ name = "q", placeholder }: { name?: string; placeholder: string }) {
  const { update, params, pending } = useQueryUpdater();
  const [value, setValue] = useState(params.get(name) ?? "");
  useEffect(() => {
    const current = params.get(name) ?? "";
    if (value === current) return;
    const t = setTimeout(() => update({ [name]: value || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cx("field-control h-9 py-1.5", pending && "opacity-70")}
      />
    </div>
  );
}

export function SelectFilter({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { update, params } = useQueryUpdater();
  return (
    <select
      aria-label={label}
      value={params.get(name) ?? ""}
      onChange={(e) => update({ [name]: e.target.value || null })}
      className="field-control h-9 w-auto py-1.5 pr-8"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function DateFilter({ name, label }: { name: string; label: string }) {
  const { update, params } = useQueryUpdater();
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="date"
        value={params.get(name) ?? ""}
        onChange={(e) => update({ [name]: e.target.value || null })}
        className="field-control h-9 w-auto py-1.5"
      />
    </label>
  );
}

export function Tabs({ name, tabs }: { name: string; tabs: { value: string; label: string; count?: number }[] }) {
  const { update, params } = useQueryUpdater();
  const current = params.get(name) ?? "";
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line px-3" role="tablist">
      {tabs.map((t) => {
        const active = current === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => update({ [name]: t.value || null })}
            className={cx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm whitespace-nowrap transition-colors",
              active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cx("num rounded-full px-1.5 text-xs", active ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted")}>
                {t.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
