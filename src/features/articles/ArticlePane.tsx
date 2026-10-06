import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/Button";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { api } from "../../lib/api";
import { plural } from "../../lib/format";
import { ARTICLE_DEPENDENT, useAction, useArticles, useSections, useTags, useViewCounts } from "../../lib/queries";
import { ancestorIds } from "../../lib/sectionTree";
import { fixedView } from "../../lib/views";
import { useImports } from "../../store/imports";
import { showError } from "../../store/toast";
import { currentSectionId, useUi, type View } from "../../store/ui";
import { ImportPanel } from "../import/ImportPanel";
import { pickAndImport } from "../import/importer";
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
  const articles = useArticles(view).data;
  const dragging = useImports((s) => s.dragging && s.dragSectionId === null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const emptyTrash = useAction(api.emptyTrash, ARTICLE_DEPENDENT);

  const inTrash = view.kind === "trash";
  const canImport = !inTrash;
  const add = () => pickAndImport(currentSectionId(view)).catch(showError);

  return (
    <section className={styles.pane} aria-label="Articoli">
      <header className={styles.header} data-tauri-drag-region>
        {heading && (
          <div className={styles.heading} data-tauri-drag-region>
            {heading.trail && <span className={styles.trail}>{heading.trail}</span>}
            <h1 className={styles.title}>
              {heading.tagColor && <TagDot color={heading.tagColor} />}
              {heading.title}
            </h1>
            <span className={styles.subtitle}>{plural(heading.count, "articolo", "articoli")}</span>
          </div>
        )}
        <div className={styles.headerActions}>
          {canImport && (
            <Button variant="primary" onClick={add}>
              <Plus size={15} strokeWidth={2.4} />
              Aggiungi articoli
            </Button>
          )}
          {inTrash && !!articles?.length && (
            <Button onClick={() => setConfirmEmpty(true)}>
              <Trash2 size={14} />
              Svuota cestino
            </Button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {articles && articles.length > 0 ? (
          <ArticleList articles={articles} inTrash={inTrash} />
        ) : (
          articles && (
            <div className={styles.empty}>
              <FileText size={40} strokeWidth={1.2} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>Nessun articolo</p>
              <p className={styles.emptyText}>{heading?.empty}</p>
              {canImport && (
                <p className={styles.emptyHint}>
                  Trascina qui i PDF oppure{" "}
                  <button type="button" className={styles.link} onClick={add}>
                    sceglili dal computer
                  </button>
                  .
                </p>
              )}
            </div>
          )
        )}

        {dragging && canImport && (
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
