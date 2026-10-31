"use client";

import { useState } from "react";
import { btn } from "@/components/ui";

type Row = { key: string; id?: string; attribute: string; value: string; extraPrice: string };

export function VariantsEditor({ initial, disabled }: { initial: Omit<Row, "key">[]; disabled?: boolean }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r, i) => ({ ...r, key: r.id ?? `i${i}` })));
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <div>
      <input type="hidden" name="variants" value={JSON.stringify(rows.map((r) => ({ id: r.id, attribute: r.attribute, value: r.value, extraPrice: r.extraPrice })))} />
      {rows.length === 0 && <p className="mb-3 text-sm text-muted">No variants. Add one to offer, for example, different brands at different prices.</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_1fr_120px_auto] items-center gap-2">
            <input className="field-control" placeholder="Attribute (e.g. Brand)" value={r.attribute} disabled={disabled} onChange={(e) => update(r.key, { attribute: e.target.value })} aria-label="Attribute" />
            <input className="field-control" placeholder="Value (e.g. Northwind)" value={r.value} disabled={disabled} onChange={(e) => update(r.key, { value: e.target.value })} aria-label="Value" />
            <input className="field-control num" placeholder="+ price" inputMode="decimal" value={r.extraPrice} disabled={disabled} onChange={(e) => update(r.key, { extraPrice: e.target.value })} aria-label="Extra price" />
            {!disabled && (
              <button type="button" className={btn("ghost", "sm")} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button
          type="button"
          className={`${btn("secondary", "sm")} mt-3`}
          onClick={() => setRows((rs) => [...rs, { key: `n${Date.now()}`, attribute: rs.at(-1)?.attribute ?? "Brand", value: "", extraPrice: "0" }])}
        >
          Add variant
        </button>
      )}
    </div>
  );
}
