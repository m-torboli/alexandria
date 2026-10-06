import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

const DURATION_MS = 4500;
let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = "info") => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, tone }] });
    setTimeout(() => get().dismiss(id), DURATION_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const showError = (error: unknown) =>
  useToasts.getState().show(error instanceof Error ? error.message : String(error), "error");
