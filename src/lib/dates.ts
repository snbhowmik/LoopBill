import type { BillingPeriod } from "@/generated/prisma/enums";

// Calendar dates are stored as Postgres DATE and handled as UTC-midnight Date
// objects. "Today" is resolved in the business timezone.

const TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kolkata";

export function today(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseDate(iso)!;
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toISODate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

function addMonthsClamped(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target;
}

// Start of billing period `n` for an anchor date. Always computed from the
// anchor so month-end dates never drift (Jan 31 -> Feb 28 -> Mar 31).
export function addPeriods(anchor: Date, period: BillingPeriod, n: number): Date {
  switch (period) {
    case "DAILY":
      return addDays(anchor, n);
    case "WEEKLY":
      return addDays(anchor, n * 7);
    case "MONTHLY":
      return addMonthsClamped(anchor, n);
    case "YEARLY":
      return addMonthsClamped(anchor, n * 12);
  }
}

// Number of whole periods needed to cover [start, end).
export function periodsBetween(start: Date, end: Date, period: BillingPeriod): number {
  let n = 0;
  while (addPeriods(start, period, n) < end && n < 100_000) n++;
  return n;
}

export const periodLabel: Record<BillingPeriod, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const periodUnit: Record<BillingPeriod, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

// Factor to normalise a per-period amount into monthly recurring revenue.
export const monthlyFactor: Record<BillingPeriod, number> = {
  DAILY: 365 / 12,
  WEEKLY: 52 / 12,
  MONTHLY: 1,
  YEARLY: 1 / 12,
};

const display = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(d: Date | null | undefined): string {
  return d ? display.format(d) : "—";
}

/** Billing periods are stored with an exclusive end; show the last day covered. */
export function formatPeriod(start: Date, endExclusive: Date): string {
  return `${formatDate(start)} – ${formatDate(addDays(endExclusive, -1))}`;
}
