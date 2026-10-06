import { Quote } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../components/Button";
import { api, type Article } from "../../lib/api";
import { keys, queryClient } from "../../lib/queries";
import { showError } from "../../store/toast";
import styles from "./Reader.module.css";

const SAVE_DELAY_MS = 700;

interface Selection {
  text: string;
  page: number;
}

/** Testo selezionato dentro le pagine del PDF, con il numero di pagina. */
function pdfSelection(): Selection | null {
  const selection = document.getSelection();
  const text = selection?.toString().replace(/\s+/g, " ").trim();
  const node = selection?.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;
  const page = element?.closest(".page[data-page-number]");
  return text && page ? { text, page: Number(page.getAttribute("data-page-number")) } : null;
}

/** Note dell'articolo, salvate automaticamente mentre si scrive. */
export function NotesPanel({ article, page }: { article: Article; page: number }) {
  const [draft, setDraft] = useState(article.notes);
  const [status, setStatus] = useState<"saved" | "pending" | "saving">("saved");
  const [selection, setSelection] = useState<Selection | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  /** Ultima posizione del cursore nelle note (null = in fondo). */
  const caret = useRef<number | null>(null);
  const latest = useRef(draft);
  const saved = useRef(article.notes);
  latest.current = draft;

  const save = async () => {
    const text = latest.current;
    if (text === saved.current) return;
    setStatus("saving");
    try {
      await api.setArticleNotes(article.id, text);
      saved.current = text;
      queryClient.setQueryData<Article>(keys.articleDetail(article.id), (old) => old && { ...old, notes: text });
      setStatus(latest.current === text ? "saved" : "pending");
    } catch (error) {
      showError(error);
      setStatus("pending");
    }
  };

  // Salvataggio poco dopo l'ultima battuta…
  useEffect(() => {
    if (draft === saved.current) return;
    setStatus("pending");
    const timer = setTimeout(save, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  // …e comunque alla chiusura del lettore.
  useEffect(
    () => () => {
      if (latest.current !== saved.current) api.setArticleNotes(article.id, latest.current).catch(showError);
    },
    [article.id],
  );

  useEffect(() => {
    const onChange = () => setSelection(pdfSelection());
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  /** Riporta nelle note il passo selezionato, tra virgolette e con la pagina. */
  const quoteSelection = () => {
    const current = pdfSelection() ?? selection;
    if (!current) return;
    const textarea = textRef.current;
    const at = Math.min(caret.current ?? draft.length, draft.length);
    const before = draft.slice(0, at).replace(/\s*$/, "");
    const after = draft.slice(at).replace(/^\s*/, "");
    const quote = `“${current.text}” (p. ${current.page})`;
    const next = [before, quote, after].filter(Boolean).join("\n\n") + (after ? "" : "\n\n");
    setDraft(next);
    const end = (before ? before.length + 2 : 0) + quote.length + 2;
    caret.current = end;
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(end, end);
    });
  };

  return (
    <aside className={styles.notes} aria-label="Note">
      <div className={styles.notesHeader}>
        <span className={styles.notesTitle}>Note</span>
        <span className={styles.notesStatus}>
          {status === "saved" ? (draft ? "Salvate" : "") : status === "saving" ? "Salvataggio…" : "Modificate"}
        </span>
      </div>
      <textarea
        ref={textRef}
        className={styles.notesText}
        value={draft}
        spellCheck
        lang="it"
        placeholder={
          "Scrivi qui le tue note sull'articolo.\n\n" +
          "Seleziona un passo nel PDF e premi “Cita la selezione” per riportarlo qui con il numero di pagina."
        }
        onChange={(e) => setDraft(e.target.value)}
        onSelect={(e) => (caret.current = e.currentTarget.selectionStart)}
        onBlur={save}
      />
      <div className={styles.notesFooter}>
        <Button
          disabled={!selection}
          // Il clic non deve far perdere la selezione nel PDF.
          onMouseDown={(e) => e.preventDefault()}
          onClick={quoteSelection}
          title={selection ? `Pagina ${selection.page}` : "Seleziona prima un passo nel PDF"}
        >
          <Quote size={13} />
          Cita la selezione
        </Button>
        <span className={styles.notesPage}>Pagina {page}</span>
      </div>
    </aside>
  );
}
