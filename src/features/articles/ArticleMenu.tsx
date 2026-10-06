import {
  BookOpenText,
  ExternalLink,
  FolderInput,
  FolderOpen,
  Quote,
  RotateCcw,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";

import { ContextContent, ContextItem, ContextSeparator, ContextSub } from "../../components/Menu";
import { api, metadataOf, type ArticleSummary, type ReadingStatus } from "../../lib/api";
import { copyApa } from "../../lib/export";
import { ARTICLE_DEPENDENT, useAction, useSections } from "../../lib/queries";
import { visibleRows } from "../../lib/sectionTree";
import { READING_STATUS } from "../../lib/views";
import { confirm } from "../../store/confirm";
import { showError, useToasts } from "../../store/toast";
import { useUi } from "../../store/ui";
import styles from "./Articles.module.css";

/** Azioni sugli articoli, condivise da elenco, menu e pannello di dettaglio. */
export function useArticleActions() {
  const setStatus = useAction(api.setReadingStatus, ARTICLE_DEPENDENT);
  const setFavorite = useAction(api.setFavorite, ARTICLE_DEPENDENT);
  const trashMany = useAction(api.trashArticles, ARTICLE_DEPENDENT);
  const restoreMany = useAction(api.restoreArticles, ARTICLE_DEPENDENT);
  const deleteMany = useAction(api.deleteArticlesForever, ARTICLE_DEPENDENT);
  const place = useAction(api.placeArticles, ARTICLE_DEPENDENT);

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
    /** Sposta nella sezione (se si sta guardando una sezione) o vi aggiunge l'articolo. */
    placeIn: async (id: number, sectionId: number, sectionName: string) => {
      const view = useUi.getState().view;
      const from = view.kind === "section" ? view.id : null;
      if (from === sectionId) return;
      await place([id], sectionId, from);
      useToasts.getState().show(from !== null ? `Spostato in “${sectionName}”.` : `Aggiunto a “${sectionName}”.`);
    },
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

/** Pallino colorato dello stato, per menu e selettori. */
export function StatusDot({ status }: { status: ReadingStatus }) {
  return <span className={styles.statusDot} style={{ background: READING_STATUS[status].color }} />;
}

export function ArticleMenu({ article }: { article: ArticleSummary }) {
  const actions = useArticleActions();
  const sections = useSections().data ?? [];
  const inSection = useUi((s) => (s.view.kind === "section" ? s.view.id : null));
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

  const otherStatuses = ([0, 1, 2] as ReadingStatus[]).filter((s) => s !== article.readingStatus);

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
      {sections.length > 0 && (
        <ContextSub icon={<FolderInput size={14} />} label={inSection !== null ? "Sposta in sezione" : "Aggiungi a sezione"}>
          {visibleRows(sections, () => true).map(({ section, depth }) => (
            <ContextItem
              key={section.id}
              disabled={section.id === inSection}
              style={{ paddingLeft: 8 + depth * 14 }}
              onSelect={() => actions.placeIn(id, section.id, section.name)}
            >
              {section.name}
            </ContextItem>
          ))}
        </ContextSub>
      )}
      <ContextItem icon={<Quote size={14} />} onSelect={() => actions.copyApa(id)}>
        Copia citazione APA
      </ContextItem>
      <ContextSeparator />
      {otherStatuses.map((status) => (
        <ContextItem key={status} icon={<StatusDot status={status} />} onSelect={() => actions.setStatus(id, status)}>
          Segna come {READING_STATUS[status].label.toLowerCase()}
        </ContextItem>
      ))}
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
