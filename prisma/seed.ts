/**
 * Demo data. Run with `npm run db:seed` (small, realistic data set) or
 * `npm run db:seed -- --bulk` (thousands of subscriptions, for performance checks).
 *
 * History is produced by the real billing engine: each active subscription is
 * billed period by period from its start date, so every invoice, tax and
 * discount in the demo went through the same code path as production.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { addDays, addPeriods, today as getToday } from "../src/lib/dates";
import { billNextCycle } from "../src/server/billing";
import { recordPayment } from "../src/server/invoices";
import { toCents } from "../src/lib/money";
import type { BillingPeriod, PaymentMethod, SubscriptionStatus } from "../src/generated/prisma/enums";

const BULK = process.argv.includes("--bulk");
const SUBSCRIPTIONS = BULK ? 4000 : 140;

// Deterministic pseudo-random numbers so every seed looks the same.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

async function reset() {
  await db.$executeRawUnsafe(`
    TRUNCATE "Payment", "InvoiceDiscount", "InvoiceLine", "Invoice", "SubscriptionLine",
      "_DiscountToSubscription", "Subscription", "QuotationTemplateLine", "QuotationTemplate",
      "_DiscountToProduct", "Discount", "_ProductToTax", "_RecurringPlanToTax", "_SubscriptionLineToTax",
      "ProductVariant", "Product", "RecurringPlan", "PaymentTerm", "Tax", "Activity", "EmailLog",
      "PasswordResetToken", "Session", "User", "Customer", "Counter" CASCADE`);
}

const companyA = ["Bluefin", "Copperleaf", "Driftwood", "Evergreen", "Foxglove", "Granite", "Harbor", "Ironbark", "Juniper", "Kestrel", "Lumen", "Marigold", "Northstar", "Oakridge", "Pinecone", "Quarry", "Riverbend", "Saffron", "Tidewater", "Umber", "Vantage", "Willow", "Yarrow", "Zephyr"];
const companyB = ["Labs", "Studio", "Traders", "Foods", "Logistics", "Clinic", "Retail", "Works", "Analytics", "Interiors", "Textiles", "Ventures"];

async function main() {
  const today = getToday();
  console.log(`Seeding ${BULK ? "bulk" : "demo"} data as of ${today.toISOString().slice(0, 10)}…`);
  await reset();

  // --- People -------------------------------------------------------------
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await db.user.create({
    data: { email: "admin@loopbill.test", name: "Asha Verma", role: "ADMIN", passwordHash: await hash("Admin@12345") },
  });
  await db.user.create({
    data: { email: "staff@loopbill.test", name: "Rahul Nair", role: "STAFF", passwordHash: await hash("Staff@12345") },
  });

  // --- Settings -------------------------------------------------------------
  const gst18 = await db.tax.create({ data: { name: "GST 18%", rate: "18.00" } });
  const gst12 = await db.tax.create({ data: { name: "GST 12%", rate: "12.00" } });
  await db.tax.create({ data: { name: "GST 5%", rate: "5.00" } });
  const immediate = await db.paymentTerm.create({ data: { name: "Immediate payment", dueDays: 0 } });
  const net15 = await db.paymentTerm.create({ data: { name: "15 days", dueDays: 15 } });
  const net30 = await db.paymentTerm.create({ data: { name: "30 days", dueDays: 30 } });
  const terms = [immediate, net15, net30, net15];

  // --- Catalog --------------------------------------------------------------
  const suite = await db.product.create({
    data: {
      name: "Workspace Suite",
      type: "SERVICE",
      salesPrice: "1200.00",
      costPrice: "300.00",
      notes: "Core collaboration seats.",
      taxes: { connect: [{ id: gst18.id }] },
      variants: {
        create: [
          { attribute: "Brand", value: "Standard", extraPrice: "0" },
          { attribute: "Brand", value: "Northwind", extraPrice: "560.00" },
        ],
      },
    },
    include: { variants: true },
  });
  const analytics = await db.product.create({
    data: { name: "Analytics add-on", salesPrice: "800.00", costPrice: "120.00", taxes: { connect: [{ id: gst18.id }] } },
  });
  const storage = await db.product.create({
    data: { name: "Extra storage (100 GB)", salesPrice: "250.00", costPrice: "40.00", taxes: { connect: [{ id: gst18.id }] } },
  });
  const support = await db.product.create({
    data: { name: "Priority support", salesPrice: "1500.00", costPrice: "600.00", taxes: { connect: [{ id: gst18.id }] } },
  });
  await db.product.create({
    data: {
      name: "Onboarding kit",
      type: "GOODS",
      salesPrice: "5000.00",
      costPrice: "2100.00",
      notes: "Printed guides and hardware tokens.",
      taxes: { connect: [{ id: gst12.id }] },
    },
  });
  const northwind = suite.variants.find((v) => v.value === "Northwind")!;

  const plan = (data: {
    name: string; price: string; billingPeriod: BillingPeriod; minQuantity?: number;
    autoClose?: boolean; closable?: boolean; pausable?: boolean; renewable?: boolean; notes?: string;
  }) => db.recurringPlan.create({ data: { ...data, taxes: { connect: [{ id: gst18.id }] } } });

  const starter = await plan({ name: "Starter", price: "499.00", billingPeriod: "MONTHLY", pausable: true, notes: "For small teams getting started." });
  const business = await plan({ name: "Business", price: "999.00", billingPeriod: "MONTHLY", minQuantity: 5, pausable: true });
  const enterprise = await plan({ name: "Enterprise", price: "9999.00", billingPeriod: "YEARLY", minQuantity: 10, closable: false, notes: "Annual contract; cannot be closed early." });
  const sprint = await plan({ name: "Project Sprint", price: "199.00", billingPeriod: "WEEKLY", autoClose: true, renewable: false });
  await plan({ name: "Day Pass", price: "49.00", billingPeriod: "DAILY", autoClose: true, renewable: false });
  const plans = [starter, starter, business, business, business, enterprise, sprint];

  const tplEnterprise = await db.quotationTemplate.create({
    data: {
      name: "Enterprise annual offer",
      validityDays: 15,
      planId: enterprise.id,
      quantity: 25,
      durationCount: 1,
      paymentTermId: net30.id,
      lines: { create: [{ productId: support.id, quantity: 1 }, { productId: analytics.id, quantity: 25 }] },
    },
  });
  await db.quotationTemplate.create({
    data: {
      name: "Business starter pack",
      validityDays: 30,
      planId: business.id,
      quantity: 5,
      durationCount: 12,
      paymentTermId: net15.id,
      lines: { create: [{ productId: suite.id, variantId: northwind.id, quantity: 5 }, { productId: storage.id, quantity: 2 }] },
    },
  });

  const volume = await db.discount.create({
    data: { name: "Volume: 10% off 20+ seats", type: "PERCENTAGE", value: "10.00", scope: "SUBSCRIPTION", minQuantity: 20 },
  });
  const launch = await db.discount.create({
    data: {
      name: "Analytics launch ₹500 off",
      type: "FIXED",
      value: "500.00",
      scope: "PRODUCTS",
      startDate: addDays(today, -200),
      endDate: addDays(today, 90),
      usageLimit: 150,
      products: { connect: [{ id: analytics.id }] },
    },
  });
  await db.discount.create({
    data: { name: "Festive 15% (ended)", type: "PERCENTAGE", value: "15.00", startDate: addDays(today, -120), endDate: addDays(today, -60) },
  });

  // --- Customers --------------------------------------------------------------
  const customerCount = BULK ? 2500 : 60;
  const customerRows = Array.from({ length: customerCount }, (_, i) => {
    const company = `${companyA[i % companyA.length]} ${companyB[Math.floor(i / companyA.length) % companyB.length]}${i >= companyA.length * companyB.length ? ` ${Math.floor(i / (companyA.length * companyB.length)) + 1}` : ""}`;
    return {
      name: company,
      company,
      email: `billing${i + 1}@${company.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
      phone: `+91 98${String(int(10000000, 99999999))}`,
      address: `${int(1, 300)}, ${pick(["MG Road", "Residency Road", "Park Street", "Linking Road", "Anna Salai"])}, ${pick(["Bengaluru", "Mumbai", "Chennai", "Kolkata", "Pune", "Hyderabad"])}`,
      taxId: rand() > 0.4 ? `29ABCDE${int(1000, 9999)}F1Z${int(1, 9)}` : null,
    };
  });
  await db.customer.createMany({ data: customerRows });
  const customers = await db.customer.findMany({ orderBy: { createdAt: "asc" } });

  // Portal login for the first customer.
  await db.user.create({
    data: {
      email: "customer@loopbill.test",
      name: "Meera Iyer",
      role: "CUSTOMER",
      passwordHash: await hash("Customer@123"),
      customerId: customers[0].id,
    },
  });

  // --- Subscriptions ----------------------------------------------------------
  const activeIds: string[] = [];
  let n = 0;
  const year = new Date().getUTCFullYear();
  for (let i = 0; i < SUBSCRIPTIONS; i++) {
    const customer = i < 4 ? customers[0] : customers[i % customers.length];
    const p = i === 0 ? business : pick(plans);
    const roll = rand();
    let status: SubscriptionStatus =
      roll < 0.66 ? "ACTIVE" : roll < 0.74 ? "CLOSED" : roll < 0.8 ? "PAUSED" : roll < 0.86 ? "CONFIRMED" : roll < 0.93 ? "QUOTATION" : "DRAFT";
    if (i === 1) status = "QUOTATION";
    if (i === 2) status = "ACTIVE";

    const historyDays = p.billingPeriod === "WEEKLY" ? int(7, 70) : p.billingPeriod === "YEARLY" ? int(30, 700) : int(20, 420);
    const startDate =
      status === "DRAFT" || status === "QUOTATION" || status === "CONFIRMED"
        ? addDays(today, int(0, 30))
        : addDays(today, -historyDays);
    const termPeriods = p.billingPeriod === "YEARLY" ? int(1, 3) : p.billingPeriod === "WEEKLY" ? int(6, 16) : pick([6, 12, 12, 24]);
    const expiryDate = rand() < 0.15 && p.billingPeriod === "MONTHLY" ? null : addPeriods(startDate, p.billingPeriod, termPeriods);
    const quantity = Math.max(p.minQuantity, p === enterprise ? int(10, 60) : p === business ? int(5, 30) : int(1, 8));

    const lines: { productId: string; variantId?: string; quantity: number; unitPrice: string; taxes: { connect: { id: string }[] } }[] = [];
    if (rand() < 0.5) lines.push({ productId: analytics.id, quantity: int(1, 5), unitPrice: "800.00", taxes: { connect: [{ id: gst18.id }] } });
    if (rand() < 0.35) lines.push({ productId: storage.id, quantity: int(1, 4), unitPrice: "250.00", taxes: { connect: [{ id: gst18.id }] } });
    if (rand() < 0.25) lines.push({ productId: suite.id, variantId: northwind.id, quantity: int(1, 10), unitPrice: "1760.00", taxes: { connect: [{ id: gst18.id }] } });
    if (p === enterprise) lines.push({ productId: support.id, quantity: 1, unitPrice: "1500.00", taxes: { connect: [{ id: gst18.id }] } });

    const discounts = [
      ...(quantity >= 20 ? [{ id: volume.id }] : []),
      ...(lines.some((l) => l.productId === analytics.id) && rand() < 0.4 ? [{ id: launch.id }] : []),
    ];

    const billable = status === "ACTIVE" || status === "PAUSED" || status === "CLOSED";
    const sub = await db.subscription.create({
      data: {
        number: `SUB/${year}/${String(++n).padStart(5, "0")}`,
        customerId: customer.id,
        planId: p.id,
        templateId: p === enterprise && rand() < 0.5 ? tplEnterprise.id : null,
        paymentTermId: pick(terms).id,
        status: billable ? "ACTIVE" : status,
        quantity,
        startDate,
        expiryDate,
        quotationValidUntil: status === "QUOTATION" ? addDays(today, int(3, 30)) : null,
        confirmedAt: billable || status === "CONFIRMED" ? startDate : null,
        activatedAt: billable ? startDate : null,
        nextInvoiceDate: billable ? startDate : null,
        lines: { create: lines },
        discounts: { connect: discounts },
      },
    });
    if (billable) activeIds.push(sub.id);
    // Remember the intended final state so we can pause/close after back-filling.
    if (status === "PAUSED" || status === "CLOSED") pending.push({ id: sub.id, status });
  }
  await db.counter.create({ data: { key: `subscription:${year}`, value: n } });

  // --- Back-fill billing history through the real engine ----------------------
  console.log(`Billing history for ${activeIds.length} subscriptions…`);
  let invoices = 0;
  await pool(activeIds, 6, async (id) => {
    for (;;) {
      const sub = await db.subscription.findUniqueOrThrow({ where: { id }, select: { nextInvoiceDate: true } });
      if (!sub.nextInvoiceDate || sub.nextInvoiceDate > today) break;
      const r = await billNextCycle(id, { today: sub.nextInvoiceDate, userId: admin.id });
      if (r.status !== "invoiced") break;
      invoices++;
    }
  });
  console.log(`  ${invoices} invoices`);

  // Paused / closed subscriptions stop part-way through their history.
  for (const { id, status } of pending) {
    await db.subscription.update({
      where: { id },
      data: { status, closedAt: status === "CLOSED" ? new Date() : null, nextInvoiceDate: status === "CLOSED" ? null : undefined },
    });
  }

  // --- Confirm invoices and collect most of them ------------------------------
  const all = await db.invoice.findMany({ select: { id: true, total: true, invoiceDate: true, dueDate: true } });
  const recent = addDays(today, -3);
  const toConfirm = all.filter((inv) => inv.invoiceDate < recent || rand() < 0.5).map((i) => i.id);
  await db.invoice.updateMany({ where: { id: { in: toConfirm } }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  await db.invoice.updateMany({ where: { id: { in: toConfirm }, total: 0 }, data: { status: "PAID", paidAt: new Date() } });

  const staffUser = { id: admin.id, email: admin.email, name: admin.name, role: admin.role, customerId: null };
  const methods: PaymentMethod[] = ["BANK_TRANSFER", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "CASH"];
  const confirmed = all.filter((inv) => toConfirm.includes(inv.id) && toCents(inv.total) > 0);
  let payments = 0;
  await pool(confirmed, 6, async (inv) => {
    const overdueAge = (today.getTime() - inv.dueDate.getTime()) / 86_400_000;
    const payChance = overdueAge > 45 ? 0.96 : overdueAge > 0 ? 0.7 : 0.35;
    if (rand() > payChance) return;
    const total = toCents(inv.total);
    const partial = rand() < 0.08;
    const paidOn = addDays(inv.invoiceDate, int(0, Math.max(1, Math.min(40, Math.floor((today.getTime() - inv.invoiceDate.getTime()) / 86_400_000)))));
    await recordPayment(
      {
        invoiceId: inv.id,
        method: pick(methods),
        amountCents: partial ? Math.round(total / 2) : total,
        paidOn: paidOn > today ? today : paidOn,
        note: partial ? "Part payment" : pick([null, null, "Thanks!", "Ref matched from bank statement"]),
      },
      staffUser,
    );
    payments++;
  });
  console.log(`  ${payments} payments`);
  console.log("Done.");
}

const pending: { id: string; status: SubscriptionStatus }[] = [];

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
