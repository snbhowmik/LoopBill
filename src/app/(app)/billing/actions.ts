"use server";

import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import type { ActionState } from "@/lib/validation";
import { runBilling } from "@/server/billing";

export async function runBillingNow(): Promise<ActionState> {
  const user = await requireStaff();
  const s = await runBilling({ userId: user.id });
  await logActivity("subscription", "billing-run", `Billing run: ${s.invoiced} invoiced, ${s.activated} activated, ${s.closed} closed`, user.id);
  refresh();
  const parts = [
    `${s.invoiced} invoice${s.invoiced === 1 ? "" : "s"} created`,
    `${s.activated} subscription${s.activated === 1 ? "" : "s"} activated`,
    `${s.closed} closed at expiry`,
  ];
  if (s.failed.length) {
    return { error: `${parts.join(", ")}. ${s.failed.length} failed: ${s.failed.map((f) => `${f.subscription} (${f.error})`).join("; ")}` };
  }
  return { ok: true, message: `Done in ${(s.durationMs / 1000).toFixed(1)}s — ${parts.join(", ")}.` };
}
