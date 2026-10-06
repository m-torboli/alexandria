import clsx from "clsx";
import { Star } from "lucide-react";
import { useEffect, useRef, type HTMLAttributes, type KeyboardEvent } from "react";

import { ContextRoot, ContextTrigger } from "../../components/Menu";
import type { ArticleSummary } from "../../lib/api";
import { shortAuthors } from "../../lib/authors";
import { highlight, parseSnippet, snippetText, type Segment } from "../../lib/highlight";
import { useUi } from "../../store/ui";
import { ArticleMenu, useArticleActions } from "./ArticleMenu";
import styles from "./Articles.module.css";

interface ArticleListProps {
  articles: ArticleSummary[];
  inTrash: boolean;
  /** Termini della ricerca in corso, da evidenziare. */
  terms: string[];
}

export function ArticleList({ articles, inTrash, terms }: ArticleListProps) {
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
    else if (selectedId !== null && e.key === "Enter" && !inTrash) actions.read(selectedId);
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
              terms={terms}
              selected={article.id === selectedId}
              onSelect={() => select(article.id)}
              onOpen={() => !inTrash && actions.read(article.id)}
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
  terms: string[];
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function ArticleRow({ article, terms, selected, onSelect, onOpen, ...props }: ArticleRowProps) {
  const details = [shortAuthors(article.authors), article.journal].filter(Boolean).join(" · ");
  const snippet = usefulSnippet(article);

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
        <div className={styles.rowTitle}>
          <Highlighted segments={highlight(article.title || "Senza titolo", terms)} />
        </div>
        <div className={styles.rowDetails}>
          {details ? (
            <Highlighted segments={highlight(details, terms)} />
          ) : (
            <span className={styles.missing}>Autori sconosciuti</span>
          )}
        </div>
        {snippet && (
          <div className={styles.snippet}>
            <Highlighted segments={parseSnippet(snippet)} />
          </div>
        )}
        {!article.metadataComplete && <span className={styles.badge}>Dati da completare</span>}
      </div>
      <div className={styles.rowAside}>
        {article.year && (
          <span className={styles.year}>
            <Highlighted segments={highlight(String(article.year), terms)} />
          </span>
        )}
        {article.favorite && <Star size={13} className={styles.star} fill="currentColor" aria-label="Preferito" />}
      </div>
    </div>
  );
}

function Highlighted({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark key={i} className={styles.mark}>
            {s.text}
          </mark>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/**
 * L'estratto serve solo se mostra qualcosa di nuovo: se la parola è stata
 * trovata nel titolo o negli autori, si vede già nella riga.
 */
function usefulSnippet(article: ArticleSummary): string | null {
  if (!article.snippet) return null;
  const plain = snippetText(article.snippet).toLowerCase();
  const visible = `${article.title} ${article.authors.map((a) => `${a.given} ${a.family}`).join(" ")} ${
    article.journal ?? ""
  } ${article.year ?? ""}`.toLowerCase();
  return plain && !visible.includes(plain) ? article.snippet : null;
}
