"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminOnly } from "@/lib/guards";
import { parseDate } from "@/lib/dates";
import { bool, fail, ids, money, optStr, str, type ActionState } from "@/lib/validation";
import { BillingPeriod } from "@/generated/prisma/enums";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a plan name."),
  price: money("Price"),
  billingPeriod: z.enum(BillingPeriod),
  minQuantity: z.coerce.number().int().min(1, "Minimum quantity must be at least 1."),
});

export async function savePlan(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await adminOnly();
  if (denied) return denied;
  const parsed = schema.safeParse({
    name: str(fd, "name"),
    price: str(fd, "price"),
    billingPeriod: str(fd, "billingPeriod"),
    minQuantity: str(fd, "minQuantity") || "1",
  });
  if (!parsed.success) return fail(parsed.error);
  const from = parseDate(str(fd, "availableFrom"));
  const until = parseDate(str(fd, "availableUntil"));
  if (from && until && until < from) {
    return { error: "The end of availability must be after its start.", fieldErrors: { availableUntil: "Must be after the start." } };
  }

  const v = parsed.data;
  const taxIds = ids(fd, "taxIds").map((t) => ({ id: t }));
  const data = {
    name: v.name,
    price: v.price.toFixed(2),
    billingPeriod: v.billingPeriod,
    minQuantity: v.minQuantity,
    availableFrom: from,
    availableUntil: until,
    autoClose: bool(fd, "autoClose"),
    closable: bool(fd, "closable"),
    pausable: bool(fd, "pausable"),
    renewable: bool(fd, "renewable"),
    active: bool(fd, "active"),
    notes: optStr(fd, "notes"),
  };
  const plan = id
    ? await db.recurringPlan.update({ where: { id }, data: { ...data, taxes: { set: taxIds } } })
    : await db.recurringPlan.create({ data: { ...data, taxes: { connect: taxIds } } });
  redirect(`/plans/${plan.id}?saved=1`);
}
