"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { bool, fail, str, type ActionState } from "@/lib/validation";

const taxSchema = z.object({
  name: z.string().trim().min(2, "Enter a tax name."),
  rate: z.coerce.number({ message: "Rate must be a number." }).min(0).max(100, "Rate can't exceed 100%."),
});

export async function saveTax(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = taxSchema.safeParse({ name: str(fd, "name"), rate: str(fd, "rate") });
  if (!parsed.success) return fail(parsed.error);
  const data = { name: parsed.data.name, rate: parsed.data.rate.toFixed(2), active: id ? bool(fd, "active") : true };
  if (id) await db.tax.update({ where: { id }, data });
  else await db.tax.create({ data });
  refresh();
  return { ok: true, message: id ? "Tax updated. New invoices use the new rate." : "Tax added." };
}

const termSchema = z.object({
  name: z.string().trim().min(2, "Enter a name."),
  dueDays: z.coerce.number().int("Days must be a whole number.").min(0).max(365),
});

export async function saveTerm(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = termSchema.safeParse({ name: str(fd, "name"), dueDays: str(fd, "dueDays") });
  if (!parsed.success) return fail(parsed.error);
  if (id) await db.paymentTerm.update({ where: { id }, data: parsed.data });
  else await db.paymentTerm.create({ data: parsed.data });
  refresh();
  return { ok: true, message: id ? "Payment term updated." : "Payment term added." };
}
