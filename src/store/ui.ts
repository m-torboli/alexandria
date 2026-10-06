import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { safeStorage } from "./storage";

export type FixedView =
  | "all"
  | "toRead"
  | "reading"
  | "read"
  | "favorites"
  | "incomplete"
  | "unclassified"
  | "trash";

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
  /** Articolo aperto nel lettore integrato. */
  readingId: number | null;
  setView: (view: View) => void;
  selectArticle: (id: number | null) => void;
  openReader: (id: number) => void;
  closeReader: () => void;
  setExpanded: (id: number, expanded: boolean) => void;
}

export const sameView = (a: View, b: View) =>
  a.kind === b.kind && ("id" in a ? a.id : null) === ("id" in b ? b.id : null);

/** La sezione aperta, se la vista corrente è una sezione. */
export const currentSectionId = (view: View) => (view.kind === "section" ? view.id : null);

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      view: { kind: "all" },
      selectedArticleId: null,
      expanded: {},
      readingId: null,
      setView: (view) => set((s) => (sameView(s.view, view) ? s : { view, selectedArticleId: null })),
      selectArticle: (selectedArticleId) => set({ selectedArticleId }),
      openReader: (id) => set({ readingId: id, selectedArticleId: id }),
      closeReader: () => set({ readingId: null }),
      setExpanded: (id, expanded) => set((s) => ({ expanded: { ...s.expanded, [id]: expanded } })),
    }),
    {
      name: "alexandria.ui",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ view: s.view, expanded: s.expanded }),
    },
  ),
);
