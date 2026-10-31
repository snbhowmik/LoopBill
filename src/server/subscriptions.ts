import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { addDays, addPeriods, formatDate, periodsBetween, toISODate, today as getToday } from "@/lib/dates";
import { appUrl, companyName, sendMail } from "@/lib/mail";
import { formatCents } from "@/lib/money";
import type { SessionUser } from "@/lib/auth";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { previewInvoice } from "./billing";

export type SubscriptionAction =
  | "sendQuotation"
  | "confirm"
  | "activate"
  | "pause"
  | "resume"
  | "close"
  | "renew";

export const statusOrder: SubscriptionStatus[] = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"];

type Loaded = NonNullable<Awaited<ReturnType<typeof loadForTransition>>>;

function loadForTransition(id: string) {
  return db.subscription.findUnique({
    where: { id },
    include: {
      plan: { include: { taxes: true } },
      customer: true,
      template: true,
      paymentTerm: true,
      lines: { include: { product: true, variant: true, taxes: true }, orderBy: { id: "asc" } },
      discounts: { include: { products: { select: { id: true } } } },
    },
  });
}

/** Which actions are currently possible, and for whom. */
export function availableActions(sub: Loaded | Omit<Loaded, "customer" | "template" | "paymentTerm" | "lines" | "discounts">, role: SessionUser["role"], today = getToday()) {
  const actions: SubscriptionAction[] = [];
  const staff = role !== "CUSTOMER";
  const expired = sub.expiryDate !== null && sub.expiryDate <= today;
  switch (sub.status) {
    case "DRAFT":
      if (staff) actions.push("sendQuotation", "confirm", "close");
      break;
    case "QUOTATION":
      if (staff) actions.push("sendQuotation");
      actions.push("confirm");
      if (staff) actions.push("close");
      break;
    case "CONFIRMED":
      if (staff) actions.push("activate", "close");
      break;
    case "ACTIVE":
      if (sub.plan.pausable) actions.push("pause");
      if (sub.plan.renewable && sub.expiryDate) actions.push("renew");
      if (sub.plan.closable || expired) actions.push("close");
      break;
    case "PAUSED":
      actions.push("resume");
      if (sub.plan.renewable && sub.expiryDate) actions.push("renew");
      if (sub.plan.closable || expired) actions.push("close");
      break;
  }
  return actions;
}

export const actionLabel: Record<SubscriptionAction, string> = {
  sendQuotation: "Send quotation",
  confirm: "Confirm",
  activate: "Activate",
  pause: "Pause",
  resume: "Resume",
  close: "Close",
  renew: "Renew",
};

export class RuleError extends Error {}

export async function transition(id: string, action: SubscriptionAction, user: SessionUser) {
  const sub = await loadForTransition(id);
  if (!sub) throw new RuleError("Subscription not found.");
  if (user.role === "CUSTOMER" && sub.customerId !== user.customerId) {
    throw new RuleError("Subscription not found.");
  }
  const today = getToday();
  if (!availableActions(sub, user.role, today).includes(action)) {
    throw new RuleError(`You can't ${actionLabel[action].toLowerCase()} a subscription that is ${sub.status.toLowerCase()}.`);
  }

  // Each update is conditional on the status we validated against, so two
  // people clicking at once can't both apply a transition.
  const guarded = async (data: Parameters<typeof db.subscription.update>[0]["data"], message: string) => {
    const res = await db.subscription.updateMany({ where: { id, status: sub.status }, data });
    if (res.count === 0) throw new RuleError("This subscription was changed by someone else. Refresh and try again.");
    await logActivity("subscription", id, message, user.id);
  };

  switch (action) {
    case "sendQuotation": {
      const validUntil = addDays(today, sub.template?.validityDays ?? 30);
      await guarded({ status: "QUOTATION", quotationValidUntil: validUntil }, `Quotation sent to ${sub.customer.email}, valid until ${formatDate(validUntil)}`);
      const preview = previewInvoice(sub, today);
      await sendMail(
        sub.customer.email,
        `Quotation ${sub.number} from ${companyName()}`,
        [
          `Hello ${sub.customer.name},`,
          "",
          `Here is your quotation ${sub.number} for the ${sub.plan.name} plan.`,
          `Amount per period: ${formatCents(preview.totalCents)} (incl. taxes)`,
          `Starts: ${formatDate(sub.startDate)}${sub.expiryDate ? `, ends: ${formatDate(sub.expiryDate)}` : ""}`,
          `Valid until: ${formatDate(validUntil)}`,
          "",
          `Review and accept it in your portal: ${appUrl()}/portal/subscriptions/${sub.id}`,
        ].join("\n"),
      );
      return;
    }
    case "confirm": {
      if (sub.status === "QUOTATION" && sub.quotationValidUntil && sub.quotationValidUntil < today) {
        throw new RuleError("This quotation has expired. Send a new quotation first.");
      }
      if (sub.quantity < sub.plan.minQuantity) {
        throw new RuleError(`The ${sub.plan.name} plan needs at least ${sub.plan.minQuantity} units.`);
      }
      await guarded(
        { status: "CONFIRMED", confirmedAt: new Date() },
        user.role === "CUSTOMER" ? "Quotation accepted by customer" : "Confirmed",
      );
      return;
    }
    case "activate":
      await guarded(
        { status: "ACTIVE", activatedAt: new Date(), invoicedCycles: 0, nextInvoiceDate: sub.startDate },
        `Activated; billing starts ${formatDate(sub.startDate)}`,
      );
      return;
    case "pause":
      await guarded({ status: "PAUSED" }, "Paused; billing is on hold");
      return;
    case "resume": {
      // Periods that ended while paused are not billed.
      const period = sub.plan.billingPeriod;
      let cycles = sub.invoicedCycles;
      while (addPeriods(sub.startDate, period, cycles + 1) <= today) cycles++;
      const skipped = cycles - sub.invoicedCycles;
      const next = addPeriods(sub.startDate, period, cycles);
      await guarded(
        {
          status: "ACTIVE",
          invoicedCycles: cycles,
          nextInvoiceDate: sub.expiryDate && next >= sub.expiryDate ? null : next,
        },
        skipped ? `Resumed; ${skipped} paused period(s) not billed` : "Resumed",
      );
      return;
    }
    case "close":
      await guarded({ status: "CLOSED", closedAt: new Date(), nextInvoiceDate: null }, "Closed");
      return;
    case "renew": {
      const period = sub.plan.billingPeriod;
      const termCycles = sub.template?.durationCount ?? periodsBetween(sub.startDate, sub.expiryDate!, period);
      const totalCycles = periodsBetween(sub.startDate, sub.expiryDate!, period) + Math.max(1, termCycles);
      const newExpiry = addPeriods(sub.startDate, period, totalCycles);
      const next = addPeriods(sub.startDate, period, sub.invoicedCycles);
      await guarded(
        { expiryDate: newExpiry, nextInvoiceDate: sub.status === "ACTIVE" ? next : sub.nextInvoiceDate },
        `Renewed until ${formatDate(newExpiry)}`,
      );
      return;
    }
  }
}

export function planAvailableOn(
  plan: { availableFrom: Date | null; availableUntil: Date | null; active: boolean },
  on: Date,
) {
  if (!plan.active) return "This plan is archived.";
  if (plan.availableFrom && on < plan.availableFrom) return `This plan is only available from ${toISODate(plan.availableFrom)}.`;
  if (plan.availableUntil && on > plan.availableUntil) return `This plan stopped being available on ${toISODate(plan.availableUntil)}.`;
  return null;
}
