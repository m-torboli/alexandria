import clsx from "clsx";
import { Star } from "lucide-react";
import { useEffect, useRef, type HTMLAttributes, type KeyboardEvent } from "react";

import { ContextRoot, ContextTrigger } from "../../components/Menu";
import type { ArticleSummary } from "../../lib/api";
import { shortAuthors } from "../../lib/authors";
import { useUi } from "../../store/ui";
import { ArticleMenu, useArticleActions } from "./ArticleMenu";
import styles from "./Articles.module.css";

interface ArticleListProps {
  articles: ArticleSummary[];
  inTrash: boolean;
}

export function ArticleList({ articles, inTrash }: ArticleListProps) {
  const selectedId = useUi((s) => s.selectedArticleId);
  const select = useUi((s) => s.selectArticle);
  const actions = useArticleActions();
  const listRef = useRef<HTMLDivElement>(null);

  // La riga selezionata resta sempre visibile.
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const onKeyDown = (e: KeyboardEvent) => {
    const index = articles.findIndex((a) => a.id === selectedId);
    const move = (to: number) => {
      e.preventDefault();
      const target = articles[Math.max(0, Math.min(articles.length - 1, to))];
      if (target) select(target.id);
    };
    if (e.key === "ArrowDown") move(index + 1);
    else if (e.key === "ArrowUp") move(index === -1 ? 0 : index - 1);
    else if (selectedId !== null && e.key === "Enter" && !inTrash) actions.open(selectedId);
    else if (selectedId !== null && (e.key === "Delete" || e.key === "Backspace") && !inTrash) {
      const next = articles[index + 1] ?? articles[index - 1];
      actions.trash(selectedId);
      select(next ? next.id : null);
    }
  };

  return (
    <div ref={listRef} role="listbox" aria-label="Elenco articoli" tabIndex={0} className={styles.list} onKeyDown={onKeyDown}>
      {articles.map((article) => (
        <ContextRoot key={article.id} onOpenChange={(open) => open && select(article.id)}>
          <ContextTrigger asChild>
            <ArticleRow
              article={article}
              selected={article.id === selectedId}
              onSelect={() => select(article.id)}
              onOpen={() => !inTrash && actions.open(article.id)}
            />
          </ContextTrigger>
          <ArticleMenu article={article} />
        </ContextRoot>
      ))}
    </div>
  );
}

interface ArticleRowProps extends HTMLAttributes<HTMLDivElement> {
  article: ArticleSummary;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function ArticleRow({ article, selected, onSelect, onOpen, ...props }: ArticleRowProps) {
  const details = [shortAuthors(article.authors), article.journal].filter(Boolean).join(" · ");

  return (
    <div
      {...props}
      role="option"
      aria-selected={selected}
      className={clsx(styles.row, selected && styles.rowSelected)}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <span className={styles.status} data-status={article.readingStatus} aria-hidden />
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>{article.title || "Senza titolo"}</div>
        <div className={styles.rowDetails}>
          {details || <span className={styles.missing}>Autori sconosciuti</span>}
        </div>
        {!article.metadataComplete && <span className={styles.badge}>Dati da completare</span>}
      </div>
      <div className={styles.rowAside}>
        {article.year && <span className={styles.year}>{article.year}</span>}
        {article.favorite && <Star size={13} className={styles.star} fill="currentColor" aria-label="Preferito" />}
      </div>
    </div>
  );
}
