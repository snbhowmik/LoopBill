import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PAGE_SIZE, pageParam } from "@/lib/params";
import { smtpConfigured } from "@/lib/mail";
import { Badge, Card, EmptyState, Notice, PageHeader, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "Email log" };

export default async function EmailsPage({ searchParams }: PageProps<"/emails">) {
  await requireAdmin();
  const page = pageParam(await searchParams);
  const [rows, total] = await Promise.all([
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.emailLog.count(),
  ]);
  return (
    <>
      <PageHeader title="Email log" subtitle="Every quotation, invoice, invitation and password email the system has sent." />
      {!smtpConfigured() && (
        <div className="mb-4">
          <Notice tone="warn">SMTP isn&apos;t configured, so emails are only recorded here and printed to the server log.</Notice>
        </div>
      )}
      <Card padded={false}>
        {rows.length === 0 ? (
          <EmptyState title="No emails yet" />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id}>
                <details className="group px-5 py-3">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.subject}</span>
                      <span className="text-xs text-muted">To {m.to} · {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </span>
                    {m.delivered ? <Badge tone="accent">Delivered</Badge> : <Badge tone="warn">Not sent</Badge>}
                  </summary>
                  <pre className="mt-3 rounded-lg bg-surface-2 p-3 font-sans text-[13px] whitespace-pre-wrap text-ink-2">{m.text}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/emails" params={{}} />
      </Card>
    </>
  );
}
