import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSearch } from "../../store/search";
import { useUi } from "../../store/ui";
import styles from "./Search.module.css";

const DEBOUNCE_MS = 140;
const isMac = navigator.userAgent.includes("Mac");

/** Campo di ricerca: Ctrl+K (⌘K su Mac) o Ctrl+F per attivarlo, Esc per svuotarlo. */
export function SearchField() {
  const text = useSearch((s) => s.text);
  const setText = useSearch((s) => s.setText);
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLInputElement>(null);

  // La ricerca parte quando si smette per un attimo di digitare.
  useEffect(() => {
    const timer = setTimeout(() => setText(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, setText]);

  // Se la ricerca cambia da fuori (es. "Azzera ricerca e filtri"), il campo si allinea.
  // Mentre si digita il campo ha il fuoco e comanda lui.
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(text);
  }, [text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      // Con il lettore aperto le stesse scorciatoie cercano nel documento.
      if (useUi.getState().readingId !== null) return;
      if (modifier && (e.key === "k" || e.key === "f")) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clear = () => {
    setDraft("");
    setText("");
  };

  return (
    <div className={styles.field}>
      <Search size={14} className={styles.fieldIcon} />
      <input
        ref={ref}
        type="search"
        value={draft}
        placeholder="Cerca per titolo, autore, anno, parole del testo…"
        aria-label="Cerca negli articoli"
        spellCheck={false}
        className={styles.input}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clear();
            ref.current?.blur();
          }
          // Freccia giù: si passa all'elenco dei risultati.
          if (e.key === "ArrowDown") {
            e.preventDefault();
            document.querySelector<HTMLElement>('[role="listbox"]')?.focus();
          }
        }}
      />
      {draft ? (
        <button type="button" className={styles.clear} aria-label="Cancella la ricerca" onClick={clear}>
          <X size={12} strokeWidth={2.5} />
        </button>
      ) : (
        <kbd className={styles.kbd}>{isMac ? "⌘K" : "Ctrl K"}</kbd>
      )}
    </div>
  );
}
