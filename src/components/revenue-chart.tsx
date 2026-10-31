"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

type Point = { key: string; label: string; cents: number };

const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Single-series bar chart of money collected per month, with hover tooltip and a table fallback. */
export function RevenueChart({ data, title }: { data: Point[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const max = niceMax(Math.max(...data.map((d) => d.cents), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.min(36, slot - 2 - slot * 0.3);
  const y = (c: number) => PAD.top + innerH - (c / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const peak = data.reduce((best, d, i) => (d.cents > (data[best]?.cents ?? -1) ? i : best), 0);

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-chart-grid" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" className="num fill-muted">
              {compact.format(t / 100)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const top = y(d.cents);
          const h = PAD.top + innerH - top;
          const r = Math.min(4, h);
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                  className="fill-chart-1"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {i === peak && d.cents > 0 && hover === null && (
                <text x={x + barW / 2} y={top - 5} textAnchor="middle" fontSize="11" className="num fill-ink-2">
                  {compact.format(d.cents / 100)}
                </text>
              )}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" className="num fill-muted">
                {d.label}
              </text>
              {/* Hit target spans the full slot, taller than the bar. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: ${formatCents(d.cents)}`} />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="text-muted">{data[hover].label}</div>
          <div className="num font-semibold text-ink">{formatCents(data[hover].cents)}</div>
        </div>
      )}
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none">View as table</summary>
        <table className="num mt-2 w-full max-w-sm">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-line">
                <td className="py-1">{d.key}</td>
                <td className="py-1 text-right text-ink">{formatCents(d.cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
