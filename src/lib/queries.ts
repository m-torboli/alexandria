import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showError } from "../store/toast";
import { api } from "./api";

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
} as const;

export const useAppStatus = () => useQuery({ queryKey: keys.status, queryFn: api.appStatus });
export const useViewCounts = () => useQuery({ queryKey: keys.counts, queryFn: api.viewCounts });
export const useSections = () => useQuery({ queryKey: keys.sections, queryFn: api.listSections });
export const useTags = () => useQuery({ queryKey: keys.tags, queryFn: api.listTags });

/**
 * Mutazione che, al termine, aggiorna i dati indicati e mostra gli errori
 * all'utente. Restituisce una funzione asincrona che non lancia mai.
 */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  invalidate: readonly (readonly string[])[],
) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (args: A) => fn(...args),
    onSettled: () => Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey }))),
    onError: showError,
  });
  return (...args: A): Promise<R | undefined> => mutation.mutateAsync(args).catch(() => undefined);
}

/** Dopo il cambio di libreria tutti i dati vanno ricaricati. */
export const resetAllData = () => queryClient.resetQueries();
