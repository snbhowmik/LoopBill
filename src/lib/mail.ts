import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3001").replace(/\/$/, "");

export const companyName = () => process.env.COMPANY_NAME ?? "Brightloop Software";

export const companyEmail = () => process.env.COMPANY_EMAIL ?? "billing@brightloop.example";

export const smtpConfigured = () => Boolean(process.env.SMTP_HOST);

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransport() {
  transport ??= nodemailer.createTransport({
    pool: true, // reuse connections when a billing run sends many invoices
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, text: string) {
  let delivered = false;
  if (smtpConfigured()) {
    try {
      await getTransport().sendMail({
        from: process.env.MAIL_FROM ?? "LoopBill <billing@loopbill.local>",
        to,
        subject,
        text,
      });
      delivered = true;
    } catch (err) {
      console.error("[mail] delivery failed", err);
    }
  } else {
    console.info(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
  }
  // Once delivered, the log must not become a way to reuse someone's password link.
  const logged = delivered ? text.replace(/(reset-password\?token=)[\w-]+/g, "$1[redacted]") : text;
  await db.emailLog.create({ data: { to, subject, text: logged, delivered } });
  return delivered;
}
