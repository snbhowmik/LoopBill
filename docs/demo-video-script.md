# LoopBill — demo video script

**Length:** about 4 minutes · **Format:** screen recording with voice-over · **Resolution:** 1440×900, browser zoom 100%

The story follows one billing month at Brightloop Software, from a new customer signing up to the finance lead closing the month. Each scene lists what's on screen, what to click, and what to say. Matching stills are in [`docs/screenshots/`](screenshots/).

---

## Before you record

1. Reset the demo data: `npm run db:seed` (or `npm run db:seed -- --bulk` to show scale in scene 9).
2. Record against a production build, so the Next.js dev badge doesn't appear: `npm run build && npm start`.
3. Make sure Impeccable live mode is stopped (no localhost script in `src/app/layout.tsx`).
4. Open three browser profiles or windows, each signed out:
   - **Admin:** `admin@loopbill.test` / `Admin@12345`
   - **Staff:** `staff@loopbill.test` / `Staff@12345`
   - **Customer:** sign up fresh in scene 1, then use `customer@loopbill.test` / `Customer@123` for scene 6.
5. Turn off notifications and hide the bookmarks bar.

---

## Scene 1 — The problem (0:00–0:20)

**Screen:** Sign-in page (`01-sign-in.png`).

**Say:**
> Brightloop sells software by the month and the year. Until now, subscriptions lived in a spreadsheet, renewals were missed, and invoices were typed by hand. Nobody could say how much recurring revenue the company actually had. This is LoopBill — one place for plans, subscriptions and recurring billing.

**Caption:** *Recurring revenue, without the spreadsheet.*

---

## Scene 2 — A new customer signs up (0:20–0:45)

**Screen:** Sign-up page (`02-sign-up-password-rules.png`).

**Do:**
1. Click **Create an account**.
2. Type a name, company and email.
3. Type a weak password slowly, so the rules tick green one by one; finish with a strong one.
4. Try an email that already exists to show the error, then fix it and submit. You land in the customer portal.

**Say:**
> A small business finds us online and signs up. One account per email, and the password has to be more than eight characters with upper case, lower case and a special character — the form shows each rule as you type. Forgot your password? A single-use reset link goes to your registered email.

---

## Scene 3 — Roles: who sees what (0:45–1:05)

**Screen:** Admin → **Users & access** (`19-users.png`).

**Do:** Show the team list, then fill **Add a team member** with a name and email and click **Send invitation**.

**Say:**
> Not everyone sees the same thing. The admin controls the whole system. Staff handle day-to-day work with limited access — they can view the catalog but not change it. Customers only ever see their own subscriptions and invoices. And only the admin can add a member of staff: they're invited by email and choose their own password.

---

## Scene 4 — Launching a plan (1:05–1:35)

**Screen:** Admin → **Products → Workspace Suite** (`14-product-variants.png`), then **Recurring plans → Business** (`15-plan.png`).

**Do:**
1. On the product, point at sales price, cost price, notes and the GST 18% tax.
2. Point at the **Brand: Northwind +₹560** variant.
3. Open the Business plan: price per seat, **Monthly**, minimum quantity **5**, availability dates.
4. Toggle through the plan rules: close automatically at expiry, close early, pause, renew.

**Say:**
> The admin sets up products with a sales price, a cost price, notes and tax rules. Products can come in variants — choosing the Northwind brand adds ₹560. Then the plan: what it costs, how often it bills — daily, weekly, monthly or yearly — the minimum quantity, and when it's available. Each plan decides for itself whether subscriptions close on their own at expiry, or can be closed early, paused or renewed.

---

## Scene 5 — From quotation to subscription (1:35–2:10)

**Screen:** Staff → **Quotation templates → Use** on *Business starter pack* (`17-templates.png`, `06-new-from-template.png`, `06b-new-lines-and-estimate.png`).

**Do:**
1. Click **Use** on the template; the plan, seats, contract length, payment terms and lines fill in.
2. Pick a customer. Scroll to show the add-on lines and the live estimate.
3. Click **Create draft**. Point at the stepper: **Draft → Quotation → Confirmed → Active → Closed**.
4. Click **Send quotation**. The status moves to *Quotation*, and the activity log shows the email and validity date (`07-quotation.png`).

**Say:**
> A sales rep doesn't build an offer from scratch. They start from a quotation template that already has the right plan and product lines, and stays valid for a set number of days. Every subscription gets its own number, customer, plan, start and expiry dates and payment terms, with lines for product, quantity, unit price, taxes and amount. The stepper shows exactly where it stands, and the activity log shows who did what.

---

## Scene 6 — The customer accepts (2:10–2:30)

**Screen:** Customer window → **Portal** (`24-portal-overview.png`, `25-portal-quotation.png`).

**Do:** Sign in as the customer. Show the "quotation waiting" notice, open it, point at "What you'll pay each period", then click **Accept quotation**.

**Say:**
> The customer sees the quotation in their own portal — no email back and forth. They review what they'll pay each period and accept it themselves.

---

## Scene 7 — Billing day (2:30–3:00)

**Screen:** Staff → subscription → **Activate**; then **Billing run** (`12-billing-run.png`), then **Invoices → Draft** (`08-invoices.png`).

**Do:**
1. Activate the confirmed subscription.
2. Open **Billing run** and click **Run billing**. Read out the result.
3. Click **Run billing** again: *0 invoices created*.
4. Go to **Invoices → Draft**, tick **Select all drafts**, click **Confirm & send selected**.

**Say:**
> Billing day. Hundreds of subscriptions are due at once, and nobody types an invoice. Each one is created from its subscription — customer details, product lines, taxes and totals filled in. Watch: I'll run billing a second time. Zero invoices. Every period is billed exactly once — never twice, never skipped — even if two runs overlap. Then the team confirms and sends the whole batch in one click.

**Caption:** *Run it twice — nothing is billed twice.*

---

## Scene 8 — Discounts and payments (3:00–3:30)

**Screen:** **Discounts** (`16-discounts.png`), then an invoice with a part payment (`10-invoice-partial.png`), then a paid invoice (`09-invoice-paid.png`) and **Print** (`11-print-invoice.png`).

**Do:**
1. On Discounts, point at a percentage rule with a minimum quantity, and a fixed rule with dates and a usage limit (*150 / 150 — Used up*).
2. Open an invoice: the discount line appears on its own.
3. In **Record payment**, type an amount above the balance → the error. Record a part payment; the balance updates. Pay the rest → **Paid**.
4. Click **Print** to show the printable invoice.

**Say:**
> Only the admin creates discount rules — a fixed amount or a percentage, with a minimum purchase or quantity, start and end dates, and a limit on how many times it can be used. Once a discount applies, it appears on the next invoice on its own, and stops when it expires or runs out. Payments arrive by bank transfer, UPI, card or cheque, and are recorded against the right invoice with a date and a note. Part payments are fine; overpaying isn't allowed. And every invoice can be printed or saved as a PDF.

---

## Scene 9 — The finance lead closes the month (3:30–3:55)

**Screen:** **Overview** (`03-overview.png`), then dark mode (`21-overview-dark.png`) and phone width (`23-mobile-overview.png`) as quick cuts.

**Do:**
1. Point at active subscriptions, monthly recurring revenue, collected, outstanding and overdue.
2. Change the date range and pick a plan in the filter; the numbers update.
3. Hover a bar in **Payments collected per month**.
4. Click **Overdue** to land on the overdue invoices list.

**Say:**
> At month end, the finance lead gets everything in one place: active subscriptions, recurring revenue, money collected, what's still owed and what's overdue — with filters and a summary. It stays fast at scale: with four thousand subscriptions and twenty thousand invoices, every page loads in well under two seconds.

**Caption:** *4,000 subscriptions · 20,000 invoices · every page under 0.2 s*

---

## Scene 10 — Close (3:55–4:10)

**Screen:** Back to the subscription stepper or the overview.

**Say:**
> Renewals that never get missed, invoices that are never wrong, and a number you can trust for recurring revenue. That's LoopBill.

**End card:** LoopBill logo · *Plans, subscriptions and recurring billing in one place.*

---

## Shot list (stills)

| File | Scene |
| --- | --- |
| `01-sign-in.png` | 1 |
| `02-sign-up-password-rules.png` | 2 |
| `19-users.png` | 3 |
| `14-product-variants.png`, `15-plan.png` | 4 |
| `17-templates.png`, `06-new-from-template.png`, `06b-new-lines-and-estimate.png`, `07-quotation.png`, `04-subscriptions.png`, `05-subscription-detail.png` | 5 |
| `24-portal-overview.png`, `25-portal-quotation.png`, `26-portal-invoice.png`, `27-portal-account.png`, `28-mobile-portal.png` | 6 |
| `12-billing-run.png`, `08-invoices.png`, `22-mobile-invoices.png` | 7 |
| `16-discounts.png`, `10-invoice-partial.png`, `09-invoice-paid.png`, `11-print-invoice.png`, `13-payments.png`, `18-customer.png`, `20-taxes-terms.png` | 8 |
| `03-overview.png`, `21-overview-dark.png`, `23-mobile-overview.png` | 9 |
