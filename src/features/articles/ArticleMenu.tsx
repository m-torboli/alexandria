import {
  BookCheck,
  BookOpen,
  BookOpenText,
  ExternalLink,
  FolderOpen,
  Quote,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";

import { ContextContent, ContextItem, ContextSeparator } from "../../components/Menu";
import { api, metadataOf, type ArticleSummary, type ReadingStatus } from "../../lib/api";
import { copyApa } from "../../lib/export";
import { ARTICLE_DEPENDENT, useAction } from "../../lib/queries";
import { confirm } from "../../store/confirm";
import { showError } from "../../store/toast";
import { useUi } from "../../store/ui";

/** Azioni sugli articoli, condivise da elenco, menu e pannello di dettaglio. */
export function useArticleActions() {
  const setStatus = useAction(api.setReadingStatus, ARTICLE_DEPENDENT);
  const setFavorite = useAction(api.setFavorite, ARTICLE_DEPENDENT);
  const trashMany = useAction(api.trashArticles, ARTICLE_DEPENDENT);
  const restoreMany = useAction(api.restoreArticles, ARTICLE_DEPENDENT);
  const deleteMany = useAction(api.deleteArticlesForever, ARTICLE_DEPENDENT);

  return {
    /** Apre il lettore integrato. */
    read: (id: number) => useUi.getState().openReader(id),
    /** Apre il PDF con l'applicazione predefinita del sistema. */
    openExternal: (id: number) => api.openArticlePdf(id).catch(showError),
    reveal: (id: number) => api.revealArticlePdf(id).catch(showError),
    copyApa: async (id: number) => {
      try {
        await copyApa(metadataOf(await api.getArticle(id)));
      } catch (error) {
        showError(error);
      }
    },
    setStatus: (id: number, status: ReadingStatus) => setStatus(id, status),
    setFavorite: (id: number, favorite: boolean) => setFavorite(id, favorite),
    trash: (id: number) => trashMany([id]),
    restore: (id: number) => restoreMany([id]),
    deleteForever: async (id: number) => {
      const ok = await confirm({
        title: "Eliminare definitivamente l'articolo?",
        body: <p>L'articolo e il suo PDF verranno eliminati. L'operazione non si può annullare.</p>,
        confirmLabel: "Elimina",
        destructive: true,
      });
      if (ok) await deleteMany([id]);
      return ok;
    },
  };
}

export function ArticleMenu({ article }: { article: ArticleSummary }) {
  const actions = useArticleActions();
  const { id } = article;

  if (article.deletedAt) {
    return (
      <ContextContent>
        <ContextItem icon={<RotateCcw size={14} />} onSelect={() => actions.restore(id)}>
          Ripristina
        </ContextItem>
        <ContextSeparator />
        <ContextItem icon={<Trash2 size={14} />} destructive onSelect={() => actions.deleteForever(id)}>
          Elimina definitivamente
        </ContextItem>
      </ContextContent>
    );
  }

  return (
    <ContextContent>
      <ContextItem icon={<BookOpenText size={14} />} onSelect={() => actions.read(id)}>
        Leggi
      </ContextItem>
      <ContextItem icon={<ExternalLink size={14} />} onSelect={() => actions.openExternal(id)}>
        Apri con l'app di sistema
      </ContextItem>
      <ContextItem icon={<FolderOpen size={14} />} onSelect={() => actions.reveal(id)}>
        Mostra nella cartella
      </ContextItem>
      <ContextSeparator />
      <ContextItem icon={<Quote size={14} />} onSelect={() => actions.copyApa(id)}>
        Copia citazione APA
      </ContextItem>
      <ContextSeparator />
      {article.readingStatus === 2 ? (
        <ContextItem icon={<BookOpen size={14} />} onSelect={() => actions.setStatus(id, 0)}>
          Segna come da leggere
        </ContextItem>
      ) : (
        <ContextItem icon={<BookCheck size={14} />} onSelect={() => actions.setStatus(id, 2)}>
          Segna come letto
        </ContextItem>
      )}
      <ContextItem
        icon={article.favorite ? <StarOff size={14} /> : <Star size={14} />}
        onSelect={() => actions.setFavorite(id, !article.favorite)}
      >
        {article.favorite ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
      </ContextItem>
      <ContextSeparator />
      <ContextItem icon={<Trash2 size={14} />} destructive onSelect={() => actions.trash(id)}>
        Sposta nel Cestino
      </ContextItem>
    </ContextContent>
  );
}
