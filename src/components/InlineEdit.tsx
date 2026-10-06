import { useEffect, useRef } from "react";

interface InlineEditProps {
  initialValue: string;
  placeholder?: string;
  className?: string;
  /** Chiamata con il testo confermato (Invio o clic altrove). */
  onCommit: (value: string) => void;
  /** Chiamata con Esc, o se il testo confermato è vuoto o invariato. */
  onCancel: () => void;
}

/** Campo di testo che sostituisce un'etichetta per rinominarla sul posto. */
export function InlineEdit({ initialValue, placeholder, className, onCommit, onCancel }: InlineEditProps) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = ref.current?.value.trim() ?? "";
    if (commit && value && value !== initialValue) onCommit(value);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      className={className}
      defaultValue={initialValue}
      placeholder={placeholder}
      spellCheck={false}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
