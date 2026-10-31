import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ActionForm, ConfirmButton, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { inviteStaff, userAction } from "./actions";

export const metadata: Metadata = { title: "Users & access" };

const roleTone = { ADMIN: "info", STAFF: "accent", CUSTOMER: "neutral" } as const;

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  const portalUsers = await db.user.count({ where: { role: "CUSTOMER" } });

  return (
    <>
      <PageHeader
        title="Users & access"
        subtitle={`Admins control everything; staff handle day-to-day work but can't change the catalog, taxes or users. ${portalUsers} customers have portal logins.`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Team" padded={false}>
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th align="right">Actions</Th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-muted">(you)</span>}</Td>
                  <Td className="text-ink-2">{u.email}</Td>
                  <Td><Badge tone={roleTone[u.role]}>{u.role === "ADMIN" ? "Admin" : "Staff"}</Badge></Td>
                  <Td>
                    {!u.active ? <Badge tone="danger">Deactivated</Badge> : u.passwordHash ? <Badge>Active</Badge> : <Badge tone="warn">Invited</Badge>}
                  </Td>
                  <Td align="right">
                    <ActionForm action={userAction.bind(null, u.id)} className="flex justify-end gap-1.5 [&>[role]]:mb-0">
                      <SubmitButton size="sm" variant="secondary" name="action" value="reset">
                        {u.passwordHash ? "Send reset link" : "Resend invite"}
                      </SubmitButton>
                      {u.id !== me.id &&
                        (u.active ? (
                          <ConfirmButton size="sm" name="action" value="deactivate">Deactivate</ConfirmButton>
                        ) : (
                          <SubmitButton size="sm" variant="secondary" name="action" value="activate">Reactivate</SubmitButton>
                        ))}
                    </ActionForm>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Add a team member">
          <ActionForm action={inviteStaff} className="space-y-3" resetOnSuccess>
            <Field label="Name" name="name"><Input name="name" required /></Field>
            <Field label="Email" name="email"><Input name="email" type="email" required /></Field>
            <Field label="Role" name="role">
              <Select name="role" defaultValue="STAFF">
                <option value="STAFF">Staff — day-to-day work</option>
                <option value="ADMIN">Admin — full control</option>
              </Select>
            </Field>
            <p className="text-xs text-muted">They&apos;ll get an email with a link to choose their own password (valid 72 hours).</p>
            <SubmitButton className="w-full">Send invitation</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
