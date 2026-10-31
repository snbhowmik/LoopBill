import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { login } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Enter your details to continue.</p>
      <ActionForm action={login} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="Email" name="email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field
          label={
            <span className="flex justify-between">
              Password
              <Link href="/forgot-password" className="font-normal text-accent hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          name="password"
        >
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
