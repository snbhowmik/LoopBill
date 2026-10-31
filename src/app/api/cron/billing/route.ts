import { timingSafeEqual } from "node:crypto";
import { runBilling } from "@/server/billing";

// Called by an external scheduler once a day:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/billing
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await runBilling();
  return Response.json(summary);
}
