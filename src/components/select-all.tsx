"use client";

/** Toggles every draft checkbox that belongs to the given form. */
export function SelectAll({ form }: { form: string }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink-2">
      <input
        type="checkbox"
        className="size-4 accent-[var(--accent)]"
        onChange={(e) => {
          document
            .querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${form}"]`)
            .forEach((c) => (c.checked = e.target.checked));
        }}
      />
      Select all drafts on this page
    </label>
  );
}
