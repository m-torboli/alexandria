import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ArticleQuery, Filters, SortKey } from "../lib/api";
import { safeStorage } from "./storage";
import type { View } from "./ui";

export const EMPTY_FILTERS: Filters = {
  authorIds: [],
  journals: [],
  tagIds: [],
  yearFrom: null,
  yearTo: null,
  statuses: [],
  favoritesOnly: false,
  addedWithinDays: null,
};

/** Dove cercare: in tutta la libreria (predefinito) o solo nella vista aperta. */
export type SearchScope = "library" | "view";

interface SearchState {
  text: string;
  filters: Filters;
  sort: SortKey;
  scope: SearchScope;
  filtersOpen: boolean;
  setText: (text: string) => void;
  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  setSort: (sort: SortKey) => void;
  setScope: (scope: SearchScope) => void;
  toggleFiltersOpen: () => void;
}

export const useSearch = create<SearchState>()(
  persist(
    (set) => ({
      text: "",
      filters: EMPTY_FILTERS,
      // Con una ricerca in corso ordina per pertinenza, altrimenti per data di aggiunta.
      sort: "relevance",
      scope: "library",
      filtersOpen: false,
      setText: (text) => set({ text }),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      clearFilters: () => set({ filters: EMPTY_FILTERS }),
      setSort: (sort) => set({ sort }),
      setScope: (scope) => set({ scope }),
      toggleFiltersOpen: () => set((s) => ({ filtersOpen: !s.filtersOpen })),
    }),
    {
      name: "alexandria.search",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ sort: s.sort, filtersOpen: s.filtersOpen }),
    },
  ),
);

/** Numero di filtri attivi, per il distintivo sul pulsante. */
export function activeFilterCount(f: Filters): number {
  return [
    f.authorIds.length > 0,
    f.journals.length > 0,
    f.tagIds.length > 0,
    f.yearFrom !== null || f.yearTo !== null,
    f.statuses.length > 0,
    f.favoritesOnly,
    f.addedWithinDays !== null,
  ].filter(Boolean).length;
}

/** Vista e query da chiedere al motore, dati vista aperta e stato della ricerca. */
export function effectiveQuery(
  view: View,
  { text, filters, sort, scope }: Pick<SearchState, "text" | "filters" | "sort" | "scope">,
): { view: View; query: ArticleQuery } {
  const searching = text.trim() !== "";
  const searchEverywhere = searching && scope === "library" && view.kind !== "trash";
  return {
    view: searchEverywhere ? { kind: "all" } : view,
    query: { text: text.trim(), filters, sort },
  };
}
