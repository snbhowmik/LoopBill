"use client";

import { useState } from "react";
import { PASSWORD_RULES } from "@/lib/validation";
import { Field, Input } from "./forms";
import { cx } from "./ui";

export function NewPasswordFields() {
  const [value, setValue] = useState("");
  return (
    <>
      <Field label="Password" name="password">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(value);
            return (
              <li key={r.label} className={cx("flex items-center gap-1.5", ok ? "text-accent" : "text-muted")}>
                <span aria-hidden>{ok ? "✓" : "○"}</span>
                {r.label}
              </li>
            );
          })}
        </ul>
      </Field>
      <Field label="Confirm password" name="confirm">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
    </>
  );
}
