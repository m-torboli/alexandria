import clsx from "clsx";
import { Check, ChevronDown, Star, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Popover } from "../../components/Popover";
import type { ReadingStatus } from "../../lib/api";
import { useFilterOptions, useTags } from "../../lib/queries";
import { activeFilterCount, useSearch } from "../../store/search";
import { TagDot } from "../sidebar/TagList";
import styles from "./Search.module.css";

const STATUS_LABELS: Record<ReadingStatus, string> = { 0: "Da leggere", 1: "In lettura", 2: "Letto" };

const ADDED_OPTIONS = [
  { days: 7, label: "Ultima settimana" },
  { days: 30, label: "Ultimo mese" },
  { days: 90, label: "Ultimi 3 mesi" },
  { days: 365, label: "Ultimo anno" },
];

/** Riassunto di una scelta multipla: "Rossi", "Rossi +2". */
const summarize = (names: string[]) => (names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]);

export function FilterBar() {
  const filters = useSearch((s) => s.filters);
  const setFilters = useSearch((s) => s.setFilters);
  const clearFilters = useSearch((s) => s.clearFilters);
  const options = useFilterOptions().data;
  const tags = useTags().data ?? [];

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const authorNames = (options?.authors ?? []).filter((a) => filters.authorIds.includes(a.id)).map((a) => a.family);
  const tagNames = tags.filter((t) => filters.tagIds.includes(t.id)).map((t) => t.name);
  const yearLabel =
    filters.yearFrom !== null && filters.yearTo !== null
      ? filters.yearFrom === filters.yearTo
        ? `${filters.yearFrom}`
        : `${filters.yearFrom}–${filters.yearTo}`
      : filters.yearFrom !== null
        ? `dal ${filters.yearFrom}`
        : filters.yearTo !== null
          ? `fino al ${filters.yearTo}`
          : undefined;

  return (
    <div className={styles.filterBar} role="toolbar" aria-label="Filtri">
      <FilterPill
        label="Autore"
        value={authorNames.length ? summarize(authorNames) : undefined}
        onClear={() => setFilters({ authorIds: [] })}
      >
        <CheckList
          searchable
          empty="Nessun autore nella libreria."
          items={(options?.authors ?? []).map((a) => ({
            key: a.id,
            label: a.given ? `${a.family}, ${a.given}` : a.family,
            count: a.count,
            checked: filters.authorIds.includes(a.id),
          }))}
          onToggle={(id) => setFilters({ authorIds: toggle(filters.authorIds, id as number) })}
        />
      </FilterPill>

      <FilterPill
        label="Anno"
        value={yearLabel}
        onClear={() => setFilters({ yearFrom: null, yearTo: null })}
        width={240}
      >
        <YearRange
          from={filters.yearFrom}
          to={filters.yearTo}
          min={options?.minYear ?? null}
          max={options?.maxYear ?? null}
          onChange={(yearFrom, yearTo) => setFilters({ yearFrom, yearTo })}
        />
      </FilterPill>

      <FilterPill
        label="Rivista"
        value={filters.journals.length ? summarize(filters.journals) : undefined}
        onClear={() => setFilters({ journals: [] })}
        width={300}
      >
        <CheckList
          searchable
          empty="Nessuna rivista nella libreria."
          items={(options?.journals ?? []).map((j) => ({
            key: j.name,
            label: j.name,
            count: j.count,
            checked: filters.journals.includes(j.name),
          }))}
          onToggle={(name) => setFilters({ journals: toggle(filters.journals, name as string) })}
        />
      </FilterPill>

      <FilterPill label="Tag" value={tagNames.length ? summarize(tagNames) : undefined} onClear={() => setFilters({ tagIds: [] })}>
        <CheckList
          empty="Nessun tag: creali dalla barra laterale."
          items={tags.map((t) => ({
            key: t.id,
            label: t.name,
            icon: <TagDot color={t.color} />,
            count: t.articleCount,
            checked: filters.tagIds.includes(t.id),
          }))}
          onToggle={(id) => setFilters({ tagIds: toggle(filters.tagIds, id as number) })}
        />
      </FilterPill>

      <FilterPill
        label="Stato"
        value={filters.statuses.length ? summarize(filters.statuses.map((s) => STATUS_LABELS[s])) : undefined}
        onClear={() => setFilters({ statuses: [] })}
        width={200}
      >
        <CheckList
          items={([0, 1, 2] as ReadingStatus[]).map((s) => ({
            key: s,
            label: STATUS_LABELS[s],
            checked: filters.statuses.includes(s),
          }))}
          onToggle={(s) => setFilters({ statuses: toggle(filters.statuses, s as ReadingStatus) })}
        />
      </FilterPill>

      <FilterPill
        label="Aggiunti"
        value={ADDED_OPTIONS.find((o) => o.days === filters.addedWithinDays)?.label}
        onClear={() => setFilters({ addedWithinDays: null })}
        width={200}
      >
        <CheckList
          items={ADDED_OPTIONS.map((o) => ({
            key: o.days,
            label: o.label,
            checked: filters.addedWithinDays === o.days,
          }))}
          onToggle={(days) =>
            setFilters({ addedWithinDays: filters.addedWithinDays === days ? null : (days as number) })
          }
        />
      </FilterPill>

      <button
        type="button"
        aria-pressed={filters.favoritesOnly}
        className={clsx(styles.pill, filters.favoritesOnly && styles.pillActive)}
        onClick={() => setFilters({ favoritesOnly: !filters.favoritesOnly })}
      >
        <Star size={12} fill={filters.favoritesOnly ? "currentColor" : "none"} />
        Preferiti
      </button>

      {activeFilterCount(filters) > 0 && (
        <button type="button" className={styles.clearAll} onClick={clearFilters}>
          Azzera filtri
        </button>
      )}
    </div>
  );
}

interface FilterPillProps {
  label: string;
  /** Valore scelto; se presente la pillola è attiva. */
  value?: string;
  onClear: () => void;
  width?: number;
  children: ReactNode;
}

function FilterPill({ label, value, onClear, width, children }: FilterPillProps) {
  const active = value !== undefined;
  return (
    <span className={clsx(styles.pillGroup, active && styles.pillActive)}>
      <Popover
        width={width}
        trigger={
          <button type="button" className={styles.pillMain}>
            {active ? (
              <>
                <span className={styles.pillLabel}>{label}:</span> {value}
              </>
            ) : (
              label
            )}
            {!active && <ChevronDown size={12} />}
          </button>
        }
      >
        {children}
      </Popover>
      {active && (
        <button type="button" className={styles.pillClear} aria-label={`Rimuovi filtro ${label}`} onClick={onClear}>
          <X size={11} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}

interface CheckItem {
  key: string | number;
  label: string;
  icon?: ReactNode;
  count?: number;
  checked: boolean;
}

function CheckList({
  items,
  onToggle,
  searchable,
  empty = "Nessuna voce.",
}: {
  items: CheckItem[];
  onToggle: (key: string | number) => void;
  searchable?: boolean;
  empty?: string;
}) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;
  }, [items, filter]);

  return (
    <>
      {searchable && items.length > 6 && (
        <input
          autoFocus
          className={styles.popoverSearch}
          placeholder="Filtra…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      <div className={styles.checkList} role="listbox" aria-multiselectable>
        {items.length === 0 && <p className={styles.popoverEmpty}>{empty}</p>}
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            role="option"
            aria-selected={item.checked}
            className={styles.checkItem}
            onClick={() => onToggle(item.key)}
          >
            <span className={clsx(styles.checkBox, item.checked && styles.checkBoxOn)}>
              {item.checked && <Check size={11} strokeWidth={3} />}
            </span>
            {item.icon}
            <span className={styles.checkLabel}>{item.label}</span>
            {item.count !== undefined && <span className={styles.checkCount}>{item.count}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function YearRange({
  from,
  to,
  min,
  max,
  onChange,
}: {
  from: number | null;
  to: number | null;
  min: number | null;
  max: number | null;
  onChange: (from: number | null, to: number | null) => void;
}) {
  const parse = (value: string) => {
    const n = Number(value);
    return value.trim() && Number.isInteger(n) && n >= 1000 && n <= 9999 ? n : null;
  };
  const thisYear = new Date().getFullYear();
  const presets = [
    { label: "Ultimi 5 anni", from: thisYear - 4 },
    { label: "Ultimi 10 anni", from: thisYear - 9 },
  ];

  return (
    <div className={styles.yearRange}>
      {/* La chiave fa ripartire i campi quando il valore cambia da una scelta rapida. */}
      <div className={styles.yearInputs} key={`${from}-${to}`}>
        <label>
          Dal
          <input
            inputMode="numeric"
            placeholder={min?.toString() ?? "—"}
            defaultValue={from ?? ""}
            onBlur={(e) => onChange(parse(e.target.value), to)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
        <label>
          al
          <input
            inputMode="numeric"
            placeholder={max?.toString() ?? "—"}
            defaultValue={to ?? ""}
            onBlur={(e) => onChange(from, parse(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </label>
      </div>
      <div className={styles.presets}>
        {presets.map((p) => (
          <button key={p.label} type="button" className={styles.preset} onClick={() => onChange(p.from, null)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
