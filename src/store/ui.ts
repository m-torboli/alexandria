import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type FixedView = "all" | "toRead" | "favorites" | "incomplete" | "unclassified" | "trash";

export type View =
  | { kind: FixedView }
  | { kind: "section"; id: number }
  | { kind: "tag"; id: number };

interface UiState {
  view: View;
  /** Articolo mostrato nel pannello di dettaglio. */
  selectedArticleId: number | null;
  /** Sezioni espanse nell'albero, per id. */
  expanded: Record<number, boolean>;
  setView: (view: View) => void;
  selectArticle: (id: number | null) => void;
  setExpanded: (id: number, expanded: boolean) => void;
}

export const sameView = (a: View, b: View) =>
  a.kind === b.kind && ("id" in a ? a.id : null) === ("id" in b ? b.id : null);

/** La sezione aperta, se la vista corrente è una sezione. */
export const currentSectionId = (view: View) => (view.kind === "section" ? view.id : null);

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
      selectedArticleId: null,
      expanded: {},
      setView: (view) => set((s) => (sameView(s.view, view) ? s : { view, selectedArticleId: null })),
      selectArticle: (selectedArticleId) => set({ selectedArticleId }),
      setExpanded: (id, expanded) => set((s) => ({ expanded: { ...s.expanded, [id]: expanded } })),
    }),
    {
      name: "alexandria.ui",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ view: s.view, expanded: s.expanded }),
    },
  ),
);
