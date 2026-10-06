import clsx from "clsx";
import { FileText, ListFilter, Plus, SearchX, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api } from "../../lib/api";
import { plural } from "../../lib/format";
import { searchTerms } from "../../lib/highlight";
import { ARTICLE_DEPENDENT, useAction, useArticles, useSections, useTags, useViewCounts } from "../../lib/queries";
import { ancestorIds } from "../../lib/sectionTree";
import { fixedView } from "../../lib/views";
import { useImports } from "../../store/imports";
import { activeFilterCount, effectiveQuery, useSearch } from "../../store/search";
import { showError } from "../../store/toast";
import { currentSectionId, useUi, type View } from "../../store/ui";
import { ImportPanel } from "../import/ImportPanel";
import { pickAndImport } from "../import/importer";
import { FilterBar } from "../search/FilterBar";
import { SearchField } from "../search/SearchField";
import searchStyles from "../search/Search.module.css";
import { SortMenu } from "../search/SortMenu";
import { TagDot } from "../sidebar/TagList";
import { ArticleList } from "./ArticleList";
import styles from "./Articles.module.css";

interface Heading {
  title: string;
  /** Percorso delle sezioni madri, es. "Medicina › Cardiologia". */
  trail?: string;
  count: number;
  empty: string;
  tagColor?: Parameters<typeof TagDot>[0]["color"];
}

function useHeading(view: View): Heading | null {
  const counts = useViewCounts().data;
  const sections = useSections().data;
  const tags = useTags().data;

  switch (view.kind) {
    case "section": {
      const section = sections?.find((s) => s.id === view.id);
      if (!section || !sections) return null;
      const trail = ancestorIds(sections, section.id)
        .reverse()
        .map((id) => sections.find((s) => s.id === id)?.name)
        .join(" › ");
      return { title: section.name, trail, count: section.articleCount, empty: "Questa sezione è ancora vuota." };
    }
    case "tag": {
      const tag = tags?.find((t) => t.id === view.id);
      if (!tag) return null;
      return { title: tag.name, count: tag.articleCount, empty: "Nessun articolo con questo tag.", tagColor: tag.color };
    }
    default: {
      const info = fixedView(view.kind);
      return { title: info.label, count: counts?.[info.count] ?? 0, empty: info.empty };
    }
  }
}

export function ArticlePane() {
  const view = useUi((s) => s.view);
  const heading = useHeading(view);
  const search = useSearch();
  const { view: queryView, query } = effectiveQuery(view, search);
  const articles = useArticles(queryView, query).data;
  const dragging = useImports((s) => s.dragging && s.dragSectionId === null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const emptyTrash = useAction(api.emptyTrash, ARTICLE_DEPENDENT);

  const inTrash = view.kind === "trash";
  const searching = query.text !== "";
  const filterCount = activeFilterCount(query.filters);
  const narrowed = searching || filterCount > 0;
  const add = () => pickAndImport(currentSectionId(view)).catch(showError);

  const subtitle = narrowed
    ? `${plural(articles?.length ?? 0, "risultato", "risultati")}${
        searching && queryView.kind === "all" && view.kind !== "all" ? " in tutta la libreria" : ""
      }`
    : plural(heading?.count ?? 0, "articolo", "articoli");

  return (
    <section className={styles.pane} aria-label="Articoli">
      <div className={styles.top}>
        <header className={styles.header} data-tauri-drag-region>
          {heading && (
            <div className={styles.heading} data-tauri-drag-region>
              {heading.trail && <span className={styles.trail}>{heading.trail}</span>}
              <h1 className={styles.title}>
                {heading.tagColor && <TagDot color={heading.tagColor} />}
                {heading.title}
              </h1>
              <span className={styles.subtitle}>{subtitle}</span>
            </div>
          )}
          <div className={styles.headerActions}>
            {!inTrash && (
              <Button variant="primary" onClick={add}>
                <Plus size={15} strokeWidth={2.4} />
                Aggiungi articoli
              </Button>
            )}
            {inTrash && !!articles?.length && !narrowed && (
              <Button onClick={() => setConfirmEmpty(true)}>
                <Trash2 size={14} />
                Svuota cestino
              </Button>
            )}
          </div>
        </header>

        <div className={searchStyles.toolbar}>
          <SearchField />
          <button
            type="button"
            className={clsx(searchStyles.toolButton, (search.filtersOpen || filterCount > 0) && searchStyles.toolButtonOn)}
            aria-pressed={search.filtersOpen}
            onClick={search.toggleFiltersOpen}
          >
            <ListFilter size={14} />
            <span>Filtri</span>
            {filterCount > 0 && <span className={searchStyles.badge}>{filterCount}</span>}
          </button>
          <SortMenu searching={searching} />
        </div>

        {searching && view.kind !== "all" && !inTrash && heading && (
          <div className={searchStyles.scope}>
            Cerca in:
            {(["library", "view"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                className={clsx(searchStyles.scopeOption, search.scope === scope && searchStyles.scopeOn)}
                onClick={() => search.setScope(scope)}
              >
                {scope === "library" ? "Tutta la libreria" : `“${heading.title}”`}
              </button>
            ))}
          </div>
        )}

        {(search.filtersOpen || filterCount > 0) && <FilterBar />}
      </div>

      <div className={styles.body}>
        {articles && articles.length > 0 ? (
          <ArticleList articles={articles} inTrash={inTrash} terms={searchTerms(query.text)} />
        ) : (
          articles &&
          (narrowed ? (
            <div className={styles.empty}>
              <SearchX size={40} strokeWidth={1.2} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Nessun risultato</p>
              <p className={styles.emptyText}>Prova con altre parole o togli qualche filtro.</p>
              <p className={styles.emptyHint}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    search.setText("");
                    search.clearFilters();
                  }}
                >
                  Azzera ricerca e filtri
                </button>
              </p>
            </div>
          ) : (
            <div className={styles.empty}>
              <FileText size={40} strokeWidth={1.2} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Nessun articolo</p>
              <p className={styles.emptyText}>{heading?.empty}</p>
              {!inTrash && (
                <p className={styles.emptyHint}>
                  Trascina qui i PDF oppure{" "}
                  <button type="button" className={styles.link} onClick={add}>
                    sceglili dal computer
                  </button>
                  .
                </p>
              )}
            </div>
          ))
        )}

        {dragging && !inTrash && (
          <div className={styles.dropOverlay}>
            <Upload size={28} />
            <span>
              Rilascia per aggiungere
              {heading && view.kind === "section" ? ` a “${heading.title}”` : " alla libreria"}
            </span>
          </div>
        )}
        <ImportPanel />
      </div>

      <ConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Svuotare il cestino?"
        confirmLabel="Svuota cestino"
        destructive
        onConfirm={() => emptyTrash()}
      >
        <p>
          {plural(articles?.length ?? 0, "articolo verrà eliminato", "articoli verranno eliminati")} definitivamente,
          insieme ai PDF. L'operazione non si può annullare.
        </p>
      </ConfirmDialog>
    </section>
  );
}
