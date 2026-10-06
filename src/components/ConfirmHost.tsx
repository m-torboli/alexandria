import { useConfirmStore } from "../store/confirm";
import { ConfirmDialog } from "./ConfirmDialog";

/** Mostra le richieste di conferma fatte con `confirm()`. */
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const close = useConfirmStore((s) => s.close);
  if (!request) return null;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && close(false)}
      title={request.title}
      confirmLabel={request.confirmLabel}
      destructive={request.destructive}
      onConfirm={() => close(true)}
    >
      {request.body}
    </ConfirmDialog>
  );
}
