import "server-only";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { formatDate, formatPeriod, today as getToday } from "@/lib/dates";
import { appUrl, companyName, sendMail } from "@/lib/mail";
import { formatMoney, fromCents, toCents } from "@/lib/money";
import type { SessionUser } from "@/lib/auth";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { RuleError } from "./subscriptions";

export async function confirmInvoice(id: string, user: SessionUser) {
  const res = await db.invoice.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (!res.count) throw new RuleError("Only draft invoices can be confirmed.");
  await settleZeroTotals([id]);
  await logActivity("invoice", id, "Confirmed", user.id);
}

// A fully discounted invoice has nothing to collect, so it is paid on confirmation.
async function settleZeroTotals(ids: string[]) {
  await db.invoice.updateMany({
    where: { id: { in: ids }, status: "CONFIRMED", total: 0 },
    data: { status: "PAID", paidAt: new Date() },
  });
}

/** Confirm many drafts at once (billing day). Returns how many changed. */
export async function confirmDrafts(ids: string[], user: SessionUser) {
  const drafts = await db.invoice.findMany({ where: { id: { in: ids }, status: "DRAFT" }, select: { id: true } });
  if (!drafts.length) return 0;
  const draftIds = drafts.map((d) => d.id);
  const res = await db.invoice.updateMany({
    where: { id: { in: draftIds }, status: "DRAFT" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  await settleZeroTotals(draftIds);
  await db.activity.createMany({
    data: draftIds.map((entityId) => ({ entity: "invoice", entityId, message: "Confirmed (bulk)", userId: user.id })),
  });
  return res.count;
}

export async function cancelInvoice(id: string, user: SessionUser) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id }, include: { discounts: true } });
    if (!inv) throw new RuleError("Invoice not found.");
    if (inv.status === "CANCELLED") throw new RuleError("Invoice is already cancelled.");
    if (inv.status === "PAID" || toCents(inv.amountPaid) > 0) {
      throw new RuleError("Invoices with recorded payments can't be cancelled.");
    }
    await tx.invoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    // Give back discount uses consumed by this invoice.
    for (const d of inv.discounts) {
      await tx.discount.updateMany({
        where: { id: d.discountId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
    await logActivity("invoice", id, "Cancelled", user.id, tx);
  });
}

export async function sendInvoice(id: string, user: SessionUser) {
  const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true } });
  if (!inv) throw new RuleError("Invoice not found.");
  if (inv.status === "DRAFT") throw new RuleError("Confirm the invoice before sending it.");
  if (inv.status === "CANCELLED") throw new RuleError("Cancelled invoices can't be sent.");
  await sendMail(
    inv.customer.email,
    `Invoice ${inv.number} from ${companyName()}`,
    [
      `Hello ${inv.customer.name},`,
      "",
      `Invoice ${inv.number} for ${formatMoney(inv.total)} is ${inv.status === "PAID" ? "paid — thank you" : `due on ${formatDate(inv.dueDate)}`}.`,
      `Billing period: ${formatPeriod(inv.periodStart, inv.periodEnd)}`,
      "",
      `View or print it: ${appUrl()}/portal/invoices/${inv.id}`,
    ].join("\n"),
  );
  await db.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  await logActivity("invoice", id, `Sent to ${inv.customer.email}`, user.id);
}

export async function recordPayment(
  input: { invoiceId: string; method: PaymentMethod; amountCents: number; paidOn: Date; note: string | null },
  user: SessionUser,
) {
  if (input.amountCents <= 0) throw new RuleError("Payment amount must be greater than zero.");
  if (input.paidOn > getToday()) throw new RuleError("Payment date can't be in the future.");

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Invoice" WHERE "id" = ${input.invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!inv) throw new RuleError("Invoice not found.");
    if (inv.status !== "CONFIRMED") {
      throw new RuleError(
        inv.status === "DRAFT" ? "Confirm the invoice before recording payments." : `This invoice is ${inv.status.toLowerCase()}.`,
      );
    }
    const outstanding = toCents(inv.total) - toCents(inv.amountPaid);
    if (input.amountCents > outstanding) {
      throw new RuleError(`Amount exceeds the outstanding balance of ${formatMoney(fromCents(outstanding))}.`);
    }
    const payment = await tx.payment.create({
      data: {
        invoiceId: inv.id,
        method: input.method,
        amount: fromCents(input.amountCents),
        paidOn: input.paidOn,
        note: input.note,
        recordedById: user.id,
      },
    });
    const paid = toCents(inv.amountPaid) + input.amountCents;
    const fullyPaid = paid === toCents(inv.total);
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        amountPaid: fromCents(paid),
        ...(fullyPaid ? { status: "PAID", paidAt: new Date() } : {}),
      },
    });
    await logActivity(
      "invoice",
      inv.id,
      `Payment of ${formatMoney(fromCents(input.amountCents))} recorded (${input.method.replace("_", " ").toLowerCase()})${fullyPaid ? "; invoice paid" : ""}`,
      user.id,
      tx,
    );
    return payment;
  });
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  CASH: "Cash",
  UPI: "UPI",
  CHEQUE: "Cheque",
  OTHER: "Other",
};
