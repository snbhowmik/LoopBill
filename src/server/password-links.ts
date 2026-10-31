import "server-only";
import { db } from "@/lib/db";
import { hashToken, newToken } from "@/lib/auth";
import { appUrl, companyName, sendMail } from "@/lib/mail";

const RESET_TTL_MS = 60 * 60 * 1000;

/** Issue a single-use link that lets a user choose a new password. */
export async function issuePasswordLink(userId: string, kind: "reset" | "invite", ttlMs = RESET_TTL_MS) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const token = newToken();
  await db.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  const link = `${appUrl()}/reset-password?token=${token}`;
  const company = companyName();
  if (kind === "invite") {
    await sendMail(
      user.email,
      `You've been invited to ${company} billing`,
      `Hello ${user.name},\n\nAn account has been created for you. Choose your password here (valid for ${Math.round(ttlMs / 3_600_000)} hours):\n${link}\n`,
    );
  } else {
    await sendMail(
      user.email,
      "Reset your password",
      `Hello ${user.name},\n\nUse this link to reset your password. It expires in one hour and can be used once:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    );
  }
}

