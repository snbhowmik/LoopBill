"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminOnly } from "@/lib/guards";
import { fail, ids, money, optStr, str, type ActionState } from "@/lib/validation";
import { ProductType } from "@/generated/prisma/enums";

const variantSchema = z.object({
  id: z.string().optional(),
  attribute: z.string().trim().min(1, "Every variant needs an attribute, e.g. Brand."),
  value: z.string().trim().min(1, "Every variant needs a value."),
  extraPrice: money("Extra price"),
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter a product name."),
  type: z.enum(ProductType),
  salesPrice: money("Sales price"),
  costPrice: money("Cost price"),
  variants: z.array(variantSchema),
});

export async function saveProduct(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await adminOnly();
  if (denied) return denied;

  let variants: unknown = [];
  try {
    variants = JSON.parse(str(fd, "variants") || "[]");
  } catch {}
  const parsed = schema.safeParse({
    name: str(fd, "name"),
    type: str(fd, "type"),
    salesPrice: str(fd, "salesPrice"),
    costPrice: str(fd, "costPrice") || "0",
    variants,
  });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  const keys = v.variants.map((x) => `${x.attribute.toLowerCase()}=${x.value.toLowerCase()}`);
  if (new Set(keys).size !== keys.length) return { error: "Each attribute/value pair can only be listed once." };

  const data = {
    name: v.name,
    type: v.type,
    salesPrice: v.salesPrice.toFixed(2),
    costPrice: v.costPrice.toFixed(2),
    notes: optStr(fd, "notes"),
    active: fd.get("active") === "on",
    taxes: { set: ids(fd, "taxIds").map((t) => ({ id: t })) },
  };

  const productId = await db.$transaction(async (tx) => {
    const product = id
      ? await tx.product.update({ where: { id }, data })
      : await tx.product.create({ data: { ...data, taxes: { connect: data.taxes.set } } });
    const keep = v.variants.filter((x) => x.id).map((x) => x.id!);
    await tx.productVariant.deleteMany({ where: { productId: product.id, id: { notIn: keep } } });
    for (const x of v.variants) {
      const row = { attribute: x.attribute, value: x.value, extraPrice: x.extraPrice.toFixed(2) };
      if (x.id) await tx.productVariant.update({ where: { id: x.id, productId: product.id }, data: row });
      else await tx.productVariant.create({ data: { ...row, productId: product.id } });
    }
    return product.id;
  });
  redirect(`/products/${productId}?saved=1`);
}
