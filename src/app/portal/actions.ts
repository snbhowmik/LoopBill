"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { fail, optStr, str, type ActionState } from "@/lib/validation";
import { RuleError, transition, type SubscriptionAction } from "@/server/subscriptions";

export async function portalSubscriptionAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireCustomer();
  try {
    // transition() checks that the subscription belongs to this customer.
    await transition(id, str(fd, "action") as SubscriptionAction, user);
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}

const accountSchema = z.object({ name: z.string().trim().min(2, "Enter your company or full name.") });

export async function updateAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireCustomer();
  if (!user.customerId) return { error: "No customer record is linked to this login." };
  const parsed = accountSchema.safeParse({ name: str(fd, "name") });
  if (!parsed.success) return fail(parsed.error);
  await db.customer.update({
    where: { id: user.customerId },
    data: {
      name: parsed.data.name,
      company: optStr(fd, "company"),
      phone: optStr(fd, "phone"),
      address: optStr(fd, "address"),
      taxId: optStr(fd, "taxId"),
    },
  });
  refresh();
  return { ok: true, message: "Details saved. They will appear on your next invoices." };
}
