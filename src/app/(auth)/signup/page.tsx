import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { NewPasswordFields } from "@/components/password-input";
import { signup } from "../actions";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">See and manage your subscriptions and invoices in one place.</p>
      <ActionForm action={signup} className="mt-8 space-y-4">
        <Field label="Full name" name="name">
          <Input name="name" autoComplete="name" required autoFocus />
        </Field>
        <Field label="Company" name="company" hint="Optional">
          <Input name="company" autoComplete="organization" />
        </Field>
        <Field label="Work email" name="email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <NewPasswordFields />
        <SubmitButton className="w-full">Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
