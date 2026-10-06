import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

interface EditableTextProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Con `multiline`, Invio conferma invece di andare a capo (es. il titolo). */
  submitOnEnter?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Testo modificabile sul posto: sembra un'etichetta finché non lo si tocca.
 * Salva quando si esce dal campo (o con Invio), Esc annulla le modifiche.
 */
export function EditableText({
  value,
  onCommit,
  placeholder,
  multiline,
  submitOnEnter,
  className,
  ...aria
}: EditableTextProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  // Se il valore cambia da fuori (altro articolo, dati scaricati) si riparte da lì.
  useEffect(() => setDraft(value), [value]);

  // Il campo su più righe cresce con il testo.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!multiline || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, multiline]);

  const commit = () => {
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
    else setDraft(value);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setDraft(value);
      requestAnimationFrame(() => ref.current?.blur());
    } else if (e.key === "Enter" && (!multiline || (submitOnEnter && !e.shiftKey))) {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  const props = {
    ref,
    value: draft,
    placeholder,
    className,
    spellCheck: false,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown,
    ...aria,
  };
  return multiline ? <textarea rows={1} {...props} /> : <input {...props} />;
}
