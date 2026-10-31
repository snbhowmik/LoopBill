"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { emailSchema, fail, str, type ActionState } from "@/lib/validation";
import { issuePasswordLink } from "@/server/password-links";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name."),
  email: emailSchema,
  role: z.enum(["STAFF", "ADMIN"]),
});

export async function inviteStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({ name: str(fd, "name"), email: str(fd, "email"), role: str(fd, "role") || "STAFF" });
  if (!parsed.success) return fail(parsed.error);
  const v = parsed.data;
  if (await db.user.findUnique({ where: { email: v.email } })) {
    return { error: "An account with this email already exists.", fieldErrors: { email: "Already registered." } };
  }
  const user = await db.user.create({ data: { name: v.name, email: v.email, role: v.role } });
  await issuePasswordLink(user.id, "invite", INVITE_TTL_MS);
  refresh();
  return { ok: true, message: `Invitation sent to ${v.email}.` };
}

export async function userAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return { error: "User not found." };
  switch (str(fd, "action")) {
    case "reset":
      await issuePasswordLink(id, target.passwordHash ? "reset" : "invite", target.passwordHash ? undefined : INVITE_TTL_MS);
      return { ok: true, message: `Link sent to ${target.email}.` };
    case "deactivate":
      if (id === admin.id) return { error: "You can't deactivate your own account." };
      await db.$transaction([
        db.user.update({ where: { id }, data: { active: false } }),
        db.session.deleteMany({ where: { userId: id } }),
      ]);
      break;
    case "activate":
      await db.user.update({ where: { id }, data: { active: true } });
      break;
    default:
      return { error: "Unknown action." };
  }
  refresh();
  return { ok: true };
}
