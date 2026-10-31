import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function btn(variant: Variant = "secondary", size: Size = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
    size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-sm",
    variant === "primary" && "bg-accent text-accent-ink hover:brightness-110 shadow-sm",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-2",
    variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
    variant === "danger" && "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
  );
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(btn(variant, size), className)} {...props} />;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx("rounded-xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

type Tone = "neutral" | "accent" | "warn" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", toneClass[tone])}>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  DRAFT: "neutral",
  QUOTATION: "info",
  CONFIRMED: "warn",
  ACTIVE: "accent",
  PAUSED: "warn",
  CLOSED: "neutral",
  PAID: "accent",
  CANCELLED: "neutral",
  OVERDUE: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <Badge tone={statusTone[status] ?? "neutral"}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </Badge>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <th
      className={cx(
        "border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-medium tracking-wide text-muted uppercase whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <td
      className={cx(
        "border-b border-line px-4 py-3 align-middle text-ink",
        align === "right" && "text-right num",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-surface-2 text-muted">∅</div>
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "danger" | "accent";
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cx("num mt-1 text-[17px] font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-xl 2xl:text-2xl", tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-ink")}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </>
  );
  const cls = "block min-w-0 rounded-xl border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={cx(cls, "transition-colors hover:border-line-strong")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function DescriptionList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  params,
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    else q.delete("page");
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-muted">
      <span className="num">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex gap-1.5">
        {page > 1 ? (
          <LinkButton size="sm" href={href(page - 1)}>Previous</LinkButton>
        ) : (
          <span className={cx(btn("secondary", "sm"), "pointer-events-none opacity-50")}>Previous</span>
        )}
        {page < pages ? (
          <LinkButton size="sm" href={href(page + 1)}>Next</LinkButton>
        ) : (
          <span className={cx(btn("secondary", "sm"), "pointer-events-none opacity-50")}>Next</span>
        )}
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-lg px-3.5 py-2.5 text-sm", toneClass[tone])}>{children}</div>;
}
