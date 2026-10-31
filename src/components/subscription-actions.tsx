import { ActionForm, ConfirmButton, SubmitButton } from "./forms";
import type { ActionState } from "@/lib/validation";
import { actionLabel, type SubscriptionAction } from "@/server/subscriptions";

const primary: SubscriptionAction[] = ["confirm", "activate", "resume"];

/** Lifecycle buttons for a subscription. Close asks for a second click. */
export function SubscriptionActions({
  actions,
  action,
  labels = {},
}: {
  actions: SubscriptionAction[];
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  labels?: Partial<Record<SubscriptionAction, string>>;
}) {
  const regular = actions.filter((a) => a !== "close");
  return (
    <ActionForm action={action} className="flex flex-wrap items-center justify-end gap-2 [&>[role=alert]]:mb-0 [&>[role=alert]]:w-full">
      {regular.map((a) => (
        <SubmitButton key={a} name="action" value={a} variant={primary.includes(a) ? "primary" : "secondary"}>
          {labels[a] ?? actionLabel[a]}
        </SubmitButton>
      ))}
      {actions.includes("close") && (
        <ConfirmButton name="action" value="close">{labels.close ?? actionLabel.close}</ConfirmButton>
      )}
    </ActionForm>
  );
}
