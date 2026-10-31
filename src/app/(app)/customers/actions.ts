"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { emailSchema, fail, optStr, str, type ActionState } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name."),
  email: emailSchema,
});

export async function saveCustomer(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = schema.safeParse({ name: str(fd, "name"), email: str(fd, "email") });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;

  const clash = await db.customer.findFirst({ where: { email: v.email, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return { error: "Another customer already uses this email.", fieldErrors: { email: "Already in use." } };

  const data = {
    name: v.name,
    email: v.email,
    company: optStr(fd, "company"),
    phone: optStr(fd, "phone"),
    address: optStr(fd, "address"),
    taxId: optStr(fd, "taxId"),
  };
  const c = id ? await db.customer.update({ where: { id }, data }) : await db.customer.create({ data });
  await logActivity("customer", c.id, id ? "Details updated" : "Created", user.id);
  redirect(`/customers/${c.id}?saved=1`);
}
