-- At most one live (non-cancelled) invoice per subscription billing period.
-- Guards against double billing even if two billing runs overlap.
CREATE UNIQUE INDEX "Invoice_subscription_period_live_key"
  ON "Invoice" ("subscriptionId", "periodStart")
  WHERE "status" <> 'CANCELLED' AND "subscriptionId" IS NOT NULL;

-- Amount sanity checks.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amount_paid_check"
  CHECK ("amountPaid" >= 0 AND "amountPaid" <= "total");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_usage_check"
  CHECK ("usageLimit" IS NULL OR "usedCount" <= "usageLimit");
