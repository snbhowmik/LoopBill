"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { parseDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { fail, ids, money, str, type ActionState } from "@/lib/validation";
import { cancelInvoice, confirmDrafts, confirmInvoice, recordPayment, sendInvoice } from "@/server/invoices";
import { RuleError } from "@/server/subscriptions";
import { PaymentMethod } from "@/generated/prisma/enums";

async function guard(fn: () => Promise<unknown>, message?: string): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: true, message };
}

export async function invoiceAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  switch (str(fd, "action")) {
    case "confirm":
      return guard(() => confirmInvoice(id, user));
    case "confirmSend":
      return guard(async () => {
        await confirmInvoice(id, user);
        await sendInvoice(id, user);
      }, "Invoice confirmed and emailed to the customer.");
    case "send":
      return guard(() => sendInvoice(id, user), "Invoice emailed to the customer.");
    case "cancel":
      return guard(() => cancelInvoice(id, user));
    default:
      return { error: "Unknown action." };
  }
}

export async function bulkInvoiceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const selected = ids(fd, "invoiceIds");
  if (!selected.length) return { error: "Select at least one draft invoice." };
  const send = str(fd, "action") === "confirmSend";
  const confirmed = await confirmDrafts(selected, user);
  let sent = 0;
  if (send) {
    for (const id of selected) {
      try {
        await sendInvoice(id, user);
        sent++;
      } catch (e) {
        if (!(e instanceof RuleError)) throw e;
      }
    }
  }
  refresh();
  return { ok: true, message: `${confirmed} invoice(s) confirmed${send ? `, ${sent} sent` : ""}.` };
}

const paymentSchema = z.object({
  method: z.enum(PaymentMethod, { message: "Choose a payment method." }),
  amount: money("Amount").refine((n) => n > 0, "Amount must be greater than zero."),
  paidOn: z.string().refine((s) => parseDate(s) !== null, "Enter the payment date."),
  note: z.string().max(500).optional(),
});

export async function addPayment(invoiceId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = paymentSchema.safeParse({
    method: str(fd, "method"),
    amount: str(fd, "amount"),
    paidOn: str(fd, "paidOn"),
    note: str(fd, "note"),
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  return guard(
    () =>
      recordPayment(
        { invoiceId, method: v.method, amountCents: toCents(v.amount), paidOn: parseDate(v.paidOn)!, note: v.note || null },
        user,
      ),
    "Payment recorded.",
  );
}
