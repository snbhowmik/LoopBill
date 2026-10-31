import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { NewPasswordFields } from "@/components/password-input";
import { resetPassword } from "../actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Link missing</h1>
        <p className="mt-2 text-sm text-muted">
          Open the link from your email, or{" "}
          <Link href="/forgot-password" className="text-accent hover:underline">request a new one</Link>.
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a password</h1>
      <p className="mt-1 text-sm text-muted">You&apos;ll be signed in once it&apos;s saved.</p>
      <ActionForm action={resetPassword} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <NewPasswordFields />
        <SubmitButton className="w-full">Save password</SubmitButton>
      </ActionForm>
    </>
  );
}
