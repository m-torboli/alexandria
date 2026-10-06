import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type FixedView = "all" | "toRead" | "favorites" | "incomplete" | "unclassified" | "trash";

export type View =
  | { kind: FixedView }
  | { kind: "section"; id: number }
  | { kind: "tag"; id: number };

interface UiState {
  view: View;
  /** Sezioni espanse nell'albero, per id. */
  expanded: Record<number, boolean>;
  setView: (view: View) => void;
  setExpanded: (id: number, expanded: boolean) => void;
}

export const sameView = (a: View, b: View) =>
  a.kind === b.kind && ("id" in a ? a.id : null) === ("id" in b ? b.id : null);

// localStorage può non essere disponibile: in quel caso si rinuncia a ricordare.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* ignorato */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignorato */
    }
  },
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      view: { kind: "all" },
      expanded: {},
      setView: (view) => set({ view }),
      setExpanded: (id, expanded) => set((s) => ({ expanded: { ...s.expanded, [id]: expanded } })),
    }),
    {
      name: "alexandria.ui",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ view: s.view, expanded: s.expanded }),
    },
  ),
);
