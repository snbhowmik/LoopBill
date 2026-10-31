export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <circle cx="12" cy="12" r="8.5" fill="none" stroke={tone === "light" ? "#7fd1b2" : "var(--accent)"} strokeWidth="3.2" />
        <circle cx="12" cy="3.5" r="2.4" fill={tone === "light" ? "#e9f1ec" : "var(--ink)"} />
      </svg>
      <span className={tone === "light" ? "text-[#e9f1ec]" : "text-ink"}>LoopBill</span>
    </span>
  );
}
