import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { requestReset } from "../actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">We&apos;ll email a reset link to your registered address.</p>
      <ActionForm action={requestReset} className="mt-8 space-y-4">
        <Field label="Email" name="email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
