import { create } from "zustand";

/** Cosa si sta trascinando dentro la finestra. */
export type DragItem =
  | { type: "section"; sectionId: number; label: string }
  | { type: "article"; articleIds: number[]; label: string };

interface DragState {
  /**
   * Tasto Ctrl (Windows) o ⌥ (Mac) premuto: rilasciando un articolo su una
   * sezione lo si aggiunge anche lì invece di spostarlo.
   */
  copy: boolean;
  setCopy: (copy: boolean) => void;
}

export const useDragMode = create<DragState>((set) => ({
  copy: false,
  setCopy: (copy) => set((s) => (s.copy === copy ? s : { copy })),
}));

export const dragItem = (data: unknown) => (data ?? null) as DragItem | null;
