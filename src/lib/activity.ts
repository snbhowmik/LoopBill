import type { Tx } from "./db";
import { db } from "./db";

export function logActivity(
  entity: "subscription" | "invoice" | "customer",
  entityId: string,
  message: string,
  userId?: string | null,
  tx: Tx | typeof db = db,
) {
  return tx.activity.create({ data: { entity, entityId, message, userId: userId ?? null } });
}

const PREFIX = { subscription: "SUB", invoice: "INV" } as const;

/** Next human-readable document number, e.g. SUB/2026/00042. Atomic per key. */
export async function nextNumber(kind: keyof typeof PREFIX, tx: Tx | typeof db = db) {
  const year = new Date().getUTCFullYear();
  const key = `${kind}:${year}`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return `${PREFIX[kind]}/${year}/${String(rows[0].value).padStart(5, "0")}`;
}
