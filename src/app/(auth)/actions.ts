"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, hashToken, homeFor, requireUser, verifyPassword } from "@/lib/auth";
import { issuePasswordLink } from "@/server/password-links";
import { emailSchema, fail, passwordSchema, str, type ActionState } from "@/lib/validation";

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name."),
    company: z.string().trim().optional(),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: str(fd, "name"),
    company: str(fd, "company"),
    email: str(fd, "email"),
    password: fd.get("password"),
    confirm: fd.get("confirm"),
  });
  if (!parsed.success) return fail(parsed.error);
  const { name, company, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "An account with this email already exists.", fieldErrors: { email: "Already registered. Try signing in." } };
  }

  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (tx) => {
    // Staff may already have created a customer record for this email.
    const existing = await tx.customer.findUnique({ where: { email }, include: { user: true } });
    const customer =
      existing && !existing.user
        ? existing
        : await tx.customer.create({ data: { name: company || name, email } });
    return tx.user.create({
      data: { email, name, passwordHash, role: "CUSTOMER", customerId: customer.id },
    });
  });

  await createSession(user.id);
  redirect("/portal");
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({ where: { email } });
  const ok = user?.passwordHash && user.active && (await verifyPassword(password, user.passwordHash));
  if (!user || !ok) return { error: "Invalid email or password." };

  await createSession(user.id);
  redirect(safeNext(str(fd, "next")) ?? homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function requestReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(str(fd, "email"));
  if (!parsed.success) return fail(parsed.error);
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user?.active) await issuePasswordLink(user.id, "reset");
  // Same answer either way, so the form can't be used to discover accounts.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

const resetSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({
    token: str(fd, "token"),
    password: fd.get("password"),
    confirm: fd.get("confirm"),
  });
  if (!parsed.success) return fail(parsed.error);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.active) {
    return { error: "This link is invalid or has expired. Request a new one." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await createSession(record.userId);
  redirect(homeFor(record.user.role));
}

const changeSchema = z
  .object({ current: z.string().min(1, "Enter your current password."), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const parsed = changeSchema.safeParse({ current: fd.get("current"), password: fd.get("password"), confirm: fd.get("confirm") });
  if (!parsed.success) return fail(parsed.error);
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!user.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect password." } };
  }
  await db.$transaction([
    db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    db.session.deleteMany({ where: { userId: me.id } }),
  ]);
  await createSession(me.id);
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}
