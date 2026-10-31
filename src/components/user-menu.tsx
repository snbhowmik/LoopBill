import { logout } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth";

const roleLabel = { ADMIN: "Admin", STAFF: "Staff", CUSTOMER: "Customer" } as const;

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
        {user.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{user.name}</div>
        <div className="truncate text-xs text-muted">{roleLabel[user.role]} · {user.email}</div>
      </div>
      <form action={logout}>
        <button className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
