import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "lb_session";
const SESSION_DAYS = 30;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
};

// Memoised per request.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: { id: true, email: true, name: true, role: true, active: true, customerId: true },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { id, email, name, role, customerId } = session.user;
  return { id, email, name, role, customerId };
});

export function homeFor(role: Role) {
  return role === "CUSTOMER" ? "/portal" : "/dashboard";
}

/** Require a signed-in user, optionally with one of the given roles. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export const requireStaff = () => requireUser(["ADMIN", "STAFF"]);
export const requireAdmin = () => requireUser(["ADMIN"]);
export const requireCustomer = () => requireUser(["CUSTOMER"]);

export const isAdmin = (u: SessionUser | null) => u?.role === "ADMIN";
