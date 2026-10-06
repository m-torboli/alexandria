import { ArrowDownUp, Check } from "lucide-react";

import { DropdownContent, DropdownItem, DropdownRoot, DropdownTrigger } from "../../components/Menu";
import type { SortKey } from "../../lib/api";
import { useSearch } from "../../store/search";
import styles from "./Search.module.css";

const OPTIONS: { key: SortKey; label: string; onlyWhenSearching?: boolean }[] = [
  { key: "relevance", label: "Pertinenza", onlyWhenSearching: true },
  { key: "added", label: "Data di aggiunta" },
  { key: "yearDesc", label: "Anno, dal più recente" },
  { key: "yearAsc", label: "Anno, dal meno recente" },
  { key: "title", label: "Titolo" },
  { key: "author", label: "Primo autore" },
];

export function SortMenu({ searching }: { searching: boolean }) {
  const sort = useSearch((s) => s.sort);
  const setSort = useSearch((s) => s.setSort);
  // Senza ricerca la pertinenza non ha senso: equivale alla data di aggiunta.
  const effective: SortKey = !searching && sort === "relevance" ? "added" : sort;
  const current = OPTIONS.find((o) => o.key === effective)!;

  return (
    <DropdownRoot>
      <DropdownTrigger asChild>
        <button type="button" className={styles.toolButton} title="Ordina">
          <ArrowDownUp size={14} />
          <span>{current.label}</span>
        </button>
      </DropdownTrigger>
      <DropdownContent align="end">
        {OPTIONS.filter((o) => searching || !o.onlyWhenSearching).map((option) => (
          <DropdownItem
            key={option.key}
            icon={<Check size={14} style={{ visibility: option.key === effective ? "visible" : "hidden" }} />}
            onSelect={() => setSort(option.key)}
          >
            {option.label}
          </DropdownItem>
        ))}
      </DropdownContent>
    </DropdownRoot>
  );
}
