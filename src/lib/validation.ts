import { z } from "zod";

// More than eight characters, with upper case, lower case and a special character.
export const PASSWORD_RULES = [
  { test: (p: string) => p.length > 8, label: "More than 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "An uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "A lowercase letter" },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: "A special character" },
];

export const passwordSchema = z
  .string()
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), {
    message:
      "Password must be more than 8 characters and include an uppercase letter, a lowercase letter and a special character.",
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }));

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function fail(error: z.ZodError): ActionState {
  const fe = fieldErrors(error);
  return { error: Object.values(fe)[0] ?? "Please check the form.", fieldErrors: fe };
}

// FormData helpers
export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, key: string) => str(fd, key) || null;
export const bool = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
};
export const ids = (fd: FormData, key: string) =>
  fd.getAll(key).filter((v): v is string => typeof v === "string" && v.length > 0);

// Zod helpers for money / numbers from form inputs.
export const money = (label: string) =>
  z.coerce
    .number({ message: `${label} must be a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(9_999_999_999, `${label} is too large.`)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
      message: `${label} can have at most 2 decimals.`,
    });

export const optionalMoney = (label: string) =>
  z.preprocess((v) => (v === "" || v === null ? null : v), money(label).nullable());

export const optionalInt = (label: string, min = 0) =>
  z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int(`${label} must be a whole number.`).min(min, `${label} must be at least ${min}.`).nullable(),
  );
