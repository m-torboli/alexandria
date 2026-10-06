import clsx from "clsx";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  LoaderCircle,
  Minus,
  MoveHorizontal,
  PanelRight,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, IconButton } from "../../components/Button";
import { api } from "../../lib/api";
import { shortAuthors } from "../../lib/authors";
import { refreshArticles, useArticle } from "../../lib/queries";
import { showError } from "../../store/toast";
import { useUi } from "../../store/ui";
import { NotesPanel } from "./NotesPanel";
import styles from "./Reader.module.css";
import { usePdfViewer } from "./usePdfViewer";

const isMac = navigator.userAgent.includes("Mac");
const NOTES_KEY = "alexandria.readerNotesOpen";

/** Lettore a tutta finestra, con le note affiancate. Esc per tornare alla libreria. */
export function Reader({ articleId }: { articleId: number }) {
  const article = useArticle(articleId).data;
  const close = useUi((s) => s.closeReader);
  const containerRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const { state, goToPage, zoom, fitWidth, find } = usePdfViewer(articleId, containerRef);
  const [query, setQuery] = useState("");
  const [notesOpen, setNotesOpen] = useState(() => {
    try {
      return localStorage.getItem(NOTES_KEY) !== "false";
    } catch {
      return true;
    }
  });

  const toggleNotes = () => {
    setNotesOpen((open) => {
      try {
        localStorage.setItem(NOTES_KEY, String(!open));
      } catch {
        /* ignorato */
      }
      return !open;
    });
  };

  // Aprire un articolo "da leggere" lo porta "in lettura".
  const markedRef = useRef(false);
  useEffect(() => {
    if (!article || markedRef.current) return;
    markedRef.current = true;
    if (article.readingStatus === 0) {
      api.setReadingStatus(article.id, 1).then(refreshArticles).catch(showError);
    }
  }, [article]);

  // All'uscita, elenchi e ricerca si aggiornano con le note scritte.
  useEffect(() => () => void refreshArticles(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const typing = (e.target as HTMLElement).closest("input, textarea");
      if (e.key === "Escape" && !typing) close();
      else if (modifier && e.key === "f") {
        e.preventDefault();
        findRef.current?.focus();
        findRef.current?.select();
      } else if (modifier && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        zoom(1);
      } else if (modifier && e.key === "-") {
        e.preventDefault();
        zoom(-1);
      } else if (modifier && e.key === "0") {
        e.preventDefault();
        fitWidth();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, zoom, fitWidth]);

  return (
    <div className={styles.reader} role="dialog" aria-label="Lettore">
      <header className={styles.toolbar} data-tauri-drag-region>
        <Button variant="ghost" className={styles.back} onClick={close}>
          <ChevronLeft size={16} />
          Libreria
        </Button>

        <div className={styles.titleBlock} data-tauri-drag-region>
          <span className={styles.title}>{article?.title || "Senza titolo"}</span>
          <span className={styles.subtitle}>
            {[article && shortAuthors(article.authors), article?.year].filter(Boolean).join(" · ")}
          </span>
        </div>

        <div className={styles.controls}>
          {state.status === "ready" && (
            <>
              <PageInput page={state.page} pages={state.pages} onGo={goToPage} />
              <span className={styles.divider} />
              <IconButton label="Riduci" onClick={() => zoom(-1)}>
                <Minus size={15} />
              </IconButton>
              <button type="button" className={styles.zoomValue} title="Adatta alla larghezza" onClick={fitWidth}>
                {Math.round(state.scale * 100)}%
              </button>
              <IconButton label="Ingrandisci" onClick={() => zoom(1)}>
                <Plus size={15} />
              </IconButton>
              <IconButton label="Adatta alla larghezza" onClick={fitWidth}>
                <MoveHorizontal size={15} />
              </IconButton>
              <span className={styles.divider} />
              <div className={styles.find}>
                <Search size={13} className={styles.findIcon} />
                <input
                  ref={findRef}
                  type="search"
                  value={query}
                  placeholder="Cerca nel documento"
                  aria-label="Cerca nel documento"
                  spellCheck={false}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    find(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") find(query, e.shiftKey ? "previous" : "next");
                    if (e.key === "Escape") {
                      setQuery("");
                      find("");
                      e.currentTarget.blur();
                    }
                  }}
                />
                {query && (
                  <>
                    <span className={styles.findCount}>
                      {state.find.total ? `${state.find.current}/${state.find.total}` : "0"}
                    </span>
                    <IconButton label="Precedente" onClick={() => find(query, "previous")}>
                      <ChevronUp size={14} />
                    </IconButton>
                    <IconButton label="Successivo" onClick={() => find(query, "next")}>
                      <ChevronDown size={14} />
                    </IconButton>
                  </>
                )}
              </div>
            </>
          )}
          <IconButton label="Apri con l'app di sistema" onClick={() => api.openArticlePdf(articleId).catch(showError)}>
            <ExternalLink size={15} />
          </IconButton>
          <IconButton
            label={notesOpen ? "Nascondi le note" : "Mostra le note"}
            className={clsx(notesOpen && styles.toggleOn)}
            onClick={toggleNotes}
          >
            <PanelRight size={16} />
          </IconButton>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.stage}>
          <div ref={containerRef} className={styles.viewerContainer}>
            <div className="pdfViewer" />
          </div>
          {state.status === "loading" && (
            <div className={styles.overlay}>
              <LoaderCircle size={22} className={styles.spin} />
            </div>
          )}
          {state.status === "error" && (
            <div className={styles.overlay}>
              <p className={styles.error}>Impossibile aprire il PDF. {state.error}</p>
            </div>
          )}
        </div>
        {notesOpen && article && <NotesPanel article={article} page={state.page} />}
      </div>
    </div>
  );
}

function PageInput({ page, pages, onGo }: { page: number; pages: number; onGo: (page: number) => void }) {
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);

  return (
    <label className={styles.pageInput}>
      <input
        value={draft}
        inputMode="numeric"
        aria-label="Pagina"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft(String(page))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onGo(Number(draft));
            e.currentTarget.blur();
          }
        }}
      />
      <span>/ {pages}</span>
    </label>
  );
}
