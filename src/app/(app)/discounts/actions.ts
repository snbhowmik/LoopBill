"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminOnly } from "@/lib/guards";
import { parseDate } from "@/lib/dates";
import { bool, fail, ids, money, optionalInt, optionalMoney, str, type ActionState } from "@/lib/validation";
import { DiscountScope, DiscountType } from "@/generated/prisma/enums";

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter a name."),
    type: z.enum(DiscountType),
    value: money("Value").refine((n) => n > 0, "Value must be greater than zero."),
    scope: z.enum(DiscountScope),
    minPurchase: optionalMoney("Minimum purchase"),
    minQuantity: optionalInt("Minimum quantity", 1),
    usageLimit: optionalInt("Usage limit", 1),
  })
  .refine((v) => v.type !== "PERCENTAGE" || v.value <= 100, { path: ["value"], message: "A percentage can't exceed 100." });

export async function saveDiscount(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await adminOnly();
  if (denied) return denied;
  const parsed = schema.safeParse({
    name: str(fd, "name"),
    type: str(fd, "type"),
    value: str(fd, "value"),
    scope: str(fd, "scope"),
    minPurchase: str(fd, "minPurchase"),
    minQuantity: str(fd, "minQuantity"),
    usageLimit: str(fd, "usageLimit"),
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  const startDate = parseDate(str(fd, "startDate"));
  const endDate = parseDate(str(fd, "endDate"));
  if (startDate && endDate && endDate < startDate) return { error: "End date must be after the start date.", fieldErrors: { endDate: "Must be after the start." } };
  const productIds = ids(fd, "productIds").map((p) => ({ id: p }));
  if (v.scope === "PRODUCTS" && productIds.length === 0) return { error: "Choose at least one product, or apply the discount to whole subscriptions." };

  if (id && v.usageLimit !== null) {
    const current = await db.discount.findUnique({ where: { id }, select: { usedCount: true } });
    if (current && v.usageLimit < current.usedCount) {
      return { error: `This discount has already been used ${current.usedCount} times.`, fieldErrors: { usageLimit: `At least ${current.usedCount}.` } };
    }
  }

  const data = {
    name: v.name,
    type: v.type,
    value: v.value.toFixed(2),
    scope: v.scope,
    minPurchase: v.minPurchase === null ? null : v.minPurchase.toFixed(2),
    minQuantity: v.minQuantity,
    usageLimit: v.usageLimit,
    startDate,
    endDate,
    active: bool(fd, "active"),
  };
  const products = v.scope === "PRODUCTS" ? productIds : [];
  const d = id
    ? await db.discount.update({ where: { id }, data: { ...data, products: { set: products } } })
    : await db.discount.create({ data: { ...data, products: { connect: products } } });
  redirect(`/discounts/${d.id}?saved=1`);
}
