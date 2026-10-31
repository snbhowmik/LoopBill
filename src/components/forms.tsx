"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/validation";
import { btn, cx } from "./ui";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormCtx = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

/**
 * Form bound to a server action. Submits without React's automatic form
 * reset, so values survive validation errors, and exposes field errors and
 * pending state to the fields and buttons inside it.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  id,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormCtx value={{ state, pending }}>
      <form
        id={id}
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter?.name) fd.set(submitter.name, submitter.value);
          startTransition(() => formAction(fd));
        }}
      >
        <FormMessage />
        {children}
      </form>
    </FormCtx>
  );
}

function FormMessage() {
  const { state } = useContext(FormCtx);
  if (state?.error) {
    return (
      <div role="alert" className="mb-4 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
        {state.error}
      </div>
    );
  }
  if (state?.message) {
    return (
      <div role="status" className="mb-4 rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-accent">
        {state.message}
      </div>
    );
  }
  return null;
}

export function useFieldError(name: string) {
  return useContext(FormCtx).state?.fieldErrors?.[name];
}

export function Field({
  label,
  name,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  name?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const error = useFieldError(name ?? "");
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  name,
  value,
  className,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useContext(FormCtx);
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cx(btn(variant, size), className)}>
      {pending ? "Working…" : children}
    </button>
  );
}

/** Submit button that asks for a second click before submitting. */
export function ConfirmButton({
  children,
  confirmLabel = "Click again to confirm",
  variant = "danger",
  size = "md",
  name,
  value,
}: {
  children: ReactNode;
  confirmLabel?: string;
  name?: string;
  value?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useContext(FormCtx);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type={armed ? "submit" : "button"}
      name={name}
      value={value}
      disabled={pending}
      onClick={() => !armed && setArmed(true)}
      className={btn(variant, size)}
    >
      {pending ? "Working…" : armed ? confirmLabel : children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const error = useFieldError(props.name ?? "");
  return <input id={props.name} aria-invalid={error ? true : undefined} {...props} className={cx("field-control", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea id={props.name} rows={3} {...props} className={cx("field-control", props.className)} />;
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const error = useFieldError(props.name ?? "");
  return (
    <select id={props.name} aria-invalid={error ? true : undefined} {...props} className={cx("field-control pr-8", props.className)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" {...props} className="mt-0.5 size-4 accent-[var(--accent)]" />
      <span>
        <span className="text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
