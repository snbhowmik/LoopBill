import "server-only";
import { getCurrentUser } from "./auth";
import type { ActionState } from "./validation";

/** For server actions: returns an error state unless the caller is an admin. */
export async function adminOnly(): Promise<ActionState | null> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? null : { error: "Only an admin can change this." };
}
