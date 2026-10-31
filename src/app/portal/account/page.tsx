import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/forms";
import { Card } from "@/components/ui";
import { NewPasswordFields } from "@/components/password-input";
import { changePassword } from "@/app/(auth)/actions";
import { updateAccount } from "../actions";

export const metadata: Metadata = { title: "Account" };

export default async function PortalAccount() {
  const user = await requireCustomer();
  const c = user.customerId ? await db.customer.findUnique({ where: { id: user.customerId } }) : null;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Account</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card title="Billing details">
          <ActionForm action={updateAccount} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name on invoices" name="name"><Input name="name" defaultValue={c?.name} required /></Field>
              <Field label="Company" name="company"><Input name="company" defaultValue={c?.company ?? ""} /></Field>
              <Field label="Phone" name="phone"><Input name="phone" defaultValue={c?.phone ?? ""} /></Field>
              <Field label="Tax ID" name="taxId"><Input name="taxId" defaultValue={c?.taxId ?? ""} /></Field>
              <Field label="Address" name="address" className="sm:col-span-2"><Textarea name="address" rows={2} defaultValue={c?.address ?? ""} /></Field>
            </div>
            <div className="flex justify-end"><SubmitButton>Save details</SubmitButton></div>
          </ActionForm>
        </Card>
        <Card title="Change password">
          <p className="mb-4 text-sm text-ink-2">Signed in as <span className="font-medium text-ink">{user.email}</span>. Invoices are emailed to {c?.email ?? user.email}.</p>
          <ActionForm action={changePassword} className="space-y-3" resetOnSuccess>
            <Field label="Current password" name="current"><Input name="current" type="password" autoComplete="current-password" required /></Field>
            <NewPasswordFields />
            <SubmitButton className="w-full">Change password</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
