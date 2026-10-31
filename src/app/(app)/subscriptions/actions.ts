"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { logActivity, nextNumber } from "@/lib/activity";
import { addPeriods, parseDate } from "@/lib/dates";
import { fromCents, toCents } from "@/lib/money";
import { fail, ids, money, str, type ActionState } from "@/lib/validation";
import { billNextCycle } from "@/server/billing";
import { planAvailableOn, RuleError, transition, type SubscriptionAction } from "@/server/subscriptions";

const lineSchema = z.object({
  productId: z.string().min(1, "Choose a product for every line."),
  variantId: z.string().optional().default(""),
  quantity: z.coerce.number().int("Quantities must be whole numbers.").min(1, "Line quantity must be at least 1."),
  unitPrice: money("Unit price"),
});

const schema = z.object({
  customerId: z.string().min(1, "Choose a customer."),
  planId: z.string().min(1, "Choose a plan."),
  templateId: z.string().optional(),
  paymentTermId: z.string().min(1, "Choose payment terms."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  startDate: z.string().refine((s) => parseDate(s) !== null, "Enter a start date."),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema),
});

const bad = (error: string, fieldErrors?: Record<string, string>) => ({ error: { error, fieldErrors } as ActionState });

async function parse(fd: FormData) {
  let rawLines: unknown = [];
  try {
    rawLines = JSON.parse(str(fd, "lines") || "[]");
  } catch {
    rawLines = [];
  }
  const parsed = schema.safeParse({
    customerId: str(fd, "customerId"),
    planId: str(fd, "planId"),
    templateId: str(fd, "templateId"),
    paymentTermId: str(fd, "paymentTermId"),
    quantity: str(fd, "quantity"),
    startDate: str(fd, "startDate"),
    expiryDate: str(fd, "expiryDate"),
    notes: str(fd, "notes"),
    lines: rawLines,
  });
  if (!parsed.success) return { error: fail(parsed.error) };
  const v = parsed.data;
  const startDate = parseDate(v.startDate)!;
  const expiryDate = parseDate(v.expiryDate);
  if (v.expiryDate && !expiryDate) return bad("Enter a valid expiry date.", { expiryDate: "Invalid date." });
  if (expiryDate && expiryDate <= startDate) {
    return bad("Expiry date must be after the start date.", { expiryDate: "Must be after the start date." });
  }

  const [plan, customer, term] = await Promise.all([
    db.recurringPlan.findUnique({ where: { id: v.planId } }),
    db.customer.findUnique({ where: { id: v.customerId }, select: { id: true } }),
    db.paymentTerm.findUnique({ where: { id: v.paymentTermId }, select: { id: true } }),
  ]);
  if (!plan || !customer || !term) return bad("Some selected records no longer exist. Reload and try again.");
  if (v.quantity < plan.minQuantity) {
    return bad(`${plan.name} needs at least ${plan.minQuantity} units.`, { quantity: `Minimum ${plan.minQuantity}.` });
  }

  const products = await db.product.findMany({
    where: { id: { in: v.lines.map((l) => l.productId) } },
    include: { variants: { select: { id: true } }, taxes: { where: { active: true }, select: { id: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const l of v.lines) {
    const p = byId.get(l.productId);
    if (!p) return bad("A selected product no longer exists.");
    if (l.variantId && !p.variants.some((x) => x.id === l.variantId)) return bad(`Invalid variant for ${p.name}.`);
  }

  const discountIds = ids(fd, "discountIds");
  const lines = v.lines.map((l) => ({
    productId: l.productId,
    variantId: l.variantId || null,
    quantity: l.quantity,
    unitPrice: fromCents(toCents(l.unitPrice)),
    taxes: { connect: byId.get(l.productId)!.taxes },
  }));
  return { error: null, data: { ...v, plan, startDate, expiryDate, lines, discountIds } };
}

export async function createSubscription(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const res = await parse(fd);
  if (!res.data) return res.error;
  const v = res.data;
  const unavailable = planAvailableOn(v.plan, v.startDate);
  if (unavailable) return { error: unavailable, fieldErrors: { planId: unavailable } };

  const sub = await db.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        number: await nextNumber("subscription", tx),
        customerId: v.customerId,
        planId: v.planId,
        templateId: v.templateId || null,
        paymentTermId: v.paymentTermId,
        quantity: v.quantity,
        startDate: v.startDate,
        expiryDate: v.expiryDate,
        notes: v.notes || null,
        lines: { create: v.lines },
        discounts: { connect: v.discountIds.map((id) => ({ id })) },
      },
    });
    await logActivity("subscription", created.id, "Created as draft", user.id, tx);
    return created;
  });
  redirect(`/subscriptions/${sub.id}`);
}

export async function updateSubscription(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const existing = await db.subscription.findUnique({ where: { id } });
  if (!existing) return { error: "Subscription not found." };
  if (existing.status === "CLOSED") return { error: "Closed subscriptions can't be edited." };

  const res = await parse(fd);
  if (!res.data) return res.error;
  const v = res.data;
  const open = existing.status === "DRAFT" || existing.status === "QUOTATION";
  if (open) {
    const unavailable = planAvailableOn(v.plan, v.startDate);
    if (unavailable && (v.planId !== existing.planId || +v.startDate !== +existing.startDate)) {
      return { error: unavailable, fieldErrors: { planId: unavailable } };
    }
  }

  // Changing the expiry of a running subscription moves its billing cursor too.
  const plan = open ? v.plan : await db.recurringPlan.findUniqueOrThrow({ where: { id: existing.planId } });
  const next = addPeriods(existing.startDate, plan.billingPeriod, existing.invoicedCycles);
  const nextInvoiceDate =
    existing.status === "ACTIVE" ? (v.expiryDate && next >= v.expiryDate ? null : next) : existing.nextInvoiceDate;

  await db.$transaction(async (tx) => {
    await tx.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
    await tx.subscription.update({
      where: { id },
      data: {
        // Customer, plan and start date are fixed once the contract is confirmed.
        ...(open
          ? { customerId: v.customerId, planId: v.planId, startDate: v.startDate, templateId: v.templateId || null }
          : {}),
        paymentTermId: v.paymentTermId,
        quantity: v.quantity,
        expiryDate: v.expiryDate,
        nextInvoiceDate,
        notes: v.notes || null,
        lines: { create: v.lines },
        discounts: { set: v.discountIds.map((d) => ({ id: d })) },
      },
    });
    await logActivity("subscription", id, "Details updated", user.id, tx);
  });
  redirect(`/subscriptions/${id}`);
}

export async function subscriptionAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireStaff();
  const action = str(fd, "action") as SubscriptionAction;
  try {
    await transition(id, action, user);
  } catch (e) {
    if (e instanceof RuleError) return { error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function invoiceNow(id: string): Promise<ActionState> {
  const user = await requireStaff();
  const result = await billNextCycle(id, { force: true, userId: user.id });
  if (result.status === "skipped") return { error: result.reason };
  redirect(`/invoices/${result.invoiceId}`);
}
