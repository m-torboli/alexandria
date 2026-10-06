import type { ReactNode } from "react";
import { create } from "zustand";

export interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
}

interface ConfirmState {
  request: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null;
  close: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  close: (ok) => {
    get().request?.resolve(ok);
    set({ request: null });
  },
}));

/** Chiede conferma all'utente con una finestra; risolve `true` se conferma. */
export function confirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { ...request, resolve } });
  });
}
