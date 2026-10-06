import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showError } from "../store/toast";
import type { View } from "../store/ui";
import { api, type Article, type ArticleQuery } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    // I dati sono locali: niente refetch automatici, si invalidano a ogni modifica.
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
  },
});

export const keys = {
  status: ["status"],
  counts: ["counts"],
  sections: ["sections"],
  tags: ["tags"],
  /** Prefisso di tutti gli elenchi di articoli. */
  articles: ["articles"],
  articleList: (view: View, query: ArticleQuery) => ["articles", view, query] as const,
  filterOptions: ["filterOptions"],
  /** Prefisso di tutti i dettagli. */
  article: ["article"],
  articleDetail: (id: number) => ["article", id] as const,
} as const;

/** Dati che dipendono dagli articoli: dopo ogni modifica vanno ricaricati. */
export const ARTICLE_DEPENDENT = [
  keys.articles,
  keys.article,
  keys.counts,
  keys.sections,
  keys.tags,
  keys.filterOptions,
] as const;

export const useAppStatus = () => useQuery({ queryKey: keys.status, queryFn: api.appStatus });
export const useViewCounts = () => useQuery({ queryKey: keys.counts, queryFn: api.viewCounts });
export const useSections = () => useQuery({ queryKey: keys.sections, queryFn: api.listSections });
export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: api.listTags });

export const useArticles = (view: View, query: ArticleQuery) =>
  useQuery({
    queryKey: keys.articleList(view, query),
    queryFn: () => api.listArticles(view, query),
    // Mentre si digita resta visibile l'elenco precedente: niente sfarfallii.
    placeholderData: keepPreviousData,
  });

export const useFilterOptions = () => useQuery({ queryKey: keys.filterOptions, queryFn: api.filterOptions });

export const useArticle = (id: number | null) =>
  useQuery({
    queryKey: keys.articleDetail(id ?? -1),
    queryFn: () => api.getArticle(id!),
    enabled: id !== null,
  });

/**
 * Mutazione che, al termine, aggiorna i dati indicati e mostra gli errori
 * all'utente. Restituisce una funzione asincrona che non lancia mai.
 */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  invalidate: readonly (readonly unknown[])[],
) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (args: A) => fn(...args),
    onSuccess: (result) => {
      // Se la risposta è un articolo aggiornato, lo si mostra subito.
      if (isArticle(result)) client.setQueryData(keys.articleDetail(result.id), result);
    },
    onSettled: () => Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey }))),
    onError: showError,
  });
  return (...args: A): Promise<R | undefined> => mutation.mutateAsync(args).catch(() => undefined);
}

const isArticle = (value: unknown): value is Article =>
  typeof value === "object" && value !== null && "sectionIds" in value && "id" in value;

export const refreshArticles = () =>
  Promise.all(ARTICLE_DEPENDENT.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

/** Dopo il cambio di libreria tutti i dati vanno ricaricati. */
export const resetAllData = () => queryClient.resetQueries();
