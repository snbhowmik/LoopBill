"use client";

import { useState } from "react";
import { btn } from "@/components/ui";

type Product = { id: string; name: string; variants: { id: string; label: string }[] };
type Row = { key: string; productId: string; variantId: string; quantity: string };

export function TemplateLinesEditor({ products, initial, disabled }: { products: Product[]; initial: Omit<Row, "key">[]; disabled?: boolean }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r, i) => ({ ...r, key: `i${i}` })));
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  return (
    <div>
      <input type="hidden" name="lines" value={JSON.stringify(rows.map((r) => ({ productId: r.productId, variantId: r.variantId, quantity: r.quantity })))} />
      {rows.length === 0 && <p className="mb-3 text-sm text-muted">The plan alone. Add product lines that every quotation should include.</p>}
      <div className="space-y-2">
        {rows.map((r) => {
          const product = products.find((p) => p.id === r.productId);
          return (
            <div key={r.key} className="grid grid-cols-[2fr_1.5fr_90px_auto] items-center gap-2">
              <select className="field-control" value={r.productId} disabled={disabled} aria-label="Product" onChange={(e) => update(r.key, { productId: e.target.value, variantId: "" })}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="field-control" value={r.variantId} disabled={disabled || !product?.variants.length} aria-label="Variant" onChange={(e) => update(r.key, { variantId: e.target.value })}>
                <option value="">{product?.variants.length ? "Base" : "—"}</option>
                {product?.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <input className="field-control num" type="number" min={1} value={r.quantity} disabled={disabled} aria-label="Quantity" onChange={(e) => update(r.key, { quantity: e.target.value })} />
              {!disabled && (
                <button type="button" className={btn("ghost", "sm")} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>Remove</button>
              )}
            </div>
          );
        })}
      </div>
      {!disabled && (
        <button type="button" className={`${btn("secondary", "sm")} mt-3`} onClick={() => setRows((rs) => [...rs, { key: `n${Date.now()}`, productId: "", variantId: "", quantity: "1" }])}>
          Add line
        </button>
      )}
    </div>
  );
}
