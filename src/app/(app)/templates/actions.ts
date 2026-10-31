"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminOnly } from "@/lib/guards";
import { fail, optStr, optionalInt, str, type ActionState } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a template name."),
  planId: z.string().min(1, "Choose a plan."),
  validityDays: z.coerce.number().int().min(1, "Validity must be at least 1 day.").max(365),
  quantity: z.coerce.number().int().min(1),
  durationCount: optionalInt("Duration", 1),
  lines: z.array(
    z.object({
      productId: z.string().min(1, "Choose a product for every line."),
      variantId: z.string().optional().default(""),
      quantity: z.coerce.number().int().min(1, "Line quantity must be at least 1."),
    }),
  ),
});

export async function saveTemplate(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await adminOnly();
  if (denied) return denied;
  let lines: unknown = [];
  try {
    lines = JSON.parse(str(fd, "lines") || "[]");
  } catch {}
  const parsed = schema.safeParse({
    name: str(fd, "name"),
    planId: str(fd, "planId"),
    validityDays: str(fd, "validityDays"),
    quantity: str(fd, "quantity") || "1",
    durationCount: str(fd, "durationCount"),
    lines,
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  const plan = await db.recurringPlan.findUnique({ where: { id: v.planId } });
  if (!plan) return { error: "Plan not found." };
  if (v.quantity < plan.minQuantity) return { error: `${plan.name} needs at least ${plan.minQuantity} units.`, fieldErrors: { quantity: `Minimum ${plan.minQuantity}.` } };

  const data = {
    name: v.name,
    planId: v.planId,
    validityDays: v.validityDays,
    quantity: v.quantity,
    durationCount: v.durationCount,
    paymentTermId: optStr(fd, "paymentTermId"),
    notes: optStr(fd, "notes"),
  };
  const lineRows = v.lines.map((l) => ({ productId: l.productId, variantId: l.variantId || null, quantity: l.quantity }));
  const t = await db.$transaction(async (tx) => {
    if (id) {
      await tx.quotationTemplateLine.deleteMany({ where: { templateId: id } });
      return tx.quotationTemplate.update({ where: { id }, data: { ...data, lines: { create: lineRows } } });
    }
    return tx.quotationTemplate.create({ data: { ...data, lines: { create: lineRows } } });
  });
  redirect(`/templates/${t.id}?saved=1`);
}
